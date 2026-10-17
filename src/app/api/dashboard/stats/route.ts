import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import type { ActivityItem, DashboardAnalytics, DashboardStats } from '@/types/dashboard';

export const runtime = 'nodejs';

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

/** How many recent scans the trend chart and activity feed actually show. */
const TREND_LIMIT = 12;
const ACTIVITY_LIMIT = 8;

/**
 * Everything here is computed from the signed-in user's real scans and tracked
 * findings — no invented figures, no hardcoded trend.
 *
 * Severity counts are aggregated in Postgres, and scan rows are selected
 * column-by-column. Reading whole rows pulled every stored JSON blob (ssl,
 * checks, recommendations, technologies, content…) across the wire just to
 * count them in JavaScript — around a megabyte to render a 2 KB response, and
 * growing with every scan ever run.
 */
export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const userId = userIdOrError;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [severityGroups, resolvedIssues, scansThisMonth, scanIndex] = await Promise.all([
      // Open findings, counted per severity by the database.
      prisma.vulnerability.groupBy({
        by: ['severity'],
        where: { userId, status: { notIn: ['resolved', 'false_positive'] } },
        _count: { _all: true },
      }),
      prisma.vulnerability.count({ where: { userId, status: 'resolved' } }),
      prisma.scanResult.count({ where: { userId, scanDate: { gte: monthStart } } }),
      // Light index of every scan: no JSON blobs.
      prisma.scanResult.findMany({
        where: { userId },
        orderBy: { scanDate: 'desc' },
        select: { id: true, url: true, finalUrl: true, scanDate: true, overallScore: true, grade: true },
      }),
    ]);

    const countFor = (severity: string) =>
      severityGroups.find((group) => group.severity === severity)?._count._all ?? 0;

    const criticalVulnerabilities = countFor('critical');
    const highVulnerabilities = countFor('high');
    const mediumCount = countFor('medium');
    const lowCount = countFor('low');
    const totalOpen = severityGroups.reduce((sum, group) => sum + group._count._all, 0);

    const securityScore = scanIndex[0]?.overallScore ?? 0;

    // The most recent scan of each host, which is what SSL posture reports on.
    const latestPerHost = new Map<string, string>();
    for (const scan of scanIndex) {
      const host = hostOf(scan.finalUrl ?? scan.url);
      if (!latestPerHost.has(host)) latestPerHost.set(host, scan.id);
    }
    const domainsMonitored = latestPerHost.size;

    const activityScans = scanIndex.slice(0, ACTIVITY_LIMIT);

    // Only these rows need their heavy JSON columns, so fetch just those.
    const heavyIds = Array.from(new Set([...latestPerHost.values(), ...activityScans.map((s) => s.id)]));
    const heavyRows = heavyIds.length
      ? await prisma.scanResult.findMany({
          where: { id: { in: heavyIds } },
          select: { id: true, ssl: true, recommendations: true },
        })
      : [];
    const heavyById = new Map(heavyRows.map((row) => [row.id, row]));

    let valid = 0, expiringSoon = 0, expired = 0;
    for (const scanId of latestPerHost.values()) {
      try {
        const raw = heavyById.get(scanId)?.ssl;
        const ssl = raw ? (JSON.parse(raw) as { status?: string }) : null;
        if (ssl?.status === 'valid') valid += 1;
        else if (ssl?.status === 'expiring_soon') expiringSoon += 1;
        else if (ssl?.status === 'expired') expired += 1;
      } catch { /* a malformed blob simply does not count */ }
    }

    const stats: DashboardStats = {
      securityScore,
      totalVulnerabilities: totalOpen,
      criticalVulnerabilities,
      highVulnerabilities,
      resolvedIssues,
      domainsMonitored,
      scansThisMonth,
      sslCertificates: { valid, expiringSoon, expired },
    };

    const analyticsData: DashboardAnalytics = {
      riskDistribution: [
        { name: 'Critical', value: criticalVulnerabilities, color: '#a8402e' },
        { name: 'High', value: highVulnerabilities, color: '#8a3122' },
        { name: 'Medium', value: mediumCount, color: '#6b572f' },
        { name: 'Low', value: lowCount, color: '#a6906a' },
      ].filter((slice) => slice.value > 0),
      // Real score trend: oldest → newest, from the last 12 scans.
      scoreTrend: scanIndex.slice(0, TREND_LIMIT).reverse().map((scan) => ({
        label: new Date(scan.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: scan.overallScore,
      })),
    };

    const recentActivity: ActivityItem[] = activityScans.map((scan) => {
      const openForScan = (() => {
        try {
          const raw = heavyById.get(scan.id)?.recommendations;
          return raw ? (JSON.parse(raw) as { resolved: boolean }[]).filter((r) => !r.resolved).length : 0;
        } catch { return 0; }
      })();
      const severity = scan.overallScore >= 85 ? 'success' : scan.overallScore >= 65 ? 'info' : 'critical';
      return {
        id: scan.id,
        icon: 'scan',
        title: `Scanned ${hostOf(scan.finalUrl ?? scan.url)}`,
        description: `Score ${scan.overallScore}/100 (${scan.grade ?? '—'}) · ${openForScan} open finding${openForScan === 1 ? '' : 's'}`,
        time: scan.scanDate.toISOString(),
        severity,
      };
    });

    return NextResponse.json({ success: true, data: { stats, analyticsData, recentActivity } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load stats' }, { status: 500 });
  }
}
