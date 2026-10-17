'use client';

/**
 * Overview: the scanner front and centre, and a dashboard computed entirely
 * from real scans via /api/dashboard/stats. No hardcoded trend, no invented
 * severity counts — start empty, not with sample figures, so a fresh account
 * does not look like it has history.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { DashboardStats, DashboardAnalytics, ActivityItem } from '@/types/dashboard';
import { EMPTY_STATS, EMPTY_ANALYTICS } from '@/types/dashboard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Shield, ShieldAlert, Zap, Layers, RefreshCw, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScanLauncher from '@/components/scanner/ScanLauncher';
import { useScan } from '@/providers/ScanProvider';
import { gradeBadge, scoreColor, severityBadge } from '@/lib/severity';
import type { Severity } from '@/types/scanner';
import { useDashboardStats } from '@/hooks/dashboardQueries';

interface OverviewTabProps {
  onOpenScanner?: () => void;
}

export default function OverviewTab({ onOpenScanner }: OverviewTabProps) {
  const { result: scan, phase: scanPhase } = useScan();
  // Empty values stand in until the first response, so a fresh account renders
  // a real empty dashboard rather than flashing sample figures.
  const { data } = useDashboardStats();
  const stats: DashboardStats = data?.stats ?? EMPTY_STATS;
  const analytics: DashboardAnalytics = data?.analyticsData ?? EMPTY_ANALYTICS;
  const activity: ActivityItem[] = data?.recentActivity ?? [];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <span className="flex h-2 w-2 rounded-full bg-[#a8402e]" />;
      case 'warning': return <span className="flex h-2 w-2 rounded-full bg-[#8a3122]" />;
      case 'success': return <span className="flex h-2 w-2 rounded-full bg-[#7f9548]" />;
      default: return <span className="flex h-2 w-2 rounded-full bg-[#937d57]" />;
    }
  };

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'scan': return <RefreshCw className="h-4 w-4 text-[#6b7f3a]" />;
      case 'alert': return <ShieldAlert className="h-4 w-4 text-[#a8402e]" />;
      case 'check': return <Shield className="h-4 w-4 text-[#7f9548]" />;
      case 'shield': return <Shield className="h-4 w-4 text-[#6b572f]" />;
      case 'block': return <Zap className="h-4 w-4 text-[#6b572f]" />;
      default: return <Clock className="h-4 w-4 text-[#6b572f]" />;
    }
  };

  const completedScan = scan && scan.scanResultStatus === 'completed' ? scan : null;
  const openFindings = completedScan ? completedScan.recommendations.filter((f) => !f.resolved) : [];
  const severityCounts = (['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => ({
    severity,
    count: openFindings.filter((f) => f.priority === severity).length,
  }));

  return (
    <div className="space-y-6 font-sans">
      {/* Scanner — runnable directly from the front page */}
      <ScanLauncher compact />

      {/* Latest scan result */}
      {completedScan && (
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold tabular" style={{ color: scoreColor(completedScan.overallScore) }}>{completedScan.overallScore}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded font-bold', gradeBadge(completedScan.grade))}>{completedScan.grade ?? '—'}</span>
            <span className="font-mono text-xs text-[#6b572f] truncate flex-1 min-w-0">{completedScan.finalUrl ?? completedScan.url}</span>
            {onOpenScanner && (
              <button onClick={onOpenScanner} className="text-sm text-[#47601f] hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0">
                Full report <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-[#6b572f] mt-2.5 leading-relaxed">{completedScan.aiSummary}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {severityCounts.filter((e) => e.count > 0).map((e) => (
              <span key={e.severity} className={cn('text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider', severityBadge(e.severity))}>{e.count} {e.severity}</span>
            ))}
            {openFindings.length === 0 && <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider badge-pass">No open findings</span>}
          </div>
          {openFindings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#e9dab8] space-y-1.5">
              {openFindings.slice(0, 3).map((finding) => (
                <div key={finding.id} className="flex items-start gap-2">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-px', severityBadge(finding.priority))}>{finding.priority}</span>
                  <span className="text-sm text-[#4a3b1f] leading-relaxed">{finding.title}</span>
                </div>
              ))}
              {openFindings.length > 3 && <p className="text-xs text-[#a6906a] pl-1">+{openFindings.length - 3} more in the full report</p>}
            </div>
          )}
        </div>
      )}

      {scan && scan.scanResultStatus !== 'completed' && (
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-4.5 w-4.5 text-[#a8402e] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#8a3122]">
              Scan did not complete ({scan.scanResultStatus?.replace('_', ' ') ?? 'error'})
            </p>
            <p className="text-xs text-[#6b572f] mt-0.5 leading-relaxed">
              {scan.errorMessage || 'Target could not be reached or validated.'}
            </p>
          </div>
        </div>
      )}

      {!completedScan && !scan && scanPhase === 'idle' && (
        <p className="text-xs text-[#937d57]">No scans recorded yet. Run one above to populate this dashboard with real results.</p>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#6b7f3a] group-hover:scale-110 transition-transform"><Shield className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">Security Score</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#2a2013]">{stats.securityScore}</span>
              <span className="text-sm font-semibold text-[#6b572f]">/100</span>
            </div>
            <div className="mt-3 w-full bg-[#efe1c4] rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-1000" style={{ width: `${stats.securityScore}%`, backgroundColor: scoreColor(stats.securityScore) }} />
            </div>
            <p className="text-sm text-[#6b572f] mt-2">From the most recent scan</p>
          </CardContent>
        </Card>

        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#a8402e] group-hover:scale-110 transition-transform"><ShieldAlert className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">Critical & High</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#8a3122]">{stats.criticalVulnerabilities + stats.highVulnerabilities}</span>
              <span className="text-xs text-[#a8402e] font-semibold uppercase bg-[#a8402e]/10 px-1.5 py-0.5 border border-[#a8402e]/20 rounded">Open</span>
            </div>
            <p className="text-sm text-[#6b572f] mt-5">Findings needing attention now</p>
          </CardContent>
        </Card>

        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#6b572f] group-hover:scale-110 transition-transform"><Layers className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">Total Findings</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#4a3b1f]">{stats.totalVulnerabilities}</span>
              <span className="text-sm font-semibold text-[#6b572f]">Open</span>
            </div>
            <p className="text-sm text-[#6b572f] mt-5">{stats.resolvedIssues} resolved to date</p>
          </CardContent>
        </Card>

        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#7f9548] group-hover:scale-110 transition-transform"><RefreshCw className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">Scans This Month</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#7f9548]">{stats.scansThisMonth}</span>
            </div>
            <p className="text-sm text-[#6b572f] mt-5">{stats.domainsMonitored} host(s) scanned</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card variant="cyber" className="lg:col-span-2">
          <CardHeader><CardTitle>Score Trend</CardTitle><CardDescription>Overall score across your last scans</CardDescription></CardHeader>
          <CardContent className="h-64">
            {analytics.scoreTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#a6906a]">No scan history yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.scoreTrend}>
                  <defs><linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6b7f3a" stopOpacity={0.35} /><stop offset="95%" stopColor="#6b7f3a" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe1c4" />
                  <XAxis dataKey="label" stroke="#6b572f" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6b572f" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fffbf3', borderColor: '#e3d2a9', color: '#2a2013' }} />
                  <Area type="monotone" dataKey="score" stroke="#6b7f3a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="cyber">
          <CardHeader><CardTitle>Findings by Severity</CardTitle><CardDescription>Open findings right now</CardDescription></CardHeader>
          <CardContent className="h-64">
            {analytics.riskDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#a6906a]">No open findings</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.riskDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {analytics.riskDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fffbf3', borderColor: '#e3d2a9', color: '#2a2013' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card variant="cyber">
        <CardHeader><CardTitle>Recent Scans</CardTitle><CardDescription>Real scan history</CardDescription></CardHeader>
        <CardContent className="max-h-[300px] overflow-y-auto pr-2 divide-y divide-[#e3d2a9]/35">
          {activity.length === 0 ? (
            <p className="text-xs text-[#a6906a] py-4">No activity yet.</p>
          ) : activity.map((item) => (
            <div key={item.id} className="flex gap-3 py-3 items-start group">
              <div className="p-1.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg mt-0.5 flex-shrink-0 group-hover:border-[#47601f]/40 transition-colors">{getActivityIcon(item.icon)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getSeverityIcon(item.severity)}
                  <p className="text-xs text-[#6b572f] truncate">{new Date(item.time).toLocaleString()}</p>
                </div>
                <p className="text-xs font-medium text-[#2a2013] mt-1 leading-snug">{item.title}</p>
                <p className="text-sm text-[#937d57] mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
