import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import { fromScanRow } from '@/lib/scanner/persistence';

/** Toggle a finding resolved/open on the latest scan and re-score it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const { id: recId } = await params;
    const scan = await prisma.scanResult.findFirst({ where: { userId: userIdOrError }, orderBy: { scanDate: 'desc' } });
    if (!scan) return NextResponse.json({ success: false, error: 'No scans found.' }, { status: 404 });

    const recommendations = JSON.parse(scan.recommendations) as { id: string; resolved: boolean; scoreImpact?: number }[];
    let nextState = false;
    let delta = 0;
    const updated = recommendations.map((rec) => {
      if (rec.id === recId) {
        nextState = !rec.resolved;
        delta = (rec.scoreImpact ?? 6) * (nextState ? 1 : -1);
        return { ...rec, resolved: nextState };
      }
      return rec;
    });

    const newScore = Math.min(100, Math.max(0, scan.overallScore + Math.round(delta)));
    const stored = await prisma.scanResult.update({
      where: { id: scan.id },
      data: { overallScore: newScore, riskScore: 100 - newScore, recommendations: JSON.stringify(updated) },
    });

    // Keep the tracked vulnerability in step with the finding's resolved state.
    const host = (() => { try { return new URL(scan.finalUrl ?? scan.url).hostname; } catch { return scan.url; } })();
    await prisma.vulnerability.updateMany({
      where: { userId: userIdOrError, target: host, findingId: recId },
      data: { status: nextState ? 'resolved' : 'open', resolvedAt: nextState ? new Date() : null },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, data: fromScanRow(stored), resolvedState: nextState });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 });
  }
}
