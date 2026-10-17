/**
 * Vulnerability intelligence and CVE correlation engine.
 *
 * Correlates detected software and web frameworks with known vulnerabilities
 * via Google's OSV.dev open database and local vulnerability signatures.
 */

import type { ScanRecommendation, Technology } from '@/types/scanner';

interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  database_specific?: {
    severity?: string;
    cvss?: { score?: number };
  };
  references?: { type: string; url: string }[];
}

interface OsvQueryResponse {
  vulns?: OsvVuln[];
}

/** Common web ecosystem mappings for OSV queries */
const ECOSYSTEM_MAP: Record<string, string> = {
  jquery: 'npm',
  react: 'npm',
  next: 'npm',
  'next.js': 'npm',
  vue: 'npm',
  angular: 'npm',
  lodash: 'npm',
  bootstrap: 'npm',
  express: 'npm',
  wordpress: 'WordPress',
};

/**
 * Known version threshold signatures for common web servers and libraries
 * so CVE insights work reliably even if offline or if external API is slow.
 */
interface KnownVulnerabilityRule {
  tech: string;
  cve: string;
  title: string;
  priority: 'critical' | 'high' | 'medium';
  impact: string;
  remediation: string;
  matches: (version: string) => boolean;
}

const KNOWN_CVE_RULES: KnownVulnerabilityRule[] = [
  {
    tech: 'apache',
    cve: 'CVE-2021-41773',
    title: 'Apache HTTP Server Path Traversal & RCE (CVE-2021-41773)',
    priority: 'critical',
    impact: 'Flaw in path normalization allows an attacker to map URLs to files outside the document root or execute arbitrary scripts.',
    remediation: 'Upgrade Apache HTTP Server to version 2.4.51 or later immediately.',
    matches: (v) => v.startsWith('2.4.49') || v.startsWith('2.4.50'),
  },
  {
    tech: 'nginx',
    cve: 'CVE-2019-9511',
    title: 'Nginx HTTP/2 Resource Exhaustion / Denial of Service (CVE-2019-9511)',
    priority: 'high',
    impact: 'HTTP/2 protocol implementations can be manipulated to cause CPU spike and denial of service via continuous streams of requests.',
    remediation: 'Upgrade Nginx to version 1.16.1, 1.17.3, or later.',
    matches: (v) => {
      const parts = v.split('.').map(Number);
      return parts[0] === 1 && ((parts[1] === 16 && parts[2] === 0) || (parts[1] === 17 && parts[2] < 3) || parts[1] < 16);
    },
  },
  {
    tech: 'jquery',
    cve: 'CVE-2020-11022',
    title: 'jQuery Untrusted HTML Execution / XSS (CVE-2020-11022)',
    priority: 'medium',
    impact: 'Passing HTML containing <style> elements from untrusted sources to jQuery methods like .html() or .append() can lead to Cross-Site Scripting (XSS).',
    remediation: 'Upgrade jQuery to version 3.5.0 or later.',
    matches: (v) => {
      const major = parseInt(v.split('.')[0] || '0', 10);
      const minor = parseInt(v.split('.')[1] || '0', 10);
      return major < 3 || (major === 3 && minor < 5);
    },
  },
  {
    tech: 'php',
    cve: 'CVE-2024-4577',
    title: 'PHP CGI Argument Injection (CVE-2024-4577)',
    priority: 'critical',
    impact: 'Best-fit character encoding conversions in PHP-CGI bypass previous command line argument checks, allowing Remote Code Execution.',
    remediation: 'Upgrade PHP to version 8.1.29, 8.2.20, 8.3.8 or later.',
    matches: (v) => v.startsWith('8.1.') || v.startsWith('8.2.') || v.startsWith('8.3.'),
  },
];

/**
 * Queries OSV.dev API for a specific package and version.
 */
async function queryOsv(packageName: string, version: string, ecosystem = 'npm'): Promise<OsvVuln[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: { name: packageName, ecosystem },
        version,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return [];

    const json = (await res.json()) as OsvQueryResponse;
    return json.vulns ?? [];
  } catch {
    return [];
  }
}

/**
 * Enriches identified technologies with CVE intelligence and produces recommendations.
 */
export async function correlateCves(technologies: Technology[]): Promise<{
  technologies: Technology[];
  findings: ScanRecommendation[];
}> {
  const updatedTechs: Technology[] = [];
  const findings: ScanRecommendation[] = [];

  for (const tech of technologies) {
    const techCopy = { ...tech };
    const techKey = tech.name.toLowerCase().trim();
    const version = tech.version?.replace(/^v/i, '').trim();

    // 1. Check local vulnerability signatures first
    if (version) {
      for (const rule of KNOWN_CVE_RULES) {
        if (techKey.includes(rule.tech) && rule.matches(version)) {
          techCopy.cveCount = (techCopy.cveCount ?? 0) + 1;
          techCopy.isOutdated = true;
          techCopy.advisory = rule.title;

          findings.push({
            id: `cve-${rule.cve.toLowerCase()}`,
            title: rule.title,
            description: `${tech.name} ${version} is running a vulnerable version subject to ${rule.cve}.`,
            priority: rule.priority,
            estimatedImpact: rule.priority === 'critical' ? 'Critical Security Risk' : 'High Security Risk',
            difficulty: 'medium',
            timeToFix: '1-2 hours',
            impact: rule.impact,
            remediation: rule.remediation,
            category: 'Software Vulnerabilities',
            references: [
              { label: rule.cve, url: `https://nvd.nist.gov/vuln/detail/${rule.cve}` },
            ],
            evidence: [
              { label: 'Detected Software', value: `${tech.name} ${version}` },
              { label: 'Vulnerability ID', value: rule.cve },
            ],
            cwe: 'CWE-937: Using Components with Known Vulnerabilities',
            resolved: false,
          });
        }
      }
    }

    // 2. Query OSV.dev if ecosystem mapped
    const ecosystem = ECOSYSTEM_MAP[techKey];
    if (ecosystem && version) {
      const vulns = await queryOsv(techKey, version, ecosystem);
      if (vulns.length > 0) {
        techCopy.cveCount = (techCopy.cveCount ?? 0) + vulns.length;
        techCopy.isOutdated = true;

        for (const v of vulns.slice(0, 3)) {
          const cveId = v.aliases?.find((a) => a.startsWith('CVE-')) ?? v.id;
          findings.push({
            id: `cve-${v.id.toLowerCase()}`,
            title: `${tech.name} vulnerability (${cveId})`,
            description: v.summary || v.details?.slice(0, 200) || `Known vulnerability in ${tech.name} ${version}`,
            priority: 'high',
            estimatedImpact: 'High Security Risk',
            difficulty: 'medium',
            timeToFix: '1-2 hours',
            impact: 'Running outdated third-party dependencies exposes the web application to publicly documented exploits.',
            remediation: `Upgrade ${tech.name} to the latest stable release.`,
            category: 'Software Vulnerabilities',
            references: (v.references ?? []).slice(0, 2).map((r) => ({ label: r.type, url: r.url })),
            evidence: [
              { label: 'Software', value: `${tech.name} ${version}` },
              { label: 'Advisory ID', value: v.id },
            ],
            cwe: 'CWE-937: Using Components with Known Vulnerabilities',
            resolved: false,
          });
        }
      }
    }

    updatedTechs.push(techCopy);
  }

  return { technologies: updatedTechs, findings };
}
