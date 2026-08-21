/**
 * HTTP security header analysis.
 *
 * The important difference from a presence check: a header can be present and
 * still do nothing. `max-age=0` disables HSTS, a CSP full of `unsafe-inline`
 * stops almost no XSS, `Referrer-Policy: unsafe-url` leaks URLs. Each of those
 * scores full marks under a presence check and is graded `misconfigured` here.
 */

import type { ScanRecommendation, SecurityHeader } from '@/types/scanner';
import { headerFix, makeFinding, REFS } from './findings';

const HSTS_MIN_MAX_AGE = 15_552_000;

export interface HeaderAnalysisInput {
  headers: Record<string, string>;
  isHttps: boolean;
  hasSessionCookie: boolean;
}

export interface HeaderAnalysis {
  headers: SecurityHeader[];
  findings: ScanRecommendation[];
  disclosures: string[];
}

export function analyzeHeaders({ headers, isHttps, hasSessionCookie }: HeaderAnalysisInput): HeaderAnalysis {
  const rows: SecurityHeader[] = [];
  const findings: ScanRecommendation[] = [];

  const csp = analyzeCsp(headers, rows, findings);
  analyzeHsts(headers, isHttps, rows, findings);
  analyzeFraming(headers, csp.hasFrameAncestors, rows, findings);
  analyzeNosniff(headers, rows, findings);
  analyzeReferrerPolicy(headers, rows, findings);
  analyzePermissionsPolicy(headers, rows, findings);
  analyzeCrossOriginIsolation(headers, rows);
  analyzeCors(headers, rows, findings);
  analyzeLegacyXss(headers, rows, findings);
  analyzeCacheOfAuthenticatedResponse(headers, hasSessionCookie, findings);
  const disclosures = analyzeDisclosure(headers, findings);

  return { headers: rows, findings, disclosures };
}

