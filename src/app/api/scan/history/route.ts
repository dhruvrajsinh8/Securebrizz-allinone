import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function GET(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const limitParam = new URL(request.url).searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 50);

    const scans = await prisma.scanResult.findMany({
      where: { userId: userIdOrError },
      orderBy: { scanDate: 'desc' },
      take: limit,
      select: { id: true, url: true, finalUrl: true, scanDate: true, overallScore: true, riskScore: true, grade: true, httpsEnabled: true, durationMs: true, recommendations: true },
    });

    const data = scans.map((scan) => {
      let findingCount = 0;
      let criticalCount = 0;
      try {
        const parsed = JSON.parse(scan.recommendations) as { priority: string; resolved: boolean }[];
        const open = parsed.filter((finding) => !finding.resolved);
        findingCount = open.length;
        criticalCount = open.filter((f) => f.priority === 'critical' || f.priority === 'high').length;
      } catch { /* usable score even if findings unparseable */ }
      return {
        id: scan.id, url: scan.finalUrl ?? scan.url, scanDate: scan.scanDate.toISOString(),
        overallScore: scan.overallScore, riskScore: scan.riskScore, grade: scan.grade, httpsEnabled: scan.httpsEnabled,
        durationMs: scan.durationMs, findingCount, criticalCount,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load history' }, { status: 500 });
  }
}
