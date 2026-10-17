/**
 * Active TCP port scanner for authorized deep security audits.
 *
 * Uses native Node.js TCP sockets (net.Socket) to test whether critical
 * ports are open, closed, or filtered. Does not send exploit payloads;
 * cleanly terminates the handshake (SYN-ACK -> ACK -> RST/FIN) immediately.
 */

import { Socket } from 'net';
import type { Port, ScanRecommendation, Severity } from '@/types/scanner';

export interface PortSpec {
  port: number;
  service: string;
  category: 'database' | 'remote_access' | 'web' | 'mail' | 'file_transfer' | 'infrastructure';
  defaultRisk: Severity;
  description: string;
}

export const COMMON_AUDIT_PORTS: PortSpec[] = [
  // Databases (high impact if exposed publicly)
  { port: 6379, service: 'Redis', category: 'database', defaultRisk: 'critical', description: 'In-memory database often configured without authentication by default.' },
  { port: 27017, service: 'MongoDB', category: 'database', defaultRisk: 'critical', description: 'Document database; public exposure is a leading cause of data ransom incidents.' },
  { port: 3306, service: 'MySQL', category: 'database', defaultRisk: 'high', description: 'Relational database management system exposed to public network traffic.' },
  { port: 5432, service: 'PostgreSQL', category: 'database', defaultRisk: 'high', description: 'PostgreSQL database server listening on public interface.' },
  { port: 1433, service: 'MSSQL', category: 'database', defaultRisk: 'high', description: 'Microsoft SQL Server port exposed.' },
  { port: 9200, service: 'Elasticsearch', category: 'database', defaultRisk: 'high', description: 'RESTful search engine API; vulnerable to data leaks if unauthenticated.' },
  { port: 11211, service: 'Memcached', category: 'database', defaultRisk: 'high', description: 'Memory caching system; can be abused for DDoS amplification and data exfiltration.' },

  // Remote Access & Management
  { port: 23, service: 'Telnet', category: 'remote_access', defaultRisk: 'critical', description: 'Legacy unencrypted remote terminal protocol. Transmits credentials in plaintext.' },
  { port: 445, service: 'SMB', category: 'remote_access', defaultRisk: 'critical', description: 'Server Message Block file sharing; frequent target for ransomware and lateral movement.' },
  { port: 3389, service: 'RDP', category: 'remote_access', defaultRisk: 'high', description: 'Windows Remote Desktop Protocol listening on public internet.' },
  { port: 5900, service: 'VNC', category: 'remote_access', defaultRisk: 'high', description: 'Virtual Network Computing remote desktop sharing.' },
  { port: 22, service: 'SSH', category: 'remote_access', defaultRisk: 'medium', description: 'Secure Shell remote login service.' },

  // File Transfer & Mail
  { port: 21, service: 'FTP', category: 'file_transfer', defaultRisk: 'high', description: 'Unencrypted File Transfer Protocol; credentials and files are sent in plaintext.' },
  { port: 25, service: 'SMTP', category: 'mail', defaultRisk: 'low', description: 'Simple Mail Transfer Protocol mail server.' },
  { port: 110, service: 'POP3', category: 'mail', defaultRisk: 'medium', description: 'Post Office Protocol v3 for email retrieval.' },
  { port: 143, service: 'IMAP', category: 'mail', defaultRisk: 'medium', description: 'Internet Message Access Protocol.' },

  // Web & Proxies
  { port: 80, service: 'HTTP', category: 'web', defaultRisk: 'info', description: 'Standard unencrypted web server.' },
  { port: 443, service: 'HTTPS', category: 'web', defaultRisk: 'info', description: 'Standard TLS-encrypted web server.' },
  { port: 8080, service: 'HTTP-Proxy / Alt', category: 'web', defaultRisk: 'low', description: 'Common secondary web application or proxy port.' },
  { port: 8443, service: 'HTTPS-Alt', category: 'web', defaultRisk: 'info', description: 'Secondary encrypted HTTPS web server or administration panel.' },
  { port: 8888, service: 'HTTP-Alt / Admin', category: 'web', defaultRisk: 'low', description: 'Alternative web port commonly used for administration panels.' },
];

