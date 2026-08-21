'use client';

/**
 * Attack surface — what is externally observable for each scanned host. Replaces
 * the old "Threats" tab (invented attacking IPs/DDoS a passive scanner cannot
 * observe). All of it comes from stored scans.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Layers, Loader2, Network, RefreshCw, Search, ShieldAlert, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gradeBadge, scoreColor, severityBadge } from '@/lib/severity';

interface Exposure { label: string; detail: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'info'; }
interface TargetSurface {
  host: string; url: string; lastScanAt: string; score: number; grade: string | null; httpsEnabled: boolean; httpStatus: number | null;
  addresses: string[]; nameservers: string[]; mxHosts: string[]; dnssec: string; caa: string[];
  technologies: { name: string; version?: string; isOutdated: boolean; category: string }[];
  ports: { number: number; service: string; risk: string }[]; disclosedPaths: string[]; thirdPartyOrigins: string[]; exposures: Exposure[];
}
interface Summary { targets: number; withoutHttps: number; outdatedComponents: number; thirdPartyOrigins: number; unsignedDns: number; totalExposures: number; }

export default function AttackSurfaceTab({ searchQuery = '' }: { searchQuery?: string }) {
  const [targets, setTargets] = useState<TargetSurface[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attack-surface');
      const json = await res.json();
      if (json.success) { setTargets(json.data.targets); setSummary(json.data.summary); }
    } catch { /* keep previous view */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener('scanner_updated', handler);
    return () => window.removeEventListener('scanner_updated', handler);
  }, [load]);

  const query = searchQuery.trim().toLowerCase();
  const visible = query ? targets.filter((t) => t.host.toLowerCase().includes(query) || t.technologies.some((tech) => tech.name.toLowerCase().includes(query))) : targets;

  if (loading && targets.length === 0) {
    return <div className="flex items-center justify-center py-20 gap-2 text-[#71717a]"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Loading attack surface…</span></div>;
  }

  if (targets.length === 0) {
    return (
      <div className="space-y-4">
        <Header onRefresh={load} loading={loading} />
        <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg py-16 flex flex-col items-center text-center gap-2">
          <Network className="h-6 w-6 text-[#52525b]" />
          <p className="text-sm font-medium text-[#d4d4d8]">No hosts scanned yet</p>
          <p className="text-xs text-[#71717a] max-w-md leading-relaxed">Run a scan and the hosts, addresses, DNS posture and third-party code you depend on appear here. Nothing on this page is simulated — it is only what scans have measured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header onRefresh={load} loading={loading} />
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Stat label="Hosts" value={summary.targets} icon={<Globe className="h-3.5 w-3.5" />} />
          <Stat label="No HTTPS" value={summary.withoutHttps} bad={summary.withoutHttps > 0} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
          <Stat label="Outdated" value={summary.outdatedComponents} bad={summary.outdatedComponents > 0} icon={<Layers className="h-3.5 w-3.5" />} />
          <Stat label="3rd-party origins" value={summary.thirdPartyOrigins} icon={<Network className="h-3.5 w-3.5" />} />
          <Stat label="Unsigned DNS" value={summary.unsignedDns} bad={summary.unsignedDns > 0} icon={<Server className="h-3.5 w-3.5" />} />
          <Stat label="Exposures" value={summary.totalExposures} bad={summary.totalExposures > 0} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
        </div>
      )}
      {query && visible.length === 0 && <p className="text-xs text-[#71717a] flex items-center gap-2"><Search className="h-3.5 w-3.5" /> No host matches “{searchQuery}”.</p>}
      <div className="space-y-2">
        {visible.map((target) => <TargetCard key={target.host} target={target} expanded={expanded === target.host} onToggle={() => setExpanded(expanded === target.host ? null : target.host)} />)}
      </div>
    </div>
  );
}

function Header({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h1 className="text-base font-semibold text-[#f5f5f5]">Attack surface</h1>
        <p className="text-xs text-[#71717a] mt-0.5 max-w-2xl leading-relaxed">What is externally reachable and observable for each scanned host. This is not attack telemetry — a passive scanner cannot see attacks against a site it does not host.</p>
      </div>
      <button onClick={onRefresh} disabled={loading} className="h-9 px-3.5 inline-flex items-center gap-2 rounded-md border border-[#242424] bg-[#0d0d0d] hover:border-[#333333] text-xs font-medium text-[#d4d4d8] transition-colors cursor-pointer shrink-0 disabled:opacity-50">
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
      </button>
    </div>
  );
}

