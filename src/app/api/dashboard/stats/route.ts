import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import type { ActivityItem, DashboardAnalytics, DashboardStats } from '@/types/dashboard';

export const runtime = 'nodejs';

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

/**
 * Everything here is computed from the signed-in user's real scans and tracked
 * findings — no invented figures, no hardcoded trend.
 */
export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const userId = userIdOrError;
    const [vulns, scans] = await Promise.all([
      prisma.vulnerability.findMany({ where: { userId } }),
      prisma.scanResult.findMany({ where: { userId }, orderBy: { scanDate: 'desc' } }),
    ]);

    const open = vulns.filter((v) => v.status !== 'resolved' && v.status !== 'false_positive');
    const criticalVulnerabilities = open.filter((v) => v.severity === 'critical').length;
    const highVulnerabilities = open.filter((v) => v.severity === 'high').length;
    const mediumCount = open.filter((v) => v.severity === 'medium').length;
    const lowCount = open.filter((v) => v.severity === 'low').length;
    const resolvedIssues = vulns.filter((v) => v.status === 'resolved').length;

    const latest = scans[0];
    const securityScore = latest ? latest.overallScore : 0;
    const domainsMonitored = new Set(scans.map((s) => hostOf(s.finalUrl ?? s.url))).size;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const scansThisMonth = scans.filter((s) => s.scanDate >= monthStart).length;

    // SSL posture from the most recent scan of each host.
    let valid = 0, expiringSoon = 0, expired = 0;
    const seenHosts = new Set<string>();
    for (const scan of scans) {
      const host = hostOf(scan.finalUrl ?? scan.url);
      if (seenHosts.has(host)) continue;
      seenHosts.add(host);
      try {
        const ssl = JSON.parse(scan.ssl) as { status?: string };
        if (ssl.status === 'valid') valid += 1;
        else if (ssl.status === 'expiring_soon') expiringSoon += 1;
        else if (ssl.status === 'expired') expired += 1;
      } catch { /* ignore */ }
    }

    const stats: DashboardStats = {
      securityScore,
      totalVulnerabilities: open.length,
      criticalVulnerabilities,
      highVulnerabilities,
      resolvedIssues,
      domainsMonitored,
      scansThisMonth,
      sslCertificates: { valid, expiringSoon, expired },
    };

    const analyticsData: DashboardAnalytics = {
      riskDistribution: [
        { name: 'Critical', value: criticalVulnerabilities, color: '#dc2626' },
        { name: 'High', value: highVulnerabilities, color: '#f87171' },
        { name: 'Medium', value: mediumCount, color: '#a1a1aa' },
        { name: 'Low', value: lowCount, color: '#52525b' },
      ].filter((slice) => slice.value > 0),
      // Real score trend: oldest → newest, from the last 12 scans.
      scoreTrend: scans.slice(0, 12).reverse().map((scan) => ({
        label: new Date(scan.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: scan.overallScore,
      })),
    };

    const recentActivity: ActivityItem[] = scans.slice(0, 8).map((scan) => {
      const openForScan = (() => { try { return (JSON.parse(scan.recommendations) as { resolved: boolean }[]).filter((r) => !r.resolved).length; } catch { return 0; } })();
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
