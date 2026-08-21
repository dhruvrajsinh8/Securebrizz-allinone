/**
 * Set-Cookie analysis. Cookie flags are read as parsed ATTRIBUTES, not as
 * substrings of the header — `lower.includes('secure')` counts a cookie named
 * `secure_token` as protected, which inverts the finding on the cookies that
 * matter most.
 */

import type { ScanRecommendation } from '@/types/scanner';
import { makeFinding, REFS } from './findings';

export interface ParsedCookie {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  domain?: string;
  sessionScoped: boolean;
  looksSessionBearing: boolean;
}

export interface CookieAnalysis {
  httpOnly: number;
  secure: number;
  sameSite: number;
  total: number;
  issues: string[];
}

export interface CookieResult {
  analysis: CookieAnalysis;
  findings: ScanRecommendation[];
  cookies: ParsedCookie[];
  hasSessionCookie: boolean;
}

const SESSION_NAME_PATTERN = /(^|[_-])(sess|sid|session|auth|token|jwt|login|remember|identity|csrf)/i;

export function parseSetCookie(header: string): ParsedCookie {
  const segments = header.split(';');
  const [namePart] = segments;
  const name = namePart.split('=')[0]?.trim() ?? '';

  const attributes = new Map<string, string>();
  for (const segment of segments.slice(1)) {
    const [rawKey, ...rest] = segment.split('=');
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;
    attributes.set(key, rest.join('=').trim());
  }

  const sameSiteRaw = attributes.get('samesite')?.toLowerCase();
  const sameSite = sameSiteRaw === 'strict' || sameSiteRaw === 'lax' || sameSiteRaw === 'none' ? sameSiteRaw : undefined;

  return {
    name,
    httpOnly: attributes.has('httponly'),
    secure: attributes.has('secure'),
    sameSite,
    path: attributes.get('path'),
    domain: attributes.get('domain'),
    sessionScoped: !attributes.has('expires') && !attributes.has('max-age'),
    looksSessionBearing: SESSION_NAME_PATTERN.test(name),
  };
}

