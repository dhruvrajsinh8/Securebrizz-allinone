import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import { fromScanRow } from '@/lib/scanner/persistence';
import type { ScanResult } from '@/types/scanner';

export const runtime = 'nodejs';

/**
 * Attack surface: what is externally reachable and observable for each scanned
 * host. Replaces the old invented "Threats" data — a passive scanner cannot
 * observe attacks against a site it does not host. Everything here is derived
 * from stored scan results.
 */

export interface Exposure {
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface TargetSurface {
  host: string;
  url: string;
  lastScanAt: string;
  score: number;
  grade: string | null;
  httpsEnabled: boolean;
  httpStatus: number | null;
  addresses: string[];
  nameservers: string[];
  mxHosts: string[];
  dnssec: string;
  caa: string[];
  technologies: { name: string; version?: string; isOutdated: boolean; category: string }[];
  ports: { number: number; service: string; risk: string }[];
  disclosedPaths: string[];
  thirdPartyOrigins: string[];
  exposures: Exposure[];
}

function hostOf(result: ScanResult): string {
  try { return new URL(result.finalUrl ?? result.url).hostname; } catch { return result.url; }
}

function deriveExposures(result: ScanResult): Exposure[] {
  const exposures: Exposure[] = [];
  if (!result.httpsEnabled) exposures.push({ label: 'Unencrypted transport', detail: 'Served over plain HTTP, so all traffic is readable and modifiable in transit.', severity: 'critical' });
  for (const library of result.outdatedLibraries ?? []) exposures.push({ label: 'Outdated component', detail: `${library} is shipped to every visitor and has known published vulnerabilities.`, severity: 'high' });
  if ((result.adminPagesExposed?.length ?? 0) > 0) exposures.push({ label: 'Administrative paths disclosed', detail: `robots.txt names ${result.adminPagesExposed.length} path(s) that look administrative. It is the first file an attacker reads.`, severity: 'low' });
  if (result.directoryListing) exposures.push({ label: 'Directory listing enabled', detail: 'The server returns a browsable file index, exposing files that were never linked.', severity: 'medium' });

  const dns = result.dns;
  if (dns) {
    if (dns.dnssec === 'unsigned') exposures.push({ label: 'DNS not signed', detail: 'DNSSEC is not enabled, so DNS answers for this domain cannot be cryptographically verified.', severity: 'low' });
    if (!dns.caa.present) exposures.push({ label: 'Certificate issuance unrestricted', detail: 'No CAA record, so any public certificate authority may issue a certificate for this domain.', severity: 'low' });
    if (dns.mxHosts.length > 0 && !dns.dmarc.present) exposures.push({ label: 'Domain spoofable', detail: 'The domain receives mail but publishes no DMARC record, so anyone can send email appearing to come from it.', severity: 'high' });
  }

  const banner = result.serverInfo ?? '';
  if (/\d+\.\d+/.test(banner)) exposures.push({ label: 'Software version disclosed', detail: `Response headers advertise an exact version (${banner.split('|')[0].trim()}), which maps directly onto published CVE lists.`, severity: 'medium' });

  const sri = result.subresourceIntegrity;
  if (sri && sri.missingSriCount > 0) exposures.push({ label: 'Unverified third-party code', detail: `${sri.missingSriCount} external script(s) load without integrity hashes. A compromise of those hosts executes in this origin.`, severity: 'high' });

  return exposures;
}

function thirdPartyOrigins(result: ScanResult): string[] {
  const urls = [...(result.subresourceIntegrity?.unprotectedScriptUrls ?? []), ...(result.subresourceIntegrity?.unprotectedStyleUrls ?? [])];
  const origins = new Set<string>();
  for (const url of urls) { try { origins.add(new URL(url).host); } catch { /* skip */ } }
  return Array.from(origins).sort();
}

export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const rows = await prisma.scanResult.findMany({ where: { userId: userIdOrError }, orderBy: { scanDate: 'desc' }, take: 200 });
    const latestByHost = new Map<string, ScanResult>();
    for (const row of rows) {
      const result = fromScanRow(row);
      const host = hostOf(result);
      if (!latestByHost.has(host)) latestByHost.set(host, result);
    }

    const targets: TargetSurface[] = Array.from(latestByHost.entries()).map(([host, result]) => ({
      host, url: result.finalUrl ?? result.url, lastScanAt: result.scanDate, score: result.overallScore, grade: result.grade ?? null,
      httpsEnabled: result.httpsEnabled, httpStatus: result.httpStatus ?? null,
      addresses: [...(result.dns?.ipv4 ?? []), ...(result.dns?.ipv6 ?? [])], nameservers: result.dns?.nameservers ?? [], mxHosts: result.dns?.mxHosts ?? [],
      dnssec: result.dns?.dnssec ?? 'unknown', caa: result.dns?.caa.records ?? [],
      technologies: (result.technologies ?? []).map((tech) => ({ name: tech.name, version: tech.version, isOutdated: tech.isOutdated, category: tech.category })),
      ports: (result.openPorts ?? []).map((port) => ({ number: port.number, service: port.service, risk: port.risk })),
      disclosedPaths: result.adminPagesExposed ?? [], thirdPartyOrigins: thirdPartyOrigins(result), exposures: deriveExposures(result),
    }));

    targets.sort((a, b) => a.score - b.score);

    const summary = {
      targets: targets.length,
      withoutHttps: targets.filter((t) => !t.httpsEnabled).length,
      outdatedComponents: targets.reduce((total, t) => total + t.technologies.filter((tech) => tech.isOutdated).length, 0),
      thirdPartyOrigins: new Set(targets.flatMap((t) => t.thirdPartyOrigins)).size,
      unsignedDns: targets.filter((t) => t.dnssec === 'unsigned').length,
      totalExposures: targets.reduce((total, t) => total + t.exposures.length, 0),
    };

    return NextResponse.json({ success: true, data: { targets, summary } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load attack surface' }, { status: 500 });
  }
}
