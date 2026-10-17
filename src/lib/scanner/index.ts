/**
 * Passive security scanner.
 *
 * "Passive" means the scanner requests pages the way a browser would, reads DNS
 * records, and completes one TLS handshake. It does not port-scan, fuzz,
 * brute-force, or send any payload. Nothing is fabricated; a check that fails is
 * recorded and never becomes a finding or a score penalty.
 */

import { URL } from 'url';
import type { CheckDiagnostic, Port, ScanRecommendation, ScanResult, SslCertificate } from '@/types/scanner';
import { analyzeContent } from './content';
import { analyzeCookies } from './cookies';
import { analyzeHeaders } from './headers';
import { emptyDnsInfo, inspectDns } from './dns';
import { fingerprint } from './fingerprint';
import { buildEmailSecurity, dnsFindings, transportFindings } from './infra';
import { ALLOW_LOCAL_SCAN, DEFAULT_TIMEOUT_MS, LOCAL_TIMEOUT_MS, guardTarget, isLocalHostDomain, isValidHostname, probe } from './net';
import { buildSummary, scoreFindings, sortFindings } from './scoring';
import { inspectCertificate, notApplicableCertificate, unknownCertificate } from './tls';
import { fetchSubdomains, inspectWellKnown } from './wellknown';
import { assessPhishing } from './phishing';
import { scanAuditPorts, portFindings } from './ports';
import { correlateCves } from './cve';

export interface ScanOptions {
  /** Certificate-transparency subdomain discovery is slow; off by default. */
  includeSubdomains?: boolean;
  /** 'passive' = zero-payload browser-like requests; 'active' = authorized TCP port audit & CVE correlation. */
  scanMode?: 'passive' | 'active';
}

