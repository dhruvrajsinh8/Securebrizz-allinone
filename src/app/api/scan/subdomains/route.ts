import { NextResponse } from 'next/server';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import { fetchSubdomains } from '@/lib/scanner/wellknown';
import { isValidHostname, isLocalHostDomain } from '@/lib/scanner/net';
import { checkScanRateLimit, clientIp } from '@/lib/rateLimit';

export const maxDuration = 30;
export const runtime = 'nodejs';

/**
 * CT-log subdomain discovery, split out of the main scan because crt.sh is slow
 * and would risk a serverless timeout. No traffic reaches the scanned host.
 */
export async function GET(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  const host = new URL(request.url).searchParams.get('host')?.trim().toLowerCase() ?? '';
  if (!host || !isValidHostname(host)) return NextResponse.json({ success: false, error: 'A valid hostname is required.' }, { status: 400 });
  if (isLocalHostDomain(host)) return NextResponse.json({ success: true, data: { subdomains: [], notable: [], skipped: 'Local target; CT logs do not apply.' } });

  const limit = await checkScanRateLimit(userIdOrError, clientIp(request));
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: limit.reason ?? 'Rate limit exceeded.' }, { status: 429, headers: limit.retryAfterSeconds ? { 'Retry-After': String(limit.retryAfterSeconds) } : undefined });
  }

  const result = await fetchSubdomains(host);
  if (result.error) return NextResponse.json({ success: false, error: `Certificate transparency lookup failed: ${result.error}` }, { status: 502 });
  return NextResponse.json({ success: true, data: { subdomains: result.subdomains, notable: result.notable } });
}
