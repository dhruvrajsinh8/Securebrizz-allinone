import { describe, it, expect } from 'vitest';
import { COMMON_AUDIT_PORTS, portFindings, probePort } from '@/lib/scanner/ports';
import type { Port } from '@/types/scanner';

describe('COMMON_AUDIT_PORTS', () => {
  it('covers major critical database and remote access ports', () => {
    const portNumbers = COMMON_AUDIT_PORTS.map((p) => p.port);
    expect(portNumbers).toContain(6379); // Redis
    expect(portNumbers).toContain(27017); // MongoDB
    expect(portNumbers).toContain(3306); // MySQL
    expect(portNumbers).toContain(5432); // PostgreSQL
    expect(portNumbers).toContain(23); // Telnet
    expect(portNumbers).toContain(445); // SMB
    expect(portNumbers).toContain(3389); // RDP
    expect(portNumbers).toContain(22); // SSH
  });

  it('assigns critical severity to unauthenticated database and insecure remote protocols', () => {
    const redis = COMMON_AUDIT_PORTS.find((p) => p.port === 6379);
    expect(redis?.defaultRisk).toBe('critical');

    const telnet = COMMON_AUDIT_PORTS.find((p) => p.port === 23);
    expect(telnet?.defaultRisk).toBe('critical');

    const smb = COMMON_AUDIT_PORTS.find((p) => p.port === 445);
    expect(smb?.defaultRisk).toBe('critical');
  });
});

describe('portFindings', () => {
  it('does not generate alert findings for standard web traffic (80/443)', () => {
    const ports: Port[] = [
      {
        number: 80,
        service: 'HTTP',
        protocol: 'tcp',
        state: 'open',
        risk: 'info',
        description: 'Web server',
      },
      {
        number: 443,
        service: 'HTTPS',
        protocol: 'tcp',
        state: 'open',
        risk: 'info',
        description: 'TLS Web server',
      },
    ];

    const findings = portFindings(ports, 'example.com');
    expect(findings).toHaveLength(0);
  });

  it('flags exposed database ports as critical security findings', () => {
    const ports: Port[] = [
      {
        number: 6379,
        service: 'Redis',
        protocol: 'tcp',
        state: 'open',
        risk: 'critical',
        description: 'In-memory database',
      },
    ];

    const findings = portFindings(ports, 'api.example.com');
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('port-6379');
    expect(findings[0].priority).toBe('critical');
    expect(findings[0].category).toBe('Attack Surface');
    expect(findings[0].title).toContain('Redis');
    expect(findings[0].remediation).toContain('127.0.0.1');
    expect(findings[0].cwe).toContain('CWE-284');
  });

  it('flags exposed remote management ports (RDP, Telnet)', () => {
    const ports: Port[] = [
      {
        number: 3389,
        service: 'RDP',
        protocol: 'tcp',
        state: 'open',
        risk: 'high',
        description: 'Windows Remote Desktop',
      },
    ];

    const findings = portFindings(ports, 'corp.example.com');
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('port-3389');
    expect(findings[0].priority).toBe('high');
    expect(findings[0].title).toContain('RDP');
    expect(findings[0].remediation).toContain('VPN');
  });
});

describe('probePort', () => {
  it('safely handles non-responsive or closed ports without unhandled exceptions', async () => {
    // 192.0.2.1 is TEST-NET-1 (RFC 5737), guaranteed to not answer
    const result = await probePort(
      '192.0.2.1',
      {
        port: 65534,
        service: 'Test',
        category: 'infrastructure',
        defaultRisk: 'info',
        description: 'Test',
      },
      150
    );

    expect(result).toBeNull();
  });
});
