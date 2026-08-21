/**
 * Mapping between a ScanResult and its stored row. SQLite/Postgres has no JSON
 * column here, so structured fields are stored as serialized JSON. Centralising
 * the mapping keeps the API routes from hand-writing a dozen JSON.parse calls.
 */

import type { ScanResult } from '@/types/scanner';

type ScanRow = Record<string, unknown>;

export function toScanRow(result: ScanResult) {
  return {
    url: result.url,
    scanDate: new Date(result.scanDate),
    duration: result.duration,
    overallScore: result.overallScore,
    riskScore: result.riskScore,
    dnsSecEnabled: result.dnsSecEnabled,
    httpsEnabled: result.httpsEnabled,
    hasRobotsTxt: result.hasRobotsTxt,
    hasSecurityTxt: result.hasSecurityTxt,
    mixedContent: result.mixedContent,
    weakPasswordPolicy: result.weakPasswordPolicy,
    directoryListing: result.directoryListing,
    serverInfo: result.serverInfo ?? null,
    aiSummary: result.aiSummary,
    ssl: JSON.stringify(result.ssl),
    securityHeaders: JSON.stringify(result.securityHeaders),
    openPorts: JSON.stringify(result.openPorts),
    technologies: JSON.stringify(result.technologies),
    cookieAnalysis: JSON.stringify(result.cookieAnalysis),
    outdatedLibraries: JSON.stringify(result.outdatedLibraries),
    adminPagesExposed: JSON.stringify(result.adminPagesExposed),
    subdomains: JSON.stringify(result.subdomains ?? []),
    recommendations: JSON.stringify(result.recommendations),

    grade: result.grade ?? null,
    durationMs: result.durationMs ?? null,
    finalUrl: result.finalUrl ?? null,
    httpStatus: result.httpStatus ?? null,
    cms: result.cms ?? null,
    redirectChain: JSON.stringify(result.redirectChain ?? []),
    checks: JSON.stringify(result.checks ?? []),
    dns: result.dns ? JSON.stringify(result.dns) : null,
    content: result.content ? JSON.stringify(result.content) : null,
    scoreBreakdown: JSON.stringify(result.scoreBreakdown ?? []),
    emailSecurity: result.emailSecurity ? JSON.stringify(result.emailSecurity) : null,
    subresourceIntegrity: result.subresourceIntegrity ? JSON.stringify(result.subresourceIntegrity) : null,
  };
}

export function fromScanRow(row: ScanRow): ScanResult {
  return {
    ...(row as unknown as ScanResult),
    scanDate: row.scanDate instanceof Date ? row.scanDate.toISOString() : String(row.scanDate ?? ''),
    ssl: parse(row.ssl, {} as ScanResult['ssl']),
    securityHeaders: parse(row.securityHeaders, []),
    openPorts: parse(row.openPorts, []),
    technologies: parse(row.technologies, []),
    cookieAnalysis: parse(row.cookieAnalysis, { httpOnly: 0, secure: 0, sameSite: 0, total: 0 }),
    outdatedLibraries: parse(row.outdatedLibraries, []),
    adminPagesExposed: parse(row.adminPagesExposed, []),
    subdomains: parse(row.subdomains, []),
    recommendations: parse(row.recommendations, []),
    redirectChain: parse(row.redirectChain, []),
    checks: parse(row.checks, []),
    scoreBreakdown: parse(row.scoreBreakdown, []),
    dns: parse(row.dns, undefined),
    content: parse(row.content, undefined),
    emailSecurity: parse(row.emailSecurity, undefined),
    subresourceIntegrity: parse(row.subresourceIntegrity, undefined),
    scanResultStatus: 'completed',
  };
}

function parse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