function Stat({ label, value, bad, icon }: { label: string; value: number; bad?: boolean; icon: React.ReactNode }) {
  return (
    <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[#52525b]">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className={cn('text-xl font-bold tabular mt-1', bad ? 'text-[#f87171]' : 'text-[#f5f5f5]')}>{value}</p>
    </div>
  );
}

function TargetCard({ target, expanded, onToggle }: { target: TargetSurface; expanded: boolean; onToggle: () => void }) {
  const [subdomains, setSubdomains] = useState<string[] | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const discover = async () => {
    setLoadingSubs(true); setSubError(null);
    try {
      const res = await fetch(`/api/scan/subdomains?host=${encodeURIComponent(target.host)}`);
      const json = await res.json();
      if (json.success) setSubdomains(json.data.subdomains); else setSubError(json.error ?? 'Lookup failed.');
    } catch (err) { setSubError(err instanceof Error ? err.message : 'Lookup failed.'); } finally { setLoadingSubs(false); }
  };

  return (
    <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-[#111111] transition-colors cursor-pointer">
        <span className="text-lg font-bold tabular w-10 shrink-0" style={{ color: scoreColor(target.score) }}>{target.score}</span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0', gradeBadge(target.grade ?? undefined))}>{target.grade ?? '—'}</span>
        <span className="font-mono text-sm text-[#f5f5f5] truncate flex-1 min-w-0">{target.host}</span>
        {!target.httpsEnabled && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-[#dc2626]/16 text-[#fca5a5] border border-[#dc2626]/40 shrink-0">HTTP only</span>}
        <span className="text-[10px] text-[#52525b] tabular shrink-0">{target.exposures.length} exposure{target.exposures.length === 1 ? '' : 's'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#1a1a1a] pt-4">
          {target.exposures.length > 0 && (
            <Section label="Exposures">
              <div className="space-y-1.5">
                {target.exposures.map((exposure, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-px', severityBadge(exposure.severity))}>{exposure.severity}</span>
                    <div className="min-w-0"><p className="text-[11px] text-[#f5f5f5]">{exposure.label}</p><p className="text-[11px] text-[#71717a] leading-relaxed">{exposure.detail}</p></div>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section label="Network">
              <Row label="Addresses" value={target.addresses.join(', ') || 'not recorded'} />
              <Row label="Nameservers" value={target.nameservers.join(', ') || 'none'} />
              <Row label="Mail exchangers" value={target.mxHosts.join(', ') || 'none'} />
              <Row label="DNSSEC" value={target.dnssec} tone={target.dnssec === 'validated' ? 'good' : 'bad'} />
              <Row label="CAA" value={target.caa.join(', ') || 'no records'} tone={target.caa.length > 0 ? 'good' : 'bad'} />
            </Section>
            <Section label="Services observed">
              {target.ports.map((port) => <Row key={port.number} label={`Port ${port.number}`} value={port.service} tone={port.risk === 'info' ? 'good' : 'bad'} />)}
              <p className="text-[10px] text-[#52525b] mt-1.5 leading-relaxed">Only ports this scan actually connected to. No port scanning is performed.</p>
            </Section>
          </div>
          {target.technologies.length > 0 && (
            <Section label="Technology exposed">
              <div className="flex flex-wrap gap-1.5">
                {target.technologies.map((tech) => (
                  <span key={tech.name} className={cn('text-[11px] px-2 py-1 rounded border font-mono', tech.isOutdated ? 'bg-[#dc2626]/8 text-[#f87171] border-[#dc2626]/30' : 'bg-[#161616] text-[#a1a1aa] border-[#242424]')}>{tech.name}{tech.version ? ` ${tech.version}` : ''}</span>
                ))}
              </div>
            </Section>
          )}
          {target.thirdPartyOrigins.length > 0 && (
            <Section label="Third-party code origins">
              <div className="flex flex-wrap gap-1.5">{target.thirdPartyOrigins.map((origin) => <span key={origin} className="text-[11px] px-2 py-1 rounded bg-[#161616] border border-[#242424] text-[#a1a1aa] font-mono">{origin}</span>)}</div>
              <p className="text-[10px] text-[#52525b] mt-1.5">Code from these hosts executes with full access to the page.</p>
            </Section>
          )}
          {target.disclosedPaths.length > 0 && (
            <Section label="Paths disclosed by robots.txt">
              <div className="flex flex-wrap gap-1.5">{target.disclosedPaths.map((path) => <span key={path} className="text-[11px] px-2 py-1 rounded bg-[#161616] border border-[#242424] text-[#a1a1aa] font-mono">{path}</span>)}</div>
            </Section>
          )}
          <Section label="Subdomains (Certificate Transparency)">
            {subdomains === null ? (
              <div className="space-y-1.5">
                <button onClick={discover} disabled={loadingSubs} className="text-[11px] px-2.5 py-1.5 rounded border border-[#22c55e]/30 text-[#4ade80] hover:bg-[#22c55e]/10 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5">
                  {loadingSubs ? (<><Loader2 className="h-3 w-3 animate-spin" /> Searching CT logs…</>) : 'Discover subdomains'}
                </button>
                {subError && <p className="text-[11px] text-[#f87171]">{subError}</p>}
                <p className="text-[10px] text-[#52525b]">Reads public Certificate Transparency logs. No traffic is sent to the target.</p>
              </div>
            ) : subdomains.length === 0 ? <p className="text-[11px] text-[#71717a]">No entries found in CT logs.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">{subdomains.map((subdomain) => <span key={subdomain} className="text-[11px] px-2 py-1 rounded bg-[#161616] border border-[#242424] text-[#a1a1aa] font-mono truncate">{subdomain}</span>)}</div>
            )}
          </Section>
          <p className="text-[10px] text-[#52525b]">Last scanned {new Date(target.lastScanAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-wider text-[#52525b] mb-1.5">{label}</p>{children}</div>;
}

function Row({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="flex gap-2 text-[11px] py-0.5">
      <span className="text-[#52525b] shrink-0 w-32">{label}</span>
      <span className={cn('font-mono break-all', tone === 'good' ? 'text-[#4ade80]' : tone === 'bad' ? 'text-[#f87171]' : 'text-[#d4d4d8]')}>{value}</span>
    </div>
  );
}