export async function performPassiveScan(inputUrl: string, options: ScanOptions = {}): Promise<ScanResult> {
  const includeSubdomains = options.includeSubdomains ?? false;
  const started = Date.now();
  const checks: CheckDiagnostic[] = [];

  const track = (id: string, label: string, status: CheckDiagnostic['status'], detail: string, durationMs?: number) => {
    checks.push({ id, label, status, detail, durationMs });
  };

  const raw = inputUrl.trim();
  if (!raw) return errorResult(inputUrl, inputUrl, 'invalid_domain', 'No URL was provided.', started, checks);

  const bareHost = raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  const schemeGiven = /^https?:\/\//i.test(raw);
  const normalized = schemeGiven ? raw : `${isLocalHostDomain(bareHost) ? 'http' : 'https'}://${raw}`;

  let parsedUrl: URL;
  try { parsedUrl = new URL(normalized); }
  catch { return errorResult(inputUrl, inputUrl, 'invalid_domain', 'Invalid URL format. Provide a web address such as example.com or https://example.com.', started, checks); }

  const hostname = parsedUrl.hostname;
  if (!isValidHostname(hostname)) return errorResult(normalized, hostname || inputUrl, 'invalid_domain', `"${hostname || inputUrl}" is not a valid domain name. Check for typos.`, started, checks);

  const guardStarted = Date.now();
  const guard = await guardTarget(hostname);
  if (!guard.allowed) {
    const isMissingDomain = /does not exist/i.test(guard.reason ?? '');
    track('guard', 'Target validation', isMissingDomain ? 'ok' : 'skipped', guard.reason ?? 'target refused', Date.now() - guardStarted);
    return errorResult(normalized, hostname, isMissingDomain ? 'invalid_domain' : 'blocked', guard.reason ?? 'This target cannot be scanned.', started, checks);
  }
  track('guard', 'Target validation', 'ok', guard.isLocal ? 'Local target allowed by ALLOW_LOCAL_SCAN' : `Resolved to ${guard.addresses.slice(0, 3).join(', ')}`, Date.now() - guardStarted);

  const isLocal = guard.isLocal;
  const timeoutMs = isLocal ? LOCAL_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const dnsPromise = isLocal ? Promise.resolve({ dns: emptyDnsInfo(), failures: {} as Record<string, string> }) : inspectDns(hostname);
  const ctPromise = isLocal || !includeSubdomains ? Promise.resolve({ subdomains: [] as string[], notable: [] as string[], error: undefined }) : fetchSubdomains(hostname);

  const candidates = buildCandidates(parsedUrl, schemeGiven, isLocal);
  const httpStarted = Date.now();
  let response = await probe(candidates[0], { timeoutMs });
  for (const candidate of candidates.slice(1)) {
    if (response.ok) break;
    response = await probe(candidate, { timeoutMs });
  }

  if (!response.ok) {
    track('http', 'HTTP request', 'failed', response.error ?? 'no response', Date.now() - httpStarted);
    return errorResult(normalized, hostname, 'unreachable', isLocal ? `Local server on "${hostname}" could not be reached. Confirm it is running (for example npm run dev on port 3000). Last error: ${response.error}` : `"${hostname}" resolved but did not answer over HTTP or HTTPS. Last error: ${response.error}`, started, checks);
  }

  const finalUrl = response.url;
  const finalParsed = new URL(finalUrl);
  const isHttps = finalParsed.protocol === 'https:';
  const redirectsToHttps = response.redirectChain.some((hop) => hop.startsWith('http://')) && isHttps;
  track('http', 'HTTP request', 'ok', `HTTP ${response.status} from ${finalUrl}${response.redirectChain.length > 0 ? ` after ${response.redirectChain.length} redirect(s)` : ''}`, Date.now() - httpStarted);

  let cert: SslCertificate;
  if (isHttps) {
    const tlsStarted = Date.now();
    const port = finalParsed.port ? parseInt(finalParsed.port, 10) : 443;
    const tlsResult = await inspectCertificate(hostname, port, timeoutMs);
    cert = tlsResult.cert;
    track('tls', 'TLS certificate', tlsResult.ok ? 'ok' : 'failed', tlsResult.ok ? `${cert.protocol ?? 'TLS'} · ${cert.issuer} · ${cert.daysRemaining}d remaining · chain ${cert.validated ? 'valid' : 'INVALID'}` : (tlsResult.error ?? 'handshake failed'), Date.now() - tlsStarted);
  } else {
    cert = notApplicableCertificate(hostname);
    track('tls', 'TLS certificate', 'skipped', 'Target served over plain HTTP; no certificate to inspect.');
  }

  const dnsStarted = Date.now();
  const { dns, failures: dnsFailures } = await dnsPromise;
  if (isLocal) {
    track('dns', 'DNS records', 'skipped', 'Local target; public DNS records do not apply.');
  } else {
    const failed = Object.keys(dnsFailures);
    track('dns', 'DNS records', failed.length > 0 ? 'failed' : 'ok', failed.length > 0 ? `${failed.length} lookup(s) failed: ${failed.map((key) => `${key} (${dnsFailures[key]})`).join('; ')}` : `A:${dns.ipv4.length} AAAA:${dns.ipv6.length} MX:${dns.mxHosts.length} DNSSEC:${dns.dnssec} CAA:${dns.caa.records.length}`, Date.now() - dnsStarted);
  }

  const wellKnownStarted = Date.now();
  const ctStarted = wellKnownStarted;
  const [wellKnown, ct] = await Promise.all([inspectWellKnown(finalParsed.origin, Math.min(timeoutMs, 5000)), ctPromise]);
  track('wellknown', 'robots.txt / security.txt', Object.keys(wellKnown.failures).length > 0 ? 'failed' : 'ok', `robots.txt ${wellKnown.hasRobotsTxt ? 'found' : 'not found'}, security.txt ${wellKnown.hasSecurityTxt ? 'found' : 'not found'}`, Date.now() - wellKnownStarted);
  track('ct', 'Certificate transparency', isLocal || !includeSubdomains ? 'skipped' : ct.error ? 'failed' : 'ok', isLocal ? 'Local target; no CT logs apply.' : !includeSubdomains ? 'Subdomain discovery runs separately and is loaded on demand.' : (ct.error ?? `${ct.subdomains.length} subdomain(s) found, ${ct.notable.length} notable`), Date.now() - ctStarted);

  const cookieResult = analyzeCookies(response.setCookie, isHttps);
  track('cookies', 'Cookie attributes', 'ok', cookieResult.analysis.total === 0 ? 'No cookies set on this response.' : `${cookieResult.analysis.total} cookie(s): ${cookieResult.analysis.httpOnly} HttpOnly, ${cookieResult.analysis.secure} Secure, ${cookieResult.analysis.sameSite} SameSite`);

  const headerResult = analyzeHeaders({ headers: response.headers, isHttps, hasSessionCookie: cookieResult.hasSessionCookie });
  track('headers', 'Security headers', 'ok', `${headerResult.headers.filter((h) => h.status === 'present').length} present, ${headerResult.headers.filter((h) => h.status === 'missing').length} missing, ${headerResult.headers.filter((h) => h.status === 'misconfigured').length} misconfigured`);

  const contentResult = analyzeContent(response.body, finalUrl, wellKnown.disclosedPaths);
  track('content', 'Page content', 'ok', `${(contentResult.content.htmlBytes / 1024).toFixed(1)} KB analysed · ${contentResult.sri.totalExternalScripts} external script(s) · ${contentResult.content.mixedContentItems.length} mixed-content reference(s)`);

  const fingerprintResult = fingerprint({ headers: response.headers, html: response.body, scriptUrls: contentResult.externalScriptUrls, cookieNames: cookieResult.cookies.map((cookie) => cookie.name), generator: contentResult.content.generator });
  track('fingerprint', 'Technology fingerprint', 'ok', fingerprintResult.technologies.length === 0 ? 'No technologies positively identified.' : fingerprintResult.technologies.map((tech) => `${tech.name}${tech.version ? ` ${tech.version}` : ''}`).join(', '));

  const isActive = options.scanMode === 'active';
  const activeFindings: ScanRecommendation[] = [];
  let openPorts: Port[] = [];

  const observedPort = finalParsed.port ? parseInt(finalParsed.port, 10) : isHttps ? 443 : 80;
  const webPort: Port = {
    number: observedPort,
    service: isHttps ? 'HTTPS / TLS' : 'HTTP',
    protocol: 'tcp',
    state: 'open',
    risk: isHttps ? 'info' : 'medium',
    description: isHttps ? `Encrypted web service answered on port ${observedPort}.` : `Unencrypted web service answered on port ${observedPort}.`,
    evidence: `HTTP ${response.status} response received from ${finalUrl}`,
  };

  if (isActive) {
    const portStarted = Date.now();
    const probed = await scanAuditPorts(hostname);
    if (!probed.some((p) => p.number === observedPort)) {
      probed.push(webPort);
      probed.sort((a, b) => a.number - b.number);
    }
    openPorts = probed;
    activeFindings.push(...portFindings(openPorts, hostname));
    track('ports', 'TCP Port Audit', 'ok', `${openPorts.length} open port(s) detected across top common services`, Date.now() - portStarted);

    const cveStarted = Date.now();
    const cveResult = await correlateCves(fingerprintResult.technologies);
    fingerprintResult.technologies = cveResult.technologies;
    activeFindings.push(...cveResult.findings);
    track('cve', 'CVE & Vulnerability Correlation', 'ok', `${cveResult.findings.length} advisory/CVE finding(s) matched`, Date.now() - cveStarted);
  } else {
    openPorts = [webPort];
    track('ports', 'TCP Port Audit', 'skipped', 'Passive mode: deep port scan omitted.');
    track('cve', 'CVE & Vulnerability Correlation', 'skipped', 'Passive mode: active CVE correlation omitted.');
  }

  const findings: ScanRecommendation[] = [
    ...transportFindings({ cert, isHttps, hostname, finalUrl, redirectsToHttps }),
    ...headerResult.findings,
    ...cookieResult.findings,
    ...contentResult.findings,
    ...fingerprintResult.findings,
    ...wellKnown.findings,
    ...(isLocal ? [] : dnsFindings({ dns, hostname, failures: dnsFailures })),
    ...activeFindings,
  ];

  const ordered = sortFindings(findings);
  const { score, riskScore, grade, breakdown } = scoreFindings(ordered);
  const durationMs = Date.now() - started;

  const phishingStarted = Date.now();
  const phishing = assessPhishing({ hostname, finalUrl, html: response.body, isHttps, cert, hasLoginForm: contentResult.content.passwordFieldCount > 0 });
  track('phishing', 'Phishing / spoofing check', 'ok', `${phishing.verdict.replace('_', ' ')} (risk ${phishing.riskScore}/100)`, Date.now() - phishingStarted);

  const serverInfo = [response.headers['server'], response.headers['x-powered-by'], guard.addresses[0] ? `IP: ${guard.addresses[0]}` : ''].filter(Boolean).join(' | ') || (isLocal ? 'Local development server' : 'No server banner disclosed');

  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: finalUrl, finalUrl, redirectChain: response.redirectChain, httpStatus: response.status,
    scanDate: new Date().toISOString(), duration: Math.max(1, Math.round(durationMs / 1000)), durationMs,
    overallScore: score, riskScore, grade, scanResultStatus: 'completed',
    ssl: cert, securityHeaders: headerResult.headers, openPorts, technologies: fingerprintResult.technologies, cms: fingerprintResult.cms,
    dnsSecEnabled: dns.dnssec === 'validated', httpsEnabled: isHttps, hasRobotsTxt: wellKnown.hasRobotsTxt, hasSecurityTxt: wellKnown.hasSecurityTxt,
    cookieAnalysis: cookieResult.analysis, mixedContent: contentResult.content.mixedContentItems.length > 0, outdatedLibraries: fingerprintResult.outdatedLibraries,
    weakPasswordPolicy: contentResult.content.passwordFieldCount > 0 && !isHttps, adminPagesExposed: wellKnown.disclosedPaths, directoryListing: contentResult.content.directoryListing, serverInfo,
    aiSummary: buildSummary({ hostname, findings: ordered, score, grade, checks, durationMs }),
    subdomains: ct.subdomains, recommendations: ordered, emailSecurity: buildEmailSecurity(dns, !isLocal && !dnsFailures['dns.txt']), subresourceIntegrity: contentResult.sri,
    dns: isLocal ? undefined : dns, content: contentResult.content, checks, scoreBreakdown: breakdown, phishing, scanMode: options.scanMode ?? 'passive',
  };
}

