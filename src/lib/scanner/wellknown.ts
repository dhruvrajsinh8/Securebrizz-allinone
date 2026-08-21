/**
 * Well-known files and certificate-transparency discovery. A 200 status alone
 * does not mean a file exists: SPAs answer 200 with an HTML shell for every
 * path, so both content type and body shape are verified.
 */

import type { ScanRecommendation } from '@/types/scanner';
import { makeFinding, REFS } from './findings';
import { probe } from './net';

export interface WellKnownResult {
  hasRobotsTxt: boolean;
  hasSecurityTxt: boolean;
  disclosedPaths: string[];
  findings: ScanRecommendation[];
  failures: Record<string, string>;
}

const SENSITIVE_PATHS = /(admin|administrator|manage|internal|private|secret|backup|config|\.git|\.env|wp-admin|phpmyadmin|staging|dashboard|console|debug|phpinfo|db|sql|dump)/i;

export async function inspectWellKnown(origin: string, timeoutMs: number): Promise<WellKnownResult> {
  const failures: Record<string, string> = {};
  const findings: ScanRecommendation[] = [];

  const [robots, securityWellKnown, securityLegacy] = await Promise.all([
    probe(`${origin}/robots.txt`, { timeoutMs, maxBytes: 200_000 }),
    probe(`${origin}/.well-known/security.txt`, { timeoutMs, maxBytes: 50_000 }),
    probe(`${origin}/security.txt`, { timeoutMs, maxBytes: 50_000 }),
  ]);

  if (!robots.ok) failures['wellknown.robots'] = robots.error ?? 'request failed';
  if (!securityWellKnown.ok && !securityLegacy.ok) failures['wellknown.securitytxt'] = securityWellKnown.error ?? 'request failed';

  const hasRobotsTxt = isPlainTextFile(robots, /user-agent\s*:/i);
  const hasSecurityTxt = isPlainTextFile(securityWellKnown, /contact\s*:/i) || isPlainTextFile(securityLegacy, /contact\s*:/i);
  const disclosedPaths = hasRobotsTxt ? extractSensitivePaths(robots.body) : [];

  if (disclosedPaths.length > 0) {
    findings.push(makeFinding({
      id: 'rec-robots-disclosure', title: 'robots.txt names administrative paths', severity: 'low', category: 'Information Disclosure',
      description: `robots.txt lists ${disclosedPaths.length} path(s) that look administrative or internal.`,
      impact: 'robots.txt is the first file an attacker reads. Disallow entries are a curated map of the paths you consider sensitive, and crawlers that ignore the file index them anyway.',
      evidence: disclosedPaths.slice(0, 8).map((path) => ({ label: 'Disallow', value: path })),
      remediation: 'Protect these paths with authentication and remove them from robots.txt. Use noindex response headers, or authentication, to keep pages out of search results.',
      references: [{ label: 'OWASP — Review webserver metafiles', url: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/03-Review_Webserver_Metafiles_for_Information_Leakage' }], cwe: 'CWE-200', timeToFix: '15 mins',
    }));
  }

  if (!hasSecurityTxt && !failures['wellknown.securitytxt']) {
    findings.push(makeFinding({
      id: 'rec-sectxt', title: 'Publish a security contact at /.well-known/security.txt', severity: 'info', category: 'Compliance',
      description: 'No RFC 9116 security.txt file was found.',
      impact: 'A researcher who finds a vulnerability has no documented way to report it, which is how findings end up on social media instead of in your inbox.',
      evidence: [{ label: '/.well-known/security.txt', value: describeMiss(securityWellKnown) }, { label: '/security.txt', value: describeMiss(securityLegacy) }],
      remediation: 'Publish a signed security.txt with a Contact field and an Expires date.',
      fix: [{ label: '/.well-known/security.txt', code: `Contact: mailto:security@example.com\nExpires: 2027-01-01T00:00:00.000Z\nPreferred-Languages: en\nCanonical: https://example.com/.well-known/security.txt` }], references: [REFS.securityTxt], timeToFix: '10 mins',
    }));
  }

  return { hasRobotsTxt, hasSecurityTxt, disclosedPaths, findings, failures };
}

function isPlainTextFile(response: Awaited<ReturnType<typeof probe>>, shape: RegExp): boolean {
  if (!response.ok || response.status !== 200) return false;
  const contentType = response.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('text/plain')) return false;
  if (/<html|<!doctype html/i.test(response.body)) return false;
  return shape.test(response.body);
}

function describeMiss(response: Awaited<ReturnType<typeof probe>>): string {
  if (!response.ok) return response.error ?? 'request failed';
  if (response.status !== 200) return `HTTP ${response.status}`;
  const contentType = response.headers['content-type'] ?? 'no content-type';
  return `HTTP 200 but content-type was "${contentType}" (not a text/plain security.txt)`;
}

function extractSensitivePaths(body: string): string[] {
  const paths = new Set<string>();
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*disallow\s*:\s*(\S+)/i);
    if (!match) continue;
    const path = match[1].trim();
    if (path === '/' || path.length < 2) continue;
    if (SENSITIVE_PATHS.test(path)) paths.add(path);
  }
  return Array.from(paths).slice(0, 20);
}