function analyzeHsts(headers: Record<string, string>, isHttps: boolean, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const value = headers['strict-transport-security'];
  const base = {
    name: 'Strict-Transport-Security',
    recommendation: 'Set max-age=31536000; includeSubDomains; preload.',
    severity: 'high' as const,
    description: 'Forces browsers to use HTTPS, preventing downgrade and cookie-hijacking attacks.',
  };

  if (!isHttps) {
    rows.push({ ...base, status: 'unknown', value, issue: 'Not evaluated: the target was served over plain HTTP, where browsers ignore HSTS.' });
    return;
  }

  if (!value) {
    rows.push({ ...base, status: 'missing' });
    findings.push(makeFinding({
      id: 'rec-hsts', title: 'Enable HTTP Strict Transport Security (HSTS)', severity: 'high', category: 'Transport Security',
      description: 'The site is served over HTTPS but does not send a Strict-Transport-Security header.',
      impact: 'A visitor\'s first request, or any request typed without "https://", can be intercepted and downgraded to HTTP on a hostile network, exposing session cookies before the redirect happens.',
      evidence: [{ label: 'Strict-Transport-Security', value: 'not present in response' }],
      remediation: 'Send Strict-Transport-Security with a max-age of at least six months, then add includeSubDomains and preload once subdomains are confirmed HTTPS-only.',
      fix: headerFix('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'),
      references: [REFS.hsts, REFS.tls], cwe: 'CWE-319', owasp: 'A02:2021 Cryptographic Failures', timeToFix: '15 mins',
    }));
    return;
  }

  const maxAgeMatch = value.match(/max-age\s*=\s*"?(\d+)"?/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;
  const includeSubDomains = /includesubdomains/i.test(value);
  const preload = /preload/i.test(value);

  if (maxAge === null || maxAge === 0) {
    const issue = maxAge === 0 ? 'max-age=0 actively instructs browsers to forget the HSTS policy, disabling the protection.' : 'Header has no max-age directive, so browsers ignore it entirely.';
    rows.push({ ...base, status: 'misconfigured', value, issue });
    findings.push(makeFinding({
      id: 'rec-hsts-disabled', title: 'HSTS header present but disabled', severity: 'high', category: 'Transport Security',
      description: issue, impact: 'The site appears to have HSTS configured, so the gap is unlikely to be noticed in review, yet browsers get no HTTPS enforcement at all.',
      evidence: [{ label: 'Strict-Transport-Security', value }], remediation: 'Set a real max-age of at least 15552000 seconds (six months).',
      fix: headerFix('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'), references: [REFS.hsts], cwe: 'CWE-319', owasp: 'A02:2021 Cryptographic Failures',
    }));
    return;
  }

  if (maxAge < HSTS_MIN_MAX_AGE) {
    const issue = `max-age=${maxAge} is below the six-month (15552000s) minimum required for the preload list.`;
    rows.push({ ...base, status: 'misconfigured', value, issue });
    findings.push(makeFinding({
      id: 'rec-hsts-short', title: 'HSTS max-age is too short', severity: 'medium', category: 'Transport Security',
      description: issue, impact: 'The HTTPS-only guarantee expires sooner than the preload list requires, and a visitor who has not returned within that window is exposed to downgrade again.',
      evidence: [{ label: 'Strict-Transport-Security', value }], remediation: 'Raise max-age to 31536000 (one year).',
      fix: headerFix('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'), references: [REFS.hsts], cwe: 'CWE-319',
    }));
    return;
  }

  if (!includeSubDomains) {
    rows.push({ ...base, status: 'present', value, issue: 'includeSubDomains is absent, so subdomains are not covered by the policy.' });
    findings.push(makeFinding({
      id: 'rec-hsts-subdomains', title: 'HSTS does not cover subdomains', severity: 'low', category: 'Transport Security',
      description: 'The HSTS policy omits the includeSubDomains directive.', impact: 'A subdomain served over HTTP can be used to set or read cookies scoped to the parent domain, sidestepping the HTTPS guarantee on the main site.',
      evidence: [{ label: 'Strict-Transport-Security', value }], remediation: 'Add includeSubDomains once every subdomain is confirmed to serve HTTPS, then submit to the preload list.',
      fix: headerFix('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'), references: [REFS.hsts],
    }));
    return;
  }

  rows.push({ ...base, status: 'present', value, issue: preload ? undefined : 'Eligible for the HSTS preload list but not marked preload.' });
}

interface CspSummary { hasFrameAncestors: boolean; }

function analyzeCsp(headers: Record<string, string>, rows: SecurityHeader[], findings: ScanRecommendation[]): CspSummary {
  const enforced = headers['content-security-policy'];
  const reportOnly = headers['content-security-policy-report-only'];
  const base = {
    name: 'Content-Security-Policy',
    recommendation: "Start from default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none' and add sources deliberately.",
    severity: 'high' as const,
    description: 'Restricts where scripts, styles and frames may load from — the main defence against XSS.',
  };

  if (!enforced && reportOnly) {
    const issue = 'Only Content-Security-Policy-Report-Only is set. Violations are reported but nothing is blocked.';
    rows.push({ ...base, status: 'misconfigured', value: reportOnly, issue });
    findings.push(makeFinding({
      id: 'rec-csp-report-only', title: 'Content Security Policy is in report-only mode', severity: 'medium', category: 'Header Security',
      description: issue, impact: 'The policy has been written and tested but never enforced, so an injected script executes exactly as it would with no CSP at all.',
      evidence: [{ label: 'Content-Security-Policy-Report-Only', value: reportOnly }], remediation: 'Once the report stream is clean, send the same policy in the enforcing Content-Security-Policy header.',
      fix: headerFix('Content-Security-Policy', reportOnly.slice(0, 120)), references: [REFS.csp, REFS.cspCheatSheet], cwe: 'CWE-1021', owasp: 'A05:2021 Security Misconfiguration', difficulty: 'medium',
    }));
    return { hasFrameAncestors: /frame-ancestors/i.test(reportOnly) };
  }

  if (!enforced) {
    rows.push({ ...base, status: 'missing' });
    findings.push(makeFinding({
      id: 'rec-csp', title: 'Configure a Content Security Policy', severity: 'high', category: 'Header Security',
      description: 'No Content-Security-Policy header is sent.', impact: 'Any successful HTML or script injection runs with full privileges: it can exfiltrate session tokens, rewrite the page, or load an attacker-controlled script from any origin.',
      evidence: [{ label: 'Content-Security-Policy', value: 'not present in response' }], remediation: "Deploy a policy in report-only mode first, then enforce it. Start with default-src 'self'; object-src 'none'; base-uri 'self'.",
      fix: headerFix('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"), references: [REFS.csp, REFS.cspCheatSheet], cwe: 'CWE-1021', owasp: 'A05:2021 Security Misconfiguration', difficulty: 'medium', timeToFix: '1-2 hours',
    }));
    return { hasFrameAncestors: false };
  }

  const directives = parseCsp(enforced);
  const scriptSrc = directives.get('script-src') ?? directives.get('default-src') ?? [];
  const objectSrc = directives.get('object-src') ?? directives.get('default-src') ?? [];
  const issues: string[] = [];
  let severity: 'high' | 'medium' | 'low' = 'low';
  const hasNonceOrHash = scriptSrc.some((source) => source.startsWith("'nonce-") || source.startsWith("'sha"));

  if (scriptSrc.includes("'unsafe-inline'") && !hasNonceOrHash) { issues.push("script-src allows 'unsafe-inline', which permits exactly the injected inline scripts CSP exists to block."); severity = 'high'; }
  if (scriptSrc.includes("'unsafe-eval'")) { issues.push("script-src allows 'unsafe-eval', re-enabling string-to-code execution."); if (severity !== 'high') severity = 'medium'; }
  if (scriptSrc.includes('*') || scriptSrc.includes('https:') || scriptSrc.includes('http:')) { issues.push('script-src permits any host, so scripts may be loaded from an attacker-controlled origin.'); severity = 'high'; }
  if (directives.size > 0 && !directives.has('default-src') && !directives.has('script-src')) { issues.push('Neither default-src nor script-src is set, so script loading is unrestricted.'); severity = 'high'; }
  if (objectSrc.length > 0 && !objectSrc.includes("'none'")) { issues.push("object-src is not 'none'; legacy plugin content can still be embedded."); if (severity === 'low') severity = 'medium'; }
  if (!directives.has('base-uri')) { issues.push("base-uri is not set, so an injected <base> tag can re-target every relative URL on the page."); if (severity === 'low') severity = 'medium'; }

  if (issues.length === 0) {
    rows.push({ ...base, status: 'present', value: enforced });
  } else {
    rows.push({ ...base, status: 'misconfigured', value: enforced, issue: issues[0] });
    findings.push(makeFinding({
      id: 'rec-csp-weak', title: 'Content Security Policy is present but weakened', severity, category: 'Header Security',
      description: issues.join(' '), impact: 'The policy passes a presence check and appears on compliance reports as configured, while leaving the specific gaps above open to script injection.',
      evidence: [{ label: 'Content-Security-Policy', value: enforced }, ...(scriptSrc.length > 0 ? [{ label: 'Effective script-src', value: scriptSrc.join(' ') }] : [])],
      remediation: "Replace 'unsafe-inline' with per-request nonces or hashes, drop 'unsafe-eval', pin script-src to explicit origins, and set base-uri 'self' and object-src 'none'.",
      fix: headerFix('Content-Security-Policy', "default-src 'self'; script-src 'self' 'nonce-{RANDOM}'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"), references: [REFS.csp, REFS.cspCheatSheet], cwe: 'CWE-1021', owasp: 'A05:2021 Security Misconfiguration', difficulty: 'medium', timeToFix: '1-2 hours',
    }));
  }

  return { hasFrameAncestors: directives.has('frame-ancestors') };
}

function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

function analyzeFraming(headers: Record<string, string>, hasFrameAncestors: boolean, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const value = headers['x-frame-options'];
  const base = { name: 'X-Frame-Options', recommendation: "Set X-Frame-Options: DENY, or CSP frame-ancestors 'none'.", severity: 'medium' as const, description: 'Prevents the page being embedded in a hostile iframe for clickjacking.' };
  const normalized = value?.trim().toUpperCase();
  const validXfo = normalized === 'DENY' || normalized === 'SAMEORIGIN';

  if (value && !validXfo) {
    const issue = `"${value}" is not a value browsers honour (only DENY and SAMEORIGIN are supported), so the page is framable.`;
    rows.push({ ...base, status: 'misconfigured', value, issue });
    if (!hasFrameAncestors) {
      findings.push(makeFinding({
        id: 'rec-xframe-invalid', title: 'X-Frame-Options value is not honoured by browsers', severity: 'medium', category: 'Header Security',
        description: issue, impact: 'The site looks protected against clickjacking in configuration review, but an attacker can still frame it and overlay invisible controls over real ones.',
        evidence: [{ label: 'X-Frame-Options', value }], remediation: "Use X-Frame-Options: DENY plus CSP frame-ancestors 'none'.", fix: headerFix('X-Frame-Options', 'DENY'), references: [REFS.clickjacking], cwe: 'CWE-1021',
      }));
    }
    return;
  }
  if (validXfo) { rows.push({ ...base, status: 'present', value }); return; }
  if (hasFrameAncestors) { rows.push({ ...base, status: 'present', value: 'superseded by CSP frame-ancestors', issue: 'X-Frame-Options is absent, but CSP frame-ancestors provides equivalent protection.' }); return; }

  rows.push({ ...base, status: 'missing' });
  findings.push(makeFinding({
    id: 'rec-xframe', title: 'Page can be embedded in a hostile frame', severity: 'medium', category: 'Header Security',
    description: 'Neither X-Frame-Options nor CSP frame-ancestors is set.', impact: 'An attacker can load the site in a transparent iframe over their own page so that a victim\'s clicks land on real controls — approving a transfer, changing a setting, granting access.',
    evidence: [{ label: 'X-Frame-Options', value: 'not present in response' }, { label: 'CSP frame-ancestors', value: 'not present in response' }],
    remediation: "Send X-Frame-Options: DENY and CSP frame-ancestors 'none'. Use SAMEORIGIN only if the app frames itself.", fix: headerFix('X-Frame-Options', 'DENY'), references: [REFS.clickjacking], cwe: 'CWE-1021', owasp: 'A05:2021 Security Misconfiguration', timeToFix: '10 mins',
  }));
}

function analyzeNosniff(headers: Record<string, string>, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const value = headers['x-content-type-options'];
  const base = { name: 'X-Content-Type-Options', recommendation: 'Set X-Content-Type-Options: nosniff.', severity: 'medium' as const, description: 'Stops browsers second-guessing declared content types.' };
  if (value && value.trim().toLowerCase() === 'nosniff') { rows.push({ ...base, status: 'present', value }); return; }
  if (value) { rows.push({ ...base, status: 'misconfigured', value, issue: `"${value}" is not a recognised value; nosniff is the only one browsers act on.` }); }
  else { rows.push({ ...base, status: 'missing' }); }
  findings.push(makeFinding({
    id: 'rec-nosniff', title: 'Enable X-Content-Type-Options: nosniff', severity: 'medium', category: 'Header Security',
    description: value ? `X-Content-Type-Options is set to "${value}" rather than nosniff.` : 'X-Content-Type-Options is not sent.',
    impact: 'A user-uploaded file served as text or an image can be re-interpreted by the browser as HTML or JavaScript and executed in your origin.',
    evidence: [{ label: 'X-Content-Type-Options', value: value ?? 'not present in response' }], remediation: 'Send X-Content-Type-Options: nosniff on every response.', fix: headerFix('X-Content-Type-Options', 'nosniff'), references: [REFS.nosniff], cwe: 'CWE-430', timeToFix: '5 mins',
  }));
}

const LEAKY_REFERRER_POLICIES = new Set(['unsafe-url', 'no-referrer-when-downgrade', 'origin-when-cross-origin']);

function analyzeReferrerPolicy(headers: Record<string, string>, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const value = headers['referrer-policy'];
  const base = { name: 'Referrer-Policy', recommendation: 'Set Referrer-Policy: strict-origin-when-cross-origin.', severity: 'low' as const, description: 'Controls how much URL information is sent to other sites.' };
  if (!value) {
    rows.push({ ...base, status: 'missing' });
    findings.push(makeFinding({
      id: 'rec-referrer', title: 'Set an explicit Referrer-Policy', severity: 'low', category: 'Header Security',
      description: 'No Referrer-Policy header is sent, leaving the browser default in effect.', impact: 'URLs containing reset tokens, invite codes or internal identifiers can be sent to any third-party resource the page loads.',
      evidence: [{ label: 'Referrer-Policy', value: 'not present in response' }], remediation: 'Send Referrer-Policy: strict-origin-when-cross-origin.', fix: headerFix('Referrer-Policy', 'strict-origin-when-cross-origin'), references: [REFS.referrerPolicy], cwe: 'CWE-200', timeToFix: '5 mins',
    }));
    return;
  }
  const normalized = value.trim().toLowerCase();
  if (LEAKY_REFERRER_POLICIES.has(normalized)) {
    const issue = normalized === 'unsafe-url' ? 'unsafe-url sends the full URL, including path and query string, to every destination.' : `${normalized} still discloses the full URL to cross-origin destinations.`;
    rows.push({ ...base, status: 'misconfigured', value, issue });
    findings.push(makeFinding({
      id: 'rec-referrer-leaky', title: 'Referrer-Policy leaks full URLs to third parties', severity: normalized === 'unsafe-url' ? 'medium' : 'low', category: 'Header Security',
      description: issue, impact: 'Any secret carried in a URL — password reset tokens, signed download links, internal record ids — reaches every analytics, font and ad host the page contacts.',
      evidence: [{ label: 'Referrer-Policy', value }], remediation: 'Use strict-origin-when-cross-origin, or no-referrer for sensitive flows.', fix: headerFix('Referrer-Policy', 'strict-origin-when-cross-origin'), references: [REFS.referrerPolicy], cwe: 'CWE-200',
    }));
    return;
  }
  rows.push({ ...base, status: 'present', value });
}

function analyzePermissionsPolicy(headers: Record<string, string>, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const value = headers['permissions-policy'] ?? headers['feature-policy'];
  const base = { name: 'Permissions-Policy', recommendation: 'Deny unused browser features, e.g. camera=(), microphone=(), geolocation=().', severity: 'low' as const, description: 'Restricts access to powerful browser APIs for the page and its frames.' };
  if (value) { rows.push({ ...base, status: 'present', value, issue: headers['permissions-policy'] ? undefined : 'Uses the superseded Feature-Policy header name.' }); return; }
  rows.push({ ...base, status: 'missing' });
  findings.push(makeFinding({
    id: 'rec-permissions-policy', title: 'Restrict browser features with Permissions-Policy', severity: 'low', category: 'Header Security',
    description: 'No Permissions-Policy header is sent.', impact: 'Injected or third-party code embedded in the page can request camera, microphone or geolocation access under your origin\'s name.',
    evidence: [{ label: 'Permissions-Policy', value: 'not present in response' }], remediation: 'Deny every feature the site does not use.', fix: headerFix('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()'), references: [REFS.permissionsPolicy], timeToFix: '10 mins',
  }));
}

function analyzeCrossOriginIsolation(headers: Record<string, string>, rows: SecurityHeader[]): void {
  const coop = headers['cross-origin-opener-policy'];
  rows.push({ name: 'Cross-Origin-Opener-Policy', status: coop ? 'present' : 'missing', value: coop, recommendation: 'Set Cross-Origin-Opener-Policy: same-origin to isolate the browsing context.', severity: 'low', description: 'Isolates the window from cross-origin openers, a prerequisite for defence against Spectre-class attacks.' });
  const corp = headers['cross-origin-resource-policy'];
  rows.push({ name: 'Cross-Origin-Resource-Policy', status: corp ? 'present' : 'missing', value: corp, recommendation: 'Set Cross-Origin-Resource-Policy: same-origin for non-public resources.', severity: 'low', description: 'Stops other origins embedding this response.' });
}

function analyzeCors(headers: Record<string, string>, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const acao = headers['access-control-allow-origin'];
  if (!acao) return;
  const credentials = (headers['access-control-allow-credentials'] ?? '').trim().toLowerCase() === 'true';
  const wildcard = acao.trim() === '*';
  const nullOrigin = acao.trim().toLowerCase() === 'null';

  rows.push({
    name: 'Access-Control-Allow-Origin', status: wildcard || nullOrigin ? 'misconfigured' : 'present', value: acao,
    recommendation: 'Reflect only an explicit allow-list of trusted origins.', severity: credentials ? 'high' : 'medium', description: 'Controls which other origins may read this response.',
    issue: wildcard ? 'Any origin on the internet may read responses from this endpoint.' : nullOrigin ? '"null" is sent by sandboxed iframes and opaque origins, so any attacker page can obtain it.' : undefined,
  });

  if (wildcard && credentials) {
    findings.push(makeFinding({
      id: 'rec-cors-credentials', title: 'CORS allows any origin together with credentials', severity: 'critical', category: 'Access Control',
      description: 'Access-Control-Allow-Origin is "*" while Access-Control-Allow-Credentials is true.',
      impact: 'This combination signals an origin-reflecting CORS implementation. Where the reflection is dynamic, any site a logged-in user visits can read authenticated responses — session data, account details, API results — straight out of your origin.',
      evidence: [{ label: 'Access-Control-Allow-Origin', value: acao }, { label: 'Access-Control-Allow-Credentials', value: 'true' }],
      remediation: 'Never combine credentials with a wildcard or a reflected origin. Validate the Origin header against an explicit allow-list and echo back only matches.', references: [REFS.cors], cwe: 'CWE-942', owasp: 'A01:2021 Broken Access Control', difficulty: 'medium', timeToFix: '30 mins',
    }));
    return;
  }
  if (wildcard || nullOrigin) {
    findings.push(makeFinding({
      id: 'rec-cors-wildcard', title: nullOrigin ? 'CORS allows the "null" origin' : 'CORS allows any origin', severity: 'medium', category: 'Access Control',
      description: `Access-Control-Allow-Origin is "${acao.trim()}".`,
      impact: nullOrigin ? 'Sandboxed iframes and data: URLs present a null origin, so an attacker-controlled page can read these responses.' : 'Any website can read responses from this origin. Harmless for genuinely public data, a disclosure route for anything else served from the same host.',
      evidence: [{ label: 'Access-Control-Allow-Origin', value: acao }], remediation: 'Restrict the header to an explicit list of trusted origins.', references: [REFS.cors], cwe: 'CWE-942', difficulty: 'medium',
    }));
  }
}

function analyzeLegacyXss(headers: Record<string, string>, rows: SecurityHeader[], findings: ScanRecommendation[]): void {
  const value = headers['x-xss-protection'];
  if (!value) return;
  const enabled = value.trim().startsWith('1');
  rows.push({ name: 'X-XSS-Protection', status: enabled ? 'misconfigured' : 'present', value, recommendation: 'Remove the header, or set it to 0, and rely on CSP.', severity: 'low', description: 'Legacy browser XSS auditor, removed from modern browsers.', issue: enabled ? 'The legacy auditor is enabled; it was removed from browsers because it introduced its own information-disclosure bugs.' : undefined });
  if (enabled) {
    findings.push(makeFinding({
      id: 'rec-legacy-xss', title: 'Remove the deprecated X-XSS-Protection filter', severity: 'low', category: 'Header Security',
      description: `X-XSS-Protection is set to "${value}".`, impact: 'The filter is ignored by current browsers and, in the versions that implemented it, could be abused to selectively disable legitimate scripts or leak cross-origin data.',
      evidence: [{ label: 'X-XSS-Protection', value }], remediation: 'Delete the header (or send 0) and rely on Content-Security-Policy.', fix: headerFix('X-XSS-Protection', '0'), references: [REFS.xssProtection], timeToFix: '5 mins',
    }));
  }
}

function analyzeCacheOfAuthenticatedResponse(headers: Record<string, string>, hasSessionCookie: boolean, findings: ScanRecommendation[]): void {
  if (!hasSessionCookie) return;
  const cacheControl = (headers['cache-control'] ?? '').toLowerCase();
  if (/no-store|private/.test(cacheControl)) return;
  findings.push(makeFinding({
    id: 'rec-cache-session', title: 'Response carrying a session cookie is cacheable', severity: 'medium', category: 'Header Security',
    description: cacheControl ? `The response sets a session cookie while Cache-Control is "${cacheControl}".` : 'The response sets a session cookie and sends no Cache-Control header.',
    impact: 'Shared caches and proxies may store the response and serve one user\'s authenticated page — and their Set-Cookie header — to the next visitor.',
    evidence: [{ label: 'Cache-Control', value: headers['cache-control'] ?? 'not present in response' }, { label: 'Set-Cookie', value: 'session-bearing cookie observed' }],
    remediation: 'Send Cache-Control: no-store on any response that sets or depends on a session cookie.', fix: headerFix('Cache-Control', 'no-store'), references: [REFS.cookies], cwe: 'CWE-525', timeToFix: '15 mins',
  }));
}

const VERSION_PATTERN = /\d+\.\d+/;

function analyzeDisclosure(headers: Record<string, string>, findings: ScanRecommendation[]): string[] {
  const banners: { header: string; value: string }[] = [];
  for (const name of ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']) {
    const value = headers[name];
    if (value) banners.push({ header: name, value });
  }
  if (banners.length === 0) return [];

  const versioned = banners.filter((banner) => VERSION_PATTERN.test(banner.value));
  const severity = versioned.length > 0 ? 'medium' : 'low';

  findings.push(makeFinding({
    id: 'rec-info-leak', title: versioned.length > 0 ? 'Server software version disclosed in response headers' : 'Server technology disclosed in response headers', severity, category: 'Information Disclosure',
    description: `Response advertises ${banners.map((b) => `${b.header}: ${b.value}`).join(', ')}.`,
    impact: versioned.length > 0 ? 'An exact version lets an attacker look up known CVEs for that build and skip reconnaissance entirely, going straight to a working exploit.' : 'Naming the stack narrows an attacker\'s search space to exploits that apply to this technology.',
    evidence: banners.map((banner) => ({ label: banner.header, value: banner.value })),
    remediation: 'Suppress or genericise these headers: server_tokens off in Nginx, ServerTokens Prod in Apache, poweredByHeader: false in Next.js, app.disable("x-powered-by") in Express.',
    fix: [
      { label: 'Nginx', code: 'server_tokens off;' },
      { label: 'Apache', code: 'ServerTokens Prod\nServerSignature Off' },
      { label: 'Next.js (next.config.ts)', code: 'const nextConfig = {\n  poweredByHeader: false,\n};' },
      { label: 'Express', code: "app.disable('x-powered-by');" },
    ],
    references: [{ label: 'OWASP — Fingerprint Web Server', url: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server' }],
    cwe: 'CWE-200', timeToFix: '10 mins',
  }));

  return banners.map((banner) => `${banner.header}: ${banner.value}`);
}
