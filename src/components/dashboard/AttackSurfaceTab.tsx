'use client';

/**
 * Attack surface — what is externally observable for each scanned host. Replaces
 * the old "Threats" tab (invented attacking IPs/DDoS a passive scanner cannot
 * observe). All of it comes from stored scans.
 */

import React, { useState } from 'react';
import { Globe, Layers, Loader2, Network, RefreshCw, Search, ShieldAlert, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gradeBadge, scoreColor, severityBadge } from '@/lib/severity';
import { useAttackSurface, type TargetSurface } from '@/hooks/dashboardQueries';

export default function AttackSurfaceTab({ searchQuery = '' }: { searchQuery?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isPending, isFetching, refetch } = useAttackSurface();

  const targets = data?.targets ?? [];
  const summary = data?.summary ?? null;
  const load = () => void refetch();

  const query = searchQuery.trim().toLowerCase();
  const visible = query ? targets.filter((t) => t.host.toLowerCase().includes(query) || t.technologies.some((tech) => tech.name.toLowerCase().includes(query))) : targets;

  if (isPending) {
    return <div className="flex items-center justify-center py-20 gap-2 text-[#937d57]"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Loading attack surface…</span></div>;
  }

  if (targets.length === 0) {
    return (
      <div className="space-y-4">
        <Header onRefresh={load} loading={isFetching} />
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg py-16 flex flex-col items-center text-center gap-2">
          <Network className="h-6 w-6 text-[#a6906a]" />
          <p className="text-sm font-medium text-[#4a3b1f]">No hosts scanned yet</p>
          <p className="text-xs text-[#937d57] max-w-md leading-relaxed">Run a scan and the hosts, addresses, DNS posture and third-party code you depend on appear here. Nothing on this page is simulated — it is only what scans have measured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header onRefresh={load} loading={isFetching} />
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
      {query && visible.length === 0 && <p className="text-xs text-[#937d57] flex items-center gap-2"><Search className="h-3.5 w-3.5" /> No host matches “{searchQuery}”.</p>}
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
        <h1 className="text-base font-semibold text-[#2a2013]">Attack surface</h1>
        <p className="text-xs text-[#937d57] mt-0.5 max-w-2xl leading-relaxed">What is externally reachable and observable for each scanned host. This is not attack telemetry — a passive scanner cannot see attacks against a site it does not host.</p>
      </div>
      <button onClick={onRefresh} disabled={loading} className="h-9 px-3.5 inline-flex items-center gap-2 rounded-md border border-[#e3d2a9] bg-[#fffbf3] hover:border-[#cbae72] text-xs font-medium text-[#4a3b1f] transition-colors cursor-pointer shrink-0 disabled:opacity-50">
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
      </button>
    </div>
  );
}

function Stat({ label, value, bad, icon }: { label: string; value: number; bad?: boolean; icon: React.ReactNode }) {
  return (
    <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[#a6906a]">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <p className={cn('text-xl font-bold tabular mt-1', bad ? 'text-[#8a3122]' : 'text-[#2a2013]')}>{value}</p>
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
    <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-[#fffbf3] transition-colors cursor-pointer">
        <span className="text-lg font-bold tabular w-10 shrink-0" style={{ color: scoreColor(target.score) }}>{target.score}</span>
        <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold shrink-0', gradeBadge(target.grade ?? undefined))}>{target.grade ?? '—'}</span>
        <span className="font-mono text-sm text-[#2a2013] truncate flex-1 min-w-0">{target.host}</span>
        {!target.httpsEnabled && <span className="text-xs px-1.5 py-0.5 rounded font-bold uppercase bg-[#a8402e]/16 text-[#c97f68] border border-[#a8402e]/40 shrink-0">HTTP only</span>}
        <span className="text-xs text-[#a6906a] tabular shrink-0">{target.exposures.length} exposure{target.exposures.length === 1 ? '' : 's'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#e9dab8] pt-4">
          {target.exposures.length > 0 && (
            <Section label="Exposures">
              <div className="space-y-1.5">
                {target.exposures.map((exposure, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-px', severityBadge(exposure.severity))}>{exposure.severity}</span>
                    <div className="min-w-0"><p className="text-sm text-[#2a2013]">{exposure.label}</p><p className="text-sm text-[#937d57] leading-relaxed">{exposure.detail}</p></div>
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
              <p className="text-xs text-[#a6906a] mt-1.5 leading-relaxed">Only ports this scan actually connected to. No port scanning is performed.</p>
            </Section>
          </div>
          {target.technologies.length > 0 && (
            <Section label="Technology exposed">
              <div className="flex flex-wrap gap-1.5">
                {target.technologies.map((tech) => (
                  <span key={tech.name} className={cn('text-sm px-2 py-1 rounded border font-mono', tech.isOutdated ? 'bg-[#a8402e]/8 text-[#8a3122] border-[#a8402e]/30' : 'bg-[#efe1c4] text-[#6b572f] border-[#e3d2a9]')}>{tech.name}{tech.version ? ` ${tech.version}` : ''}</span>
                ))}
              </div>
            </Section>
          )}
          {target.thirdPartyOrigins.length > 0 && (
            <Section label="Third-party code origins">
              <div className="flex flex-wrap gap-1.5">{target.thirdPartyOrigins.map((origin) => <span key={origin} className="text-sm px-2 py-1 rounded bg-[#efe1c4] border border-[#e3d2a9] text-[#6b572f] font-mono">{origin}</span>)}</div>
              <p className="text-xs text-[#a6906a] mt-1.5">Code from these hosts executes with full access to the page.</p>
            </Section>
          )}
          {target.disclosedPaths.length > 0 && (
            <Section label="Paths disclosed by robots.txt">
              <div className="flex flex-wrap gap-1.5">{target.disclosedPaths.map((path) => <span key={path} className="text-sm px-2 py-1 rounded bg-[#efe1c4] border border-[#e3d2a9] text-[#6b572f] font-mono">{path}</span>)}</div>
            </Section>
          )}
          <Section label="Subdomains (Certificate Transparency)">
            {subdomains === null ? (
              <div className="space-y-1.5">
                <button onClick={discover} disabled={loadingSubs} className="text-sm px-2.5 py-1.5 rounded border border-[#7f9548]/30 text-[#47601f] hover:bg-[#7f9548]/10 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5">
                  {loadingSubs ? (<><Loader2 className="h-3 w-3 animate-spin" /> Searching CT logs…</>) : 'Discover subdomains'}
                </button>
                {subError && <p className="text-sm text-[#8a3122]">{subError}</p>}
                <p className="text-xs text-[#a6906a]">Reads public Certificate Transparency logs. No traffic is sent to the target.</p>
              </div>
            ) : subdomains.length === 0 ? <p className="text-sm text-[#937d57]">No entries found in CT logs.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">{subdomains.map((subdomain) => <span key={subdomain} className="text-sm px-2 py-1 rounded bg-[#efe1c4] border border-[#e3d2a9] text-[#6b572f] font-mono truncate">{subdomain}</span>)}</div>
            )}
          </Section>
          <p className="text-xs text-[#a6906a]">Last scanned {new Date(target.lastScanAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs uppercase tracking-wider text-[#a6906a] mb-1.5">{label}</p>{children}</div>;
}

function Row({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span className="text-[#a6906a] shrink-0 w-32">{label}</span>
      <span className={cn('font-mono break-all', tone === 'good' ? 'text-[#47601f]' : tone === 'bad' ? 'text-[#8a3122]' : 'text-[#4a3b1f]')}>{value}</span>
    </div>
  );
}