export interface SubdomainResult {
  subdomains: string[];
  notable: string[];
  error?: string;
  source?: 'crt.sh' | 'certspotter';
}

const NOTABLE_SUBDOMAIN = /^(dev|test|staging|stage|uat|qa|demo|beta|internal|intranet|admin|vpn|jenkins|git|gitlab|jira|grafana|kibana|db|database|backup|old|legacy|mail|smtp|ftp)[.-]/i;

/**
 * Passive subdomain discovery from Certificate Transparency logs. No traffic
 * reaches the target. crt.sh is the richer source but frequently slow/down;
 * Cert Spotter reads the same logs and backs it up.
 */
export async function fetchSubdomains(domain: string): Promise<SubdomainResult> {
  const errors: string[] = [];
  const sources: [string, (d: string) => Promise<Set<string>>][] = [
    ['crt.sh', fetchFromCrtSh],
    ['certspotter', fetchFromCertSpotter],
  ];

  for (const [name, fetcher] of sources) {
    try {
      const found = await fetcher(domain);
      const subdomains = Array.from(found).sort();
      const notable = subdomains.filter((entry) => NOTABLE_SUBDOMAIN.test(entry.replace(`.${domain}`, '') + '.'));
      return { subdomains: subdomains.slice(0, 100), notable: notable.slice(0, 25), source: name as SubdomainResult['source'] };
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  return { subdomains: [], notable: [], error: `no certificate transparency source responded (${errors.join('; ')})` };
}

function collect(domain: string, raw: string, into: Set<string>): void {
  let name = raw.trim().toLowerCase();
  if (name.startsWith('*.')) name = name.slice(2);
  if (name.endsWith(`.${domain}`) && name !== domain) into.add(name);
}

async function fetchFromCrtSh(domain: string): Promise<Set<string>> {
  const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9_000) });
  if (res.status === 404) return new Set();
  if (!res.ok) throw new Error(`returned ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('unexpected response shape');
  const found = new Set<string>();
  for (const entry of data) {
    const nameValue = (entry as { name_value?: unknown }).name_value;
    if (typeof nameValue !== 'string') continue;
    for (const line of nameValue.split('\n')) collect(domain, line, found);
  }
  return found;
}

async function fetchFromCertSpotter(domain: string): Promise<Set<string>> {
  const url = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9_000) });
  if (res.status === 429) throw new Error('rate limit reached (unauthenticated quota)');
  if (!res.ok) throw new Error(`returned ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('unexpected response shape');
  const found = new Set<string>();
  for (const entry of data) {
    const names = (entry as { dns_names?: unknown }).dns_names;
    if (!Array.isArray(names)) continue;
    for (const name of names) if (typeof name === 'string') collect(domain, name, found);
  }
  return found;
}