function buildCandidates(parsedUrl: URL, schemeGiven: boolean, isLocal: boolean): string[] {
  if (isLocal && !parsedUrl.port && ALLOW_LOCAL_SCAN) {
    const host = parsedUrl.hostname;
    return [`http://${host}:3000`, `http://${host}:8000`, `http://${host}:8080`, `http://${host}`, `https://${host}`];
  }
  const primary = parsedUrl.toString();
  if (schemeGiven) return [primary];
  const fallback = new URL(primary);
  fallback.protocol = 'http:';
  return [primary, fallback.toString()];
}

function errorResult(url: string, hostname: string, status: 'invalid_domain' | 'unreachable' | 'blocked', errorMessage: string, started: number, checks: CheckDiagnostic[]): ScanResult {
  const durationMs = Date.now() - started;
  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, url,
    scanDate: new Date().toISOString(), duration: Math.max(1, Math.round(durationMs / 1000)), durationMs,
    overallScore: 0, riskScore: 0, grade: 'F', scanResultStatus: status, errorMessage,
    ssl: unknownCertificate(hostname, 'Scan did not complete.'), securityHeaders: [], openPorts: [], technologies: [],
    dnsSecEnabled: false, httpsEnabled: false, hasRobotsTxt: false, hasSecurityTxt: false,
    cookieAnalysis: { httpOnly: 0, secure: 0, sameSite: 0, total: 0, issues: [] }, mixedContent: false, outdatedLibraries: [],
    weakPasswordPolicy: false, adminPagesExposed: [], directoryListing: false, serverInfo: undefined,
    aiSummary: `Scan of ${hostname} did not complete. ${errorMessage}`, subdomains: [], recommendations: [], checks,
  };
}
