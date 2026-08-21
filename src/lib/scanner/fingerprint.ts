/**
 * Technology and library fingerprinting. Every detection records evidence and
 * whether it is confirmed or heuristic. Version judgements come from a bundled,
 * dated table of known-vulnerable releases.
 */

import type { ScanRecommendation, Technology } from '@/types/scanner';
import { makeFinding } from './findings';

export const VULN_DB_AS_OF = '2025-06';

interface LibraryRule {
  name: string;
  category: string;
  pattern: RegExp;
  minSafe: string;
  latest: string;
  advisory: string;
  cveCount: number;
}

const LIBRARY_RULES: LibraryRule[] = [
  { name: 'jQuery', category: 'JavaScript Library', pattern: /jquery[-.@/]?(\d+\.\d+(?:\.\d+)?)(?:\.slim)?(?:\.min)?\.js/i, minSafe: '3.5.0', latest: '3.7.1', advisory: 'jQuery below 3.5.0 is affected by CVE-2020-11022 and CVE-2020-11023: HTML from untrusted sources passed to DOM manipulation methods can execute script even after being passed through jQuery\'s own sanitising path.', cveCount: 2 },
  { name: 'Bootstrap', category: 'CSS Framework', pattern: /bootstrap[-.@/]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.(?:js|css)/i, minSafe: '4.3.1', latest: '5.3.3', advisory: 'Bootstrap below 4.3.1 is affected by CVE-2019-8331: XSS via the data-template attribute in tooltip and popover components.', cveCount: 1 },
  { name: 'AngularJS', category: 'JavaScript Framework', pattern: /angular[-.@/]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, minSafe: '99.0.0', latest: 'discontinued', advisory: 'AngularJS (1.x) reached end of life in January 2022 and receives no security patches. Remaining known issues, including prototype-pollution and sandbox-escape classes of bug, will never be fixed.', cveCount: 0 },
  { name: 'Lodash', category: 'JavaScript Library', pattern: /lodash[-.@/]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, minSafe: '4.17.21', latest: '4.17.21', advisory: 'Lodash below 4.17.21 is affected by CVE-2021-23337 (command injection via template) and CVE-2020-8203 (prototype pollution in zipObjectDeep).', cveCount: 2 },
  { name: 'Moment.js', category: 'JavaScript Library', pattern: /moment[-.@/]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, minSafe: '2.29.4', latest: '2.30.1', advisory: 'Moment.js below 2.29.4 is affected by CVE-2022-31129 (ReDoS in string parsing). The project is also in maintenance mode and recommends migration.', cveCount: 1 },
];

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface FingerprintResult {
  technologies: Technology[];
  outdatedLibraries: string[];
  findings: ScanRecommendation[];
  cms?: string;
}

