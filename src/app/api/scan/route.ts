import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import { performPassiveScan } from '@/lib/scanner';
import { fromScanRow, toScanRow } from '@/lib/scanner/persistence';
import { syncFindingsToVulnerabilities } from '@/lib/findingsSync';
import { checkScanRateLimit, clientIp, finishScanAttempt, recordScanAttempt } from '@/lib/rateLimit';

export const maxDuration = 30;
export const runtime = 'nodejs';

/** Latest stored scan for the signed-in user. */
export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const scan = await prisma.scanResult.findFirst({ where: { userId: userIdOrError }, orderBy: { scanDate: 'desc' } });
    if (!scan) return NextResponse.json({ success: true, data: null });
    return NextResponse.json({ success: true, data: fromScanRow(scan) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load scan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  const userId = userIdOrError;
  const ip = clientIp(request);
  let auditId: string | null = null;

  try {
    const body = (await request.json()) as { url?: unknown; scanMode?: unknown; confirmedAuthorization?: unknown };
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return NextResponse.json({ success: false, error: 'A target URL is required.' }, { status: 400 });
    if (url.length > 2048) return NextResponse.json({ success: false, error: 'Target URL is too long.' }, { status: 400 });

    const scanMode = body.scanMode === 'active' ? 'active' : 'passive';
    if (scanMode === 'active' && body.confirmedAuthorization !== true) {
      return NextResponse.json(
        { success: false, error: 'Active deep scan requires explicit confirmation that you own or have permission to audit this host.' },
        { status: 400 }
      );
    }

    const limit = await checkScanRateLimit(userId, ip);
    if (!limit.allowed) {
      await recordScanAttempt(userId, ip, url).then((id) => finishScanAttempt(id, 'rejected'));
      return NextResponse.json({ success: false, error: limit.reason ?? 'Rate limit exceeded.' }, { status: 429, headers: limit.retryAfterSeconds ? { 'Retry-After': String(limit.retryAfterSeconds) } : undefined });
    }

    auditId = await recordScanAttempt(userId, ip, url);
    const result = await performPassiveScan(url, { scanMode });

    if (result.scanResultStatus !== 'completed') {
      await finishScanAttempt(auditId, 'failed');
      return NextResponse.json({ success: true, data: result });
    }

    let hydrated = result;
    let sync = null;
    try {
      const stored = await prisma.scanResult.create({ data: { ...toScanRow(result), userId } });
      hydrated = fromScanRow(stored);
      try {
        sync = await syncFindingsToVulnerabilities(hydrated, userId);
      } catch (syncError) {
        console.error('[scan] finding sync failed:', syncError);
      }
    } catch (dbError) {
      console.error('[scan] could not persist scan result to database:', dbError);
    }

    void finishScanAttempt(auditId, 'completed');
    return NextResponse.json({ success: true, data: hydrated, sync, rateLimit: { remaining: limit.remaining } });
  } catch (error) {
    await finishScanAttempt(auditId, 'failed');
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Scan failed' }, { status: 500 });
  }
}