/**
 * Checks a single TCP port using a non-blocking socket with a strict timeout.
 */
export function probePort(
  host: string,
  spec: PortSpec,
  timeoutMs = 1200
): Promise<Port | null> {
  return new Promise((resolve) => {
    const socket = new Socket();

    socket.setTimeout(timeoutMs);

    socket.connect(spec.port, host, () => {
      socket.destroy();
      resolve({
        number: spec.port,
        service: spec.service,
        protocol: 'tcp',
        state: 'open',
        risk: spec.defaultRisk,
        description: spec.description,
        evidence: `TCP connection successfully established to ${host}:${spec.port} (${spec.service})`,
      });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/**
 * Scan top audit ports with controlled concurrency (chunks of 8-10 sockets).
 */
export async function scanAuditPorts(
  host: string,
  ports: PortSpec[] = COMMON_AUDIT_PORTS,
  concurrency = 8,
  timeoutMs = 1200
): Promise<Port[]> {
  const openPorts: Port[] = [];
  const queue = [...ports];

  async function worker() {
    while (queue.length > 0) {
      const spec = queue.shift();
      if (!spec) break;
      const res = await probePort(host, spec, timeoutMs);
      if (res && res.state === 'open') {
        openPorts.push(res);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ports.length) }, () => worker());
  await Promise.all(workers);

  return openPorts.sort((a, b) => a.number - b.number);
}

/**
 * Translates dangerous open ports into security findings.
 */
export function portFindings(openPorts: Port[], host: string): ScanRecommendation[] {
  const findings: ScanRecommendation[] = [];

  for (const port of openPorts) {
    if (port.risk === 'critical' || port.risk === 'high' || port.risk === 'medium') {
      const isDb = ['Redis', 'MongoDB', 'MySQL', 'PostgreSQL', 'MSSQL', 'Elasticsearch', 'Memcached'].includes(port.service);
      const isRemote = ['Telnet', 'RDP', 'VNC', 'SMB'].includes(port.service);

      findings.push({
        id: `port-${port.number}`,
        title: isDb
          ? `Publicly accessible ${port.service} database port (${port.number})`
          : isRemote
          ? `Exposed remote management service: ${port.service} (${port.number})`
          : `Exposed ${port.service} service on port ${port.number}`,
        description: port.description,
        priority: port.risk,
        estimatedImpact: isDb || isRemote ? 'Severe Attack Surface Exposure' : 'Moderate Exposure',
        difficulty: isDb || isRemote ? 'easy' : 'medium',
        timeToFix: '15-30 mins',
        impact: isDb
          ? 'Exposing internal database ports directly to the public internet creates severe exposure to automated brute force attacks, credential theft, and ransomware data exfiltration.'
          : isRemote
          ? 'Direct remote access ports are prime targets for automated credential stuffing, exploitation of protocol vulnerabilities, and unauthorized remote control.'
          : 'Exposed network ports expand your external attack surface and reveal infrastructure details to potential attackers.',
        remediation: isDb
          ? `Bind ${port.service} to localhost (127.0.0.1) or your private virtual network (VPC). Use firewall rules or security groups to drop all inbound traffic to port ${port.number} from 0.0.0.0/0. If remote access is necessary, require a VPN or SSH tunnel.`
          : isRemote
          ? `Restrict access to port ${port.number} behind a private VPN or Zero-Trust Network Access (ZTNA) gateway. Never expose unencrypted protocols like Telnet or raw RDP directly to the open internet.`
          : `Review whether port ${port.number} needs to be accessible from public IP addresses. Block access via firewall or host-level iptables.`,
        category: 'Attack Surface',
        references: [
          { label: 'CWE-284: Improper Access Control', url: 'https://cwe.mitre.org/data/definitions/284.html' },
          { label: 'OWASP Security Misconfiguration (A05:2021)', url: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' },
        ],
        evidence: [{ label: 'Open Port', value: `${host}:${port.number} (${port.service} TCP)` }],
        cwe: 'CWE-284: Improper Access Control',
        owasp: 'A05:2021 Security Misconfiguration',
        resolved: false,
      });
    }
  }

  return findings;
}
