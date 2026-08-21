'use client';

/**
 * Overview: the scanner front and centre, and a dashboard computed entirely
 * from real scans via /api/dashboard/stats. No hardcoded trend, no invented
 * severity counts — start empty, not with sample figures, so a fresh account
 * does not look like it has history.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { DashboardStats, DashboardAnalytics, ActivityItem } from '@/types/dashboard';
import { EMPTY_STATS, EMPTY_ANALYTICS } from '@/types/dashboard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Shield, ShieldAlert, Zap, Layers, RefreshCw, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScanLauncher from '@/components/scanner/ScanLauncher';
import { useScan } from '@/providers/ScanProvider';
import { gradeBadge, scoreColor, severityBadge } from '@/lib/severity';
import type { Severity } from '@/types/scanner';

interface OverviewTabProps {
  onOpenScanner?: () => void;
}

export default function OverviewTab({ onOpenScanner }: OverviewTabProps) {
  const { result: scan, phase: scanPhase } = useScan();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_ANALYTICS);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data.stats);
        setAnalytics(json.data.analyticsData);
        setActivity(json.data.recentActivity);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handler = () => loadDashboardData();
    window.addEventListener('vulnerabilities_updated', handler);
    window.addEventListener('scanner_updated', handler);
    return () => {
      window.removeEventListener('vulnerabilities_updated', handler);
      window.removeEventListener('scanner_updated', handler);
    };
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <span className="flex h-2 w-2 rounded-full bg-[#dc2626]" />;
      case 'warning': return <span className="flex h-2 w-2 rounded-full bg-[#f87171]" />;
      case 'success': return <span className="flex h-2 w-2 rounded-full bg-[#22c55e]" />;
      default: return <span className="flex h-2 w-2 rounded-full bg-[#71717a]" />;
    }
  };

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'scan': return <RefreshCw className="h-4 w-4 text-[#16a34a]" />;
      case 'alert': return <ShieldAlert className="h-4 w-4 text-[#dc2626]" />;
      case 'check': return <Shield className="h-4 w-4 text-[#22c55e]" />;
      case 'shield': return <Shield className="h-4 w-4 text-[#a1a1aa]" />;
      case 'block': return <Zap className="h-4 w-4 text-[#a1a1aa]" />;
      default: return <Clock className="h-4 w-4 text-[#a1a1aa]" />;
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
        <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold tabular" style={{ color: scoreColor(completedScan.overallScore) }}>{completedScan.overallScore}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded font-bold', gradeBadge(completedScan.grade))}>{completedScan.grade ?? '—'}</span>
            <span className="font-mono text-xs text-[#a1a1aa] truncate flex-1 min-w-0">{completedScan.finalUrl ?? completedScan.url}</span>
            {onOpenScanner && (
              <button onClick={onOpenScanner} className="text-[11px] text-[#4ade80] hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0">
                Full report <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-[#a1a1aa] mt-2.5 leading-relaxed">{completedScan.aiSummary}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {severityCounts.filter((e) => e.count > 0).map((e) => (
              <span key={e.severity} className={cn('text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider', severityBadge(e.severity))}>{e.count} {e.severity}</span>
            ))}
            {openFindings.length === 0 && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider badge-pass">No open findings</span>}
          </div>
          {openFindings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-1.5">
              {openFindings.slice(0, 3).map((finding) => (
                <div key={finding.id} className="flex items-start gap-2">
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-px', severityBadge(finding.priority))}>{finding.priority}</span>
                  <span className="text-[11px] text-[#d4d4d8] leading-relaxed">{finding.title}</span>
                </div>
              ))}
              {openFindings.length > 3 && <p className="text-[10px] text-[#52525b] pl-1">+{openFindings.length - 3} more in the full report</p>}
            </div>
          )}
        </div>
      )}

      {!completedScan && scanPhase === 'idle' && (
        <p className="text-xs text-[#71717a]">No scans recorded yet. Run one above to populate this dashboard with real results.</p>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#16a34a] group-hover:scale-110 transition-transform"><Shield className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">Security Score</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#f5f5f5]">{stats.securityScore}</span>
              <span className="text-sm font-semibold text-[#a1a1aa]">/100</span>
            </div>
            <div className="mt-3 w-full bg-[#161616] rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-1000" style={{ width: `${stats.securityScore}%`, backgroundColor: scoreColor(stats.securityScore) }} />
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-2">From the most recent scan</p>
          </CardContent>
        </Card>

        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#dc2626] group-hover:scale-110 transition-transform"><ShieldAlert className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">Critical & High</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#f87171]">{stats.criticalVulnerabilities + stats.highVulnerabilities}</span>
              <span className="text-xs text-[#dc2626] font-semibold uppercase bg-[#dc2626]/10 px-1.5 py-0.5 border border-[#dc2626]/20 rounded">Open</span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-5">Findings needing attention now</p>
          </CardContent>
        </Card>

        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#a1a1aa] group-hover:scale-110 transition-transform"><Layers className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">Total Findings</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#d4d4d8]">{stats.totalVulnerabilities}</span>
              <span className="text-sm font-semibold text-[#a1a1aa]">Open</span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-5">{stats.resolvedIssues} resolved to date</p>
          </CardContent>
        </Card>

        <Card variant="cyber" className="relative overflow-hidden group">
          <div className="absolute right-3 top-3 h-16 w-16 opacity-10 text-[#22c55e] group-hover:scale-110 transition-transform"><RefreshCw className="h-full w-full" /></div>
          <CardContent className="pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">Scans This Month</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-[#22c55e]">{stats.scansThisMonth}</span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-5">{stats.domainsMonitored} host(s) scanned</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card variant="cyber" className="lg:col-span-2">
          <CardHeader><CardTitle>Score Trend</CardTitle><CardDescription>Overall score across your last scans</CardDescription></CardHeader>
          <CardContent className="h-64">
            {analytics.scoreTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#52525b]">No scan history yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.scoreTrend}>
                  <defs><linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#161616" />
                  <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d0d0d', borderColor: '#242424', color: '#f5f5f5' }} />
                  <Area type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="cyber">
          <CardHeader><CardTitle>Findings by Severity</CardTitle><CardDescription>Open findings right now</CardDescription></CardHeader>
          <CardContent className="h-64">
            {analytics.riskDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#52525b]">No open findings</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.riskDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {analytics.riskDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0d0d0d', borderColor: '#242424', color: '#f5f5f5' }} />
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
        <CardContent className="max-h-[300px] overflow-y-auto pr-2 divide-y divide-[#242424]/35">
          {activity.length === 0 ? (
            <p className="text-xs text-[#52525b] py-4">No activity yet.</p>
          ) : activity.map((item) => (
            <div key={item.id} className="flex gap-3 py-3 items-start group">
              <div className="p-1.5 bg-[#161616] border border-[#242424] rounded-lg mt-0.5 flex-shrink-0 group-hover:border-[#4ade80]/40 transition-colors">{getActivityIcon(item.icon)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getSeverityIcon(item.severity)}
                  <p className="text-xs text-[#a1a1aa] truncate">{new Date(item.time).toLocaleString()}</p>
                </div>
                <p className="text-xs font-medium text-[#f5f5f5] mt-1 leading-snug">{item.title}</p>
                <p className="text-[11px] text-[#71717a] mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