export function fingerprint(args: {
  headers: Record<string, string>;
  html: string;
  scriptUrls: string[];
  cookieNames: string[];
  generator?: string;
}): FingerprintResult {
  const { headers, html, scriptUrls, cookieNames, generator } = args;
  const technologies: Technology[] = [];
  const seen = new Set<string>();

  const add = (tech: Technology) => {
    const key = tech.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    technologies.push(tech);
  };

  const server = headers['server'];
  if (server) { const [name, version] = server.split('/'); add({ name: name.trim() || 'Web Server', version: version?.trim(), category: 'Web Server', isOutdated: false, confidence: 'confirmed', evidence: `server: ${server}` }); }

  const poweredBy = headers['x-powered-by'];
  if (poweredBy) { const [name, version] = poweredBy.split('/'); add({ name: name.trim(), version: version?.trim(), category: 'Application Runtime', isOutdated: false, confidence: 'confirmed', evidence: `x-powered-by: ${poweredBy}` }); }

  const headerSignatures: { header: string; name: string; category: string }[] = [
    { header: 'x-vercel-id', name: 'Vercel', category: 'Hosting Platform' },
    { header: 'cf-ray', name: 'Cloudflare', category: 'CDN / WAF' },
    { header: 'x-amz-cf-id', name: 'AWS CloudFront', category: 'CDN' },
    { header: 'x-served-by', name: 'Fastly', category: 'CDN' },
    { header: 'x-github-request-id', name: 'GitHub', category: 'Hosting Platform' },
    { header: 'x-drupal-cache', name: 'Drupal', category: 'CMS' },
    { header: 'x-shopify-stage', name: 'Shopify', category: 'E-commerce' },
    { header: 'x-aspnet-version', name: 'ASP.NET', category: 'Application Runtime' },
  ];
  for (const signature of headerSignatures) {
    const value = headers[signature.header];
    if (!value) continue;
    add({ name: signature.name, version: /^\d+\.\d+/.test(value) ? value : undefined, category: signature.category, isOutdated: false, confidence: 'confirmed', evidence: `${signature.header}: ${value}` });
  }

  const cookieSignatures: { pattern: RegExp; name: string; category: string }[] = [
    { pattern: /^PHPSESSID$/i, name: 'PHP', category: 'Application Runtime' },
    { pattern: /^JSESSIONID$/i, name: 'Java (Servlet container)', category: 'Application Runtime' },
    { pattern: /^ASP\.NET_SessionId$/i, name: 'ASP.NET', category: 'Application Runtime' },
    { pattern: /^laravel_session$/i, name: 'Laravel', category: 'Web Framework' },
    { pattern: /^_rails_session|^_session_id$/i, name: 'Ruby on Rails', category: 'Web Framework' },
    { pattern: /^wordpress_/i, name: 'WordPress', category: 'CMS' },
  ];
  for (const name of cookieNames) {
    for (const signature of cookieSignatures) {
      if (signature.pattern.test(name)) add({ name: signature.name, category: signature.category, isOutdated: false, confidence: 'confirmed', evidence: `Set-Cookie: ${name}` });
    }
  }

  const markers: { test: RegExp; name: string; category: string; label: string }[] = [
    { test: /__NEXT_DATA__|\/_next\/static\//, name: 'Next.js', category: 'React Framework', label: '__NEXT_DATA__ / _next/static' },
    { test: /window\.__NUXT__/, name: 'Nuxt', category: 'Vue Framework', label: 'window.__NUXT__' },
    { test: /wp-content\/|wp-includes\//, name: 'WordPress', category: 'CMS', label: 'wp-content / wp-includes paths' },
    { test: /Drupal\.settings|\/sites\/(?:all|default)\//, name: 'Drupal', category: 'CMS', label: 'Drupal.settings' },
    { test: /\/media\/jui\/|Joomla!/, name: 'Joomla', category: 'CMS', label: 'Joomla markers' },
    { test: /data-reactroot|react-dom/, name: 'React', category: 'Frontend Library', label: 'data-reactroot / react-dom' },
    { test: /ng-version="([\d.]+)"/, name: 'Angular', category: 'Frontend Framework', label: 'ng-version attribute' },
    { test: /Shopify\.theme|cdn\.shopify\.com/, name: 'Shopify', category: 'E-commerce', label: 'Shopify asset host' },
    { test: /csrf-param|turbo-cable/, name: 'Ruby on Rails', category: 'Web Framework', label: 'Rails CSRF meta tags' },
  ];
  for (const marker of markers) {
    const match = html.match(marker.test);
    if (!match) continue;
    add({ name: marker.name, version: match[1], category: marker.category, isOutdated: false, confidence: 'confirmed', evidence: `HTML marker: ${marker.label}` });
  }

  let cms: string | undefined;
  if (generator) {
    const versionMatch = generator.match(/(\d+\.\d+(?:\.\d+)?)/);
    const name = generator.replace(/\s*\d+[\d.]*\s*$/, '').trim() || generator;
    add({ name, version: versionMatch?.[1], category: 'CMS / Generator', isOutdated: false, confidence: 'confirmed', evidence: `<meta name="generator" content="${generator}">` });
    if (/wordpress|drupal|joomla|ghost|wix|squarespace/i.test(generator)) cms = name;
  }
  if (!cms) { const cmsTech = technologies.find((tech) => tech.category === 'CMS'); if (cmsTech) cms = cmsTech.name; }

  const outdatedLibraries: string[] = [];
  const findings: ScanRecommendation[] = [];

  for (const rule of LIBRARY_RULES) {
    let detectedVersion: string | undefined;
    let sourceUrl: string | undefined;
    for (const url of scriptUrls) {
      const match = url.match(rule.pattern);
      if (match) { detectedVersion = match[1]; sourceUrl = url; break; }
    }
    if (!detectedVersion) continue;

    const isOutdated = compareVersions(detectedVersion, rule.minSafe) < 0;
    add({ name: rule.name, version: detectedVersion, category: rule.category, isOutdated, cveCount: isOutdated ? rule.cveCount : undefined, confidence: 'confirmed', evidence: `Script URL: ${sourceUrl}`, latestKnown: rule.latest, advisory: isOutdated ? rule.advisory : undefined });

    if (isOutdated) {
      outdatedLibraries.push(`${rule.name} ${detectedVersion}`);
      findings.push(makeFinding({
        id: `rec-outdated-${rule.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`, title: `Outdated ${rule.name} (${detectedVersion}) in use`, severity: rule.cveCount > 0 ? 'high' : 'medium', category: 'Vulnerable Component',
        description: rule.advisory, impact: 'The vulnerable code ships to every visitor. Exploitation needs no access to your infrastructure — only a page that renders untrusted input through the affected API.',
        evidence: [{ label: 'Detected version', value: detectedVersion }, { label: 'Loaded from', value: sourceUrl ?? 'unknown' }, { label: 'First patched version', value: rule.minSafe }, { label: 'Vulnerability data as of', value: VULN_DB_AS_OF }],
        remediation: rule.latest === 'discontinued' ? `${rule.name} is end of life; plan a migration to a maintained framework.` : `Upgrade to ${rule.latest} (or at minimum ${rule.minSafe}) and re-run the scan.`,
        references: [{ label: `Snyk advisories — ${rule.name}`, url: `https://security.snyk.io/search?q=${encodeURIComponent(rule.name)}` }], cwe: 'CWE-1104', owasp: 'A06:2021 Vulnerable and Outdated Components', difficulty: 'medium', timeToFix: '1-2 hours',
      }));
    }
  }

  return { technologies, outdatedLibraries, findings, cms };
}