export function analyzeCookies(setCookieHeaders: string[], isHttps: boolean): CookieResult {
  const cookies = setCookieHeaders.map(parseSetCookie).filter((cookie) => cookie.name.length > 0);
  const issues: string[] = [];
  const findings: ScanRecommendation[] = [];

  const analysis: CookieAnalysis = {
    total: cookies.length,
    httpOnly: cookies.filter((c) => c.httpOnly).length,
    secure: cookies.filter((c) => c.secure).length,
    sameSite: cookies.filter((c) => c.sameSite !== undefined).length,
    issues,
  };

  if (cookies.length === 0) return { analysis, findings, cookies, hasSessionCookie: false };

  const sessionCookies = cookies.filter((c) => c.looksSessionBearing || (c.sessionScoped && c.httpOnly));
  const missingHttpOnly = sessionCookies.filter((c) => !c.httpOnly);
  const missingSecure = isHttps ? cookies.filter((c) => !c.secure) : [];
  const noneWithoutSecure = cookies.filter((c) => c.sameSite === 'none' && !c.secure);
  const missingSameSite = cookies.filter((c) => c.sameSite === undefined);
  const prefixViolations = cookies.filter(
    (c) => (c.name.startsWith('__Secure-') && !c.secure) || (c.name.startsWith('__Host-') && (!c.secure || c.domain || c.path !== '/'))
  );

  for (const c of missingHttpOnly) issues.push(`${c.name}: session cookie readable by JavaScript (no HttpOnly)`);
  for (const c of missingSecure) issues.push(`${c.name}: no Secure attribute on an HTTPS site`);
  for (const c of noneWithoutSecure) issues.push(`${c.name}: SameSite=None without Secure — browsers reject this cookie outright`);
  for (const c of missingSameSite) issues.push(`${c.name}: no SameSite attribute (browser default Lax applies)`);
  for (const c of prefixViolations) issues.push(`${c.name}: does not meet the requirements of its ${c.name.split('-')[0]}- prefix`);

  if (missingHttpOnly.length > 0) {
    findings.push(makeFinding({
      id: 'rec-cookie-httponly', title: 'Session cookie is readable by JavaScript', severity: 'high', category: 'Cookie Security',
      description: `${missingHttpOnly.length} session-bearing cookie(s) are set without the HttpOnly attribute.`,
      impact: 'Any successful XSS — including one introduced by a third-party script — can read the session cookie and hand the attacker a logged-in session, with no password needed and no login event recorded.',
      evidence: missingHttpOnly.map((c) => ({ label: c.name, value: renderCookie(c) })),
      remediation: 'Set HttpOnly on every cookie the client-side code does not need to read.',
      fix: [{ label: 'Express', code: "res.cookie('session', value, { httpOnly: true, secure: true, sameSite: 'lax' });" }, { label: 'Next.js (route handler)', code: "cookies().set('session', value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });" }],
      references: [REFS.cookies], cwe: 'CWE-1004', owasp: 'A05:2021 Security Misconfiguration', timeToFix: '15 mins',
    }));
  }

  if (missingSecure.length > 0) {
    findings.push(makeFinding({
      id: 'rec-cookies', title: 'Cookies sent without the Secure attribute', severity: missingSecure.some((c) => c.looksSessionBearing) ? 'high' : 'medium', category: 'Cookie Security',
      description: `${missingSecure.length} of ${cookies.length} cookie(s) on this HTTPS site lack the Secure attribute.`,
      impact: 'The browser will send these cookies over a plain HTTP request to the same host, so a single downgraded or mixed-content request exposes them to anyone on the network path.',
      evidence: missingSecure.map((c) => ({ label: c.name, value: renderCookie(c) })), remediation: 'Add Secure to every cookie set over HTTPS.',
      fix: [{ label: 'Express', code: "res.cookie('name', value, { secure: true, httpOnly: true, sameSite: 'lax' });" }], references: [REFS.cookies], cwe: 'CWE-614', timeToFix: '15 mins',
    }));
  }

  if (noneWithoutSecure.length > 0) {
    findings.push(makeFinding({
      id: 'rec-cookie-samesite-none', title: 'SameSite=None cookie without Secure is silently dropped', severity: 'high', category: 'Cookie Security',
      description: `${noneWithoutSecure.length} cookie(s) declare SameSite=None but omit Secure.`,
      impact: 'Browsers reject this combination entirely, so the cookie is never stored. Whatever depends on it — sign-in, cart state, an embedded flow — fails intermittently in ways that look like an application bug rather than a cookie policy one.',
      evidence: noneWithoutSecure.map((c) => ({ label: c.name, value: renderCookie(c) })), remediation: 'Add Secure alongside SameSite=None, or use SameSite=Lax if cross-site delivery is not required.', references: [REFS.sameSite], cwe: 'CWE-1275', timeToFix: '10 mins',
    }));
  }

  if (missingSameSite.length > 0) {
    findings.push(makeFinding({
      id: 'rec-cookie-samesite', title: 'Cookies rely on the browser default SameSite policy', severity: 'low', category: 'Cookie Security',
      description: `${missingSameSite.length} cookie(s) are set without an explicit SameSite attribute.`,
      impact: 'Current browsers default to Lax, but older clients and embedded webviews default to None, leaving those users exposed to cross-site request forgery.',
      evidence: missingSameSite.map((c) => ({ label: c.name, value: renderCookie(c) })), remediation: 'State SameSite explicitly — Lax for normal sessions, Strict for sensitive ones.', references: [REFS.sameSite], cwe: 'CWE-352', timeToFix: '10 mins',
    }));
  }

  return { analysis, findings, cookies, hasSessionCookie: sessionCookies.length > 0 };
}

function renderCookie(cookie: ParsedCookie): string {
  const attributes = [
    cookie.httpOnly ? 'HttpOnly' : null,
    cookie.secure ? 'Secure' : null,
    cookie.sameSite ? `SameSite=${cookie.sameSite}` : null,
    cookie.path ? `Path=${cookie.path}` : null,
    cookie.domain ? `Domain=${cookie.domain}` : null,
  ].filter(Boolean);
  return attributes.length > 0 ? `${cookie.name}; ${attributes.join('; ')}` : `${cookie.name} (no attributes set)`;
}
