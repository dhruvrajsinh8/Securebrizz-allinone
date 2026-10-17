'use client';

/**
 * Full scan report. Findings first (each with evidence, consequence, and the
 * exact change to make); raw observations behind tabs; a Checks tab so the
 * coverage behind the score is visible.
 */

import React, { useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, Globe, ShieldCheck, AlertCircle, MinusCircle, Server } from 'lucide-react';
import type { ScanRecommendation, ScanResult, Severity } from '@/types/scanner';
import { useScan } from '@/providers/ScanProvider';
import { cn } from '@/lib/utils';
import { gradeBadge, scoreColor, severityBadge, severityDot, statusBadge } from '@/lib/severity';
import { SEVERITY_WEIGHT } from '@/lib/scanner/scoring';
import SiteVerdict from './SiteVerdict';

type SubTab = 'findings' | 'ports' | 'headers' | 'tls' | 'dns' | 'content' | 'subdomains' | 'checks';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'findings', label: 'Findings' },
  { id: 'ports', label: 'Ports' },
  { id: 'headers', label: 'Headers' },
  { id: 'tls', label: 'TLS' },
  { id: 'dns', label: 'DNS & Email' },
  { id: 'content', label: 'Content' },
  { id: 'subdomains', label: 'Subdomains' },
  { id: 'checks', label: 'Checks' },
];

export default function ScanReport({ result }: { result: ScanResult }) {
  const [tab, setTab] = useState<SubTab>('findings');
  const openFindings = result.recommendations.filter((finding) => !finding.resolved);

  return (
    <div className="space-y-4">
      <SiteVerdict phishing={result.phishing} hostname={(() => { try { return new URL(result.finalUrl ?? result.url).hostname; } catch { return result.url; } })()} />
      <ScoreHeader result={result} openCount={openFindings.length} />
      <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg">
        <div className="flex flex-wrap gap-0.5 px-2 pt-2 border-b border-[#e3d2a9]">
          {TABS.map((entry) => (
            <button key={entry.id} onClick={() => setTab(entry.id)}
              className={cn('px-3 py-2 text-xs font-medium rounded-t-md transition-colors cursor-pointer border-b-2 -mb-px', tab === entry.id ? 'text-[#2a2013] border-[#7f9548]' : 'text-[#937d57] border-transparent hover:text-[#4a3b1f]')}>
              {entry.label}
              {entry.id === 'findings' && openFindings.length > 0 && <span className="ml-1.5 text-[#a6906a] tabular">{openFindings.length}</span>}
              {entry.id === 'ports' && (result.openPorts?.length ?? 0) > 0 && <span className="ml-1.5 text-[#a6906a] tabular">{result.openPorts.length}</span>}
              {entry.id === 'subdomains' && (result.subdomains?.length ?? 0) > 0 && <span className="ml-1.5 text-[#a6906a] tabular">{result.subdomains?.length}</span>}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          {tab === 'findings' && <FindingsPanel result={result} />}
          {tab === 'ports' && <PortsPanel result={result} />}
          {tab === 'headers' && <HeadersPanel result={result} />}
          {tab === 'tls' && <TlsPanel result={result} />}
          {tab === 'dns' && <DnsPanel result={result} />}
          {tab === 'content' && <ContentPanel result={result} />}
          {tab === 'subdomains' && <SubdomainsPanel result={result} />}
          {tab === 'checks' && <ChecksPanel result={result} />}
        </div>
      </div>
    </div>
  );
}

function ScoreHeader({ result, openCount }: { result: ScanResult; openCount: number }) {
  const color = scoreColor(result.overallScore);
  return (
    <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex items-center gap-5 shrink-0">
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="#e9dab8" strokeWidth="6" fill="none" />
              <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - result.overallScore / 100)} className="transition-all duration-700" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold tabular" style={{ color }}>{result.overallScore}</span>
              <span className="text-xs text-[#a6906a] uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="space-y-2">
            <span className={cn('inline-block px-2.5 py-1 rounded text-sm font-bold tracking-wide', gradeBadge(result.grade))}>{result.grade ?? '—'}</span>
            <div className="text-xs text-[#937d57] space-y-0.5">
              <p className="tabular">{openCount} open finding{openCount === 1 ? '' : 's'}</p>
              <p className="tabular">{((result.durationMs ?? result.duration * 1000) / 1000).toFixed(1)}s · {result.checks?.length ?? 0} checks</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-3.5 w-3.5 text-[#a6906a] shrink-0" />
            <a href={result.finalUrl ?? result.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#6b572f] hover:text-[#47601f] truncate transition-colors">{result.finalUrl ?? result.url}</a>
            {result.httpStatus ? <span className="text-xs text-[#a6906a] font-mono shrink-0">HTTP {result.httpStatus}</span> : null}
          </div>
          <p className="text-xs text-[#6b572f] leading-relaxed">{result.aiSummary}</p>
          {result.scoreBreakdown && result.scoreBreakdown.length > 0 && (
            <div className="pt-1">
              <p className="text-xs uppercase tracking-wider text-[#a6906a] mb-1.5">Score deductions</p>
              <div className="flex flex-wrap gap-1.5">
                {result.scoreBreakdown.map((component) => (
                  <span key={component.category} className="text-sm px-2 py-1 rounded bg-[#efe1c4] border border-[#e3d2a9] text-[#6b572f]">
                    {component.category}<span className="ml-1.5 text-[#8a3122] tabular">−{component.deducted}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <ScoreExplainer result={result} />
          {result.redirectChain && result.redirectChain.length > 0 && (
            <p className="text-sm text-[#a6906a] font-mono truncate">Redirects: {result.redirectChain.join(' → ')} → {result.finalUrl}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The score is the one number people quote, so it should not be a black box.
 * This shows the actual arithmetic — 100 minus each category's deduction — plus
 * the two rules that surprise people: severity pricing, and the discount that
 * stops one weak area from dominating the result.
 */
function ScoreExplainer({ result }: { result: ScanResult }) {
  const [open, setOpen] = useState(false);
  const breakdown = result.scoreBreakdown ?? [];
  const total = Math.round(breakdown.reduce((sum, c) => sum + c.deducted, 0) * 10) / 10;

  return (
    <div className="pt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#47601f] hover:opacity-70 cursor-pointer transition-opacity"
      >
        How is this scored?
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2.5 rounded-lg border border-[#e3d2a9] bg-[#faf4e8] p-4 space-y-4">
          <div>
            <p className="text-sm text-[#4a3b1f] leading-relaxed">
              Every scan starts at <span className="font-semibold text-[#2a2013]">100</span>. Each issue found subtracts
              points based on how serious it is. Nothing is added back — the score only goes down from 100.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-[#a6906a] mb-2">The arithmetic for this scan</p>
            <div className="font-mono text-sm space-y-1">
              <div className="flex justify-between gap-4 text-[#4a3b1f]">
                <span>Starting score</span><span className="tabular">100</span>
              </div>
              {breakdown.map((component) => (
                <div key={component.category} className="flex justify-between gap-4 text-[#6b572f]">
                  <span className="truncate">− {component.category} <span className="text-[#a6906a]">({component.label})</span></span>
                  <span className="tabular text-[#8a3122] shrink-0">−{component.deducted}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 pt-1.5 mt-1.5 border-t border-[#e3d2a9] font-semibold text-[#2a2013]">
                <span>Final score</span>
                <span className="tabular">100 − {total} = {result.overallScore}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-[#a6906a] mb-2">What each severity costs</p>
            <div className="flex flex-wrap gap-1.5">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
                <span key={severity} className="text-sm px-2 py-1 rounded bg-[#efe1c4] border border-[#e3d2a9] text-[#6b572f]">
                  {severity}<span className="ml-1.5 text-[#8a3122] tabular">−{SEVERITY_WEIGHT[severity]}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-[#e3d2a9]">
            <p className="text-sm text-[#6b572f] leading-relaxed">
              <span className="font-semibold text-[#4a3b1f]">Repeats cost less.</span> Within one category only the first
              issue is charged in full — the next ones count for 60%, 35%, then 20%. One weak area cannot sink the whole score.
            </p>
            <p className="text-sm text-[#6b572f] leading-relaxed">
              <span className="font-semibold text-[#4a3b1f]">Failed checks never deduct.</span> If a lookup could not
              complete, it is excluded rather than counted against you — see the Checks tab for coverage.
            </p>
            <p className="text-sm text-[#6b572f] leading-relaxed">
              <span className="font-semibold text-[#4a3b1f]">Grades:</span> A+ 95+ · A 85+ · B 75+ · C 65+ · D 50+ · F below 50.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FindingsPanel({ result }: { result: ScanResult }) {
  if (result.recommendations.length === 0) {
    return <Empty icon={<ShieldCheck className="h-5 w-5 text-[#47601f]" />} title="No findings" detail="Every check that ran completed without raising an issue. Review the Checks tab to confirm coverage." />;
  }
  return <div className="space-y-2">{result.recommendations.map((finding) => <FindingRow key={finding.id} finding={finding} />)}</div>;
}

function FindingRow({ finding }: { finding: ScanRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const { toggleResolved } = useScan();

  return (
    <div className={cn('border rounded-md transition-colors', finding.resolved ? 'border-[#7f9548]/20 bg-[#7f9548]/4' : 'border-[#e3d2a9] bg-[#fffbf3] hover:border-[#cbae72]')}>
      <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="w-full flex items-start gap-3 p-3 text-left cursor-pointer">
        <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', finding.resolved ? 'bg-[#7f9548]' : severityDot(finding.priority))} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-xs font-semibold', finding.resolved ? 'text-[#937d57] line-through' : 'text-[#2a2013]')}>{finding.title}</span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', severityBadge(finding.priority))}>{finding.priority}</span>
            {finding.scoreImpact ? <span className="text-xs text-[#a6906a] tabular">−{finding.scoreImpact} pts</span> : null}
          </div>
          <p className="text-xs text-[#6b572f] mt-1 leading-relaxed">{finding.description}</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-[#a6906a] shrink-0 transition-transform mt-0.5', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-8 space-y-3 border-t border-[#e9dab8] pt-3">
          {finding.evidence && finding.evidence.length > 0 && (
            <Section label="Evidence">
              <div className="space-y-1">
                {finding.evidence.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:gap-2 text-sm">
                    <span className="text-[#a6906a] font-mono shrink-0 sm:min-w-40">{item.label}</span>
                    <span className="text-[#4a3b1f] font-mono break-all">{item.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {finding.impact && <Section label="Why it matters"><p className="text-sm text-[#6b572f] leading-relaxed">{finding.impact}</p></Section>}
          {finding.remediation && <Section label="Fix"><p className="text-sm text-[#6b572f] leading-relaxed">{finding.remediation}</p></Section>}
          {finding.fix && finding.fix.length > 0 && (
            <Section label="Configuration">
              <div className="space-y-2">{finding.fix.map((snippet, index) => <CodeBlock key={index} label={snippet.label} code={snippet.code} />)}</div>
            </Section>
          )}
          {!finding.resolved && finding.scoreImpact !== undefined && finding.scoreImpact > 0 && (
            <Section label="Score impact">
              <ScoreImpactNote priority={finding.priority} applied={finding.scoreImpact} />
            </Section>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {finding.cwe && <span className="text-xs font-mono text-[#937d57]">{finding.cwe}</span>}
            {finding.owasp && <span className="text-xs font-mono text-[#937d57]">{finding.owasp}</span>}
            {finding.confidence && <span className="text-xs text-[#a6906a]">confidence: {finding.confidence}</span>}
            {finding.references?.map((reference) => (
              <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#47601f] hover:underline inline-flex items-center gap-1">{reference.label}<ExternalLink className="h-2.5 w-2.5" /></a>
            ))}
          </div>
          <button onClick={() => void toggleResolved(finding.id)} className={cn('text-xs font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded border transition-colors cursor-pointer', finding.resolved ? 'border-[#e3d2a9] text-[#937d57] hover:text-[#8a3122] hover:border-[#a8402e]/40' : 'border-[#7f9548]/30 text-[#47601f] hover:bg-[#7f9548]/10')}>
            {finding.resolved ? 'Reopen' : 'Mark resolved'}
          </button>
        </div>
      )}
    </div>
  );
}

function PortsPanel({ result }: { result: ScanResult }) {
  const ports = result.openPorts ?? [];
  const isActive = result.scanMode === 'active' || ports.length > 1;

  if (ports.length === 0) {
    return (
      <Empty
        icon={<Server className="h-5 w-5 text-[#937d57]" />}
        title="No open ports detected"
        detail="No responding TCP ports were found for this target."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-[#efe1c4] border border-[#e3d2a9]">
        <div>
          <p className="text-xs font-semibold text-[#2a2013]">
            {isActive ? 'Active TCP Port Audit' : 'Observed Web Ports (Passive)'}
          </p>
          <p className="text-xs text-[#937d57] mt-0.5">
            {isActive
              ? 'Probed top high-impact services (Databases, Remote Access, Mail, Web).'
              : 'Only standard web ports observed during passive HTTP inspection. Run an Active Deep Scan to probe database and administrative ports.'}
          </p>
        </div>
        <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-[#fffbf3] border border-[#e3d2a9] text-[#6b572f] shrink-0 self-start sm:self-auto">
          {ports.length} Open Port{ports.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="border border-[#e3d2a9] rounded-md overflow-hidden bg-[#fffbf3]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#efe1c4] border-b border-[#e3d2a9] text-[#937d57] uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3">Port</th>
              <th className="py-2.5 px-3">Service</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Risk</th>
              <th className="py-2.5 px-3">Evidence / Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9dab8]">
            {ports.map((p) => (
              <tr key={`${p.number}-${p.protocol}`} className="hover:bg-[#efe1c4]/40 transition-colors">
                <td className="py-2.5 px-3 font-mono font-semibold text-[#2a2013]">
                  {p.number} <span className="text-[#937d57] text-[10px] font-normal">/{p.protocol.toUpperCase()}</span>
                </td>
                <td className="py-2.5 px-3 font-medium text-[#4a3b1f]">
                  {p.service}
                  {p.version && <span className="text-[#937d57] ml-1.5 font-mono text-[11px]">v{p.version}</span>}
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#6b7f3a]/15 text-[#47601f] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6b7f3a]" />
                    {p.state}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className={cn('text-[11px] font-semibold uppercase px-2 py-0.5 rounded', severityBadge(p.risk))}>
                    {p.risk}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-[#6b572f] max-w-md">
                  <p>{p.description}</p>
                  {p.evidence && (
                    <p className="font-mono text-[11px] text-[#937d57] mt-0.5 truncate">{p.evidence}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeadersPanel({ result }: { result: ScanResult }) {
  if (result.securityHeaders.length === 0) return <Empty title="No header data" detail="The HTTP response could not be inspected." />;
  return (
    <div className="divide-y divide-[#e9dab8]">
      {result.securityHeaders.map((header) => (
        <div key={header.name} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#2a2013]">{header.name}</span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', statusBadge(header.status))}>{header.status}</span>
          </div>
          <p className="text-sm text-[#937d57] mt-1 leading-relaxed">{header.description}</p>
          {header.value && <p className="text-sm font-mono text-[#6b572f] mt-1.5 break-all bg-[#efe1c4] border border-[#e9dab8] rounded px-2 py-1.5">{header.value}</p>}
          {header.issue && <p className="text-sm text-[#8a3122] mt-1.5 leading-relaxed">{header.issue}</p>}
          {header.status === 'missing' && <p className="text-sm text-[#6b572f] mt-1.5">{header.recommendation}</p>}
        </div>
      ))}
    </div>
  );
}

function TlsPanel({ result }: { result: ScanResult }) {
  const { ssl } = result;
  if (ssl.status === 'not_applicable') return <Empty icon={<AlertCircle className="h-5 w-5 text-[#8a3122]" />} title="No TLS certificate" detail="The target was served over plain HTTP, so no certificate was presented." />;
  if (ssl.status === 'unknown') return <Empty icon={<MinusCircle className="h-5 w-5 text-[#6b572f]" />} title="Certificate could not be inspected" detail={ssl.validationError ?? 'The TLS handshake did not complete.'} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-xs px-2 py-1 rounded font-bold', gradeBadge(ssl.grade))}>Grade {ssl.grade}</span>
        <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', statusBadge(ssl.status))}>{ssl.status.replace('_', ' ')}</span>
        {ssl.validated === false && <span className="text-sm text-[#8a3122]">{ssl.validationError}</span>}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Subject" value={ssl.subject} mono />
        <Field label="Issuer" value={ssl.issuer} />
        <Field label="Valid" value={ssl.validFrom && ssl.validTo ? `${ssl.validFrom.slice(0, 10)} → ${ssl.validTo.slice(0, 10)}` : 'unknown'} mono />
        <Field label="Days remaining" value={String(ssl.daysRemaining)} mono tone={ssl.daysRemaining <= 30 ? 'bad' : 'good'} />
        <Field label="Protocol" value={ssl.protocol ?? 'unknown'} mono />
        <Field label="Cipher" value={ssl.cipher ?? 'unknown'} mono />
        <Field label="Public key" value={ssl.keySize > 0 ? `${ssl.algorithm} ${ssl.keySize} bits` : ssl.algorithm} mono />
        <Field label="Chain validates" value={ssl.validated ? 'yes' : 'no'} tone={ssl.validated ? 'good' : 'bad'} />
        <Field label="Hostname match" value={ssl.hostnameMatch === undefined ? 'unknown' : ssl.hostnameMatch ? 'yes' : 'no'} tone={ssl.hostnameMatch ? 'good' : 'bad'} />
        <Field label="Self-signed" value={ssl.selfSigned ? 'yes' : 'no'} tone={ssl.selfSigned ? 'bad' : 'good'} />
      </dl>
      {ssl.chain.length > 0 && (
        <Section label="Chain">
          <ol className="space-y-1">{ssl.chain.map((entry, index) => <li key={index} className="text-sm font-mono text-[#6b572f]"><span className="text-[#a6906a]">{index === 0 ? 'leaf' : `ca ${index}`}</span> · {entry}</li>)}</ol>
        </Section>
      )}
      {ssl.sans && ssl.sans.length > 0 && (
        <Section label={`Subject alternative names (${ssl.sans.length})`}>
          <p className="text-sm font-mono text-[#6b572f] break-all leading-relaxed">{ssl.sans.slice(0, 30).join(', ')}{ssl.sans.length > 30 ? ` … +${ssl.sans.length - 30} more` : ''}</p>
        </Section>
      )}
      <Section label="SHA-256 fingerprint"><p className="text-sm font-mono text-[#937d57] break-all">{ssl.fingerprint}</p></Section>
    </div>
  );
}

function DnsPanel({ result }: { result: ScanResult }) {
  const { dns, emailSecurity } = result;
  if (!dns) return <Empty title="No DNS data" detail="DNS records are not queried for local targets." />;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <Field label="IPv4" value={dns.ipv4.join(', ') || 'none'} mono />
        <Field label="IPv6" value={dns.ipv6.join(', ') || 'none'} mono />
        <Field label="Nameservers" value={dns.nameservers.join(', ') || 'none'} mono />
        <Field label="Mail exchangers" value={dns.mxHosts.join(', ') || 'none'} mono />
        <Field label="DNSSEC" value={dns.dnssec} tone={dns.dnssec === 'validated' ? 'good' : dns.dnssec === 'unsigned' ? 'bad' : 'neutral'} />
        <Field label="CAA" value={dns.caa.present ? dns.caa.records.join(', ') : 'no records'} mono tone={dns.caa.present ? 'good' : 'bad'} />
      </dl>
      <Section label="SPF">
        {dns.spf.present ? (
          <div className="space-y-1.5">
            <p className="text-sm font-mono text-[#6b572f] break-all bg-[#efe1c4] border border-[#e9dab8] rounded px-2 py-1.5">{dns.spf.record}</p>
            <p className="text-sm text-[#937d57]">Terminating qualifier: <span className="text-[#4a3b1f]">{dns.spf.qualifier}</span>{dns.spf.lookupCount !== undefined && <> · <span className="tabular">{dns.spf.lookupCount}</span>/10 DNS lookups</>}</p>
            {dns.spf.issues.map((issue, index) => <p key={index} className="text-sm text-[#8a3122]">{issue}</p>)}
          </div>
        ) : <p className="text-sm text-[#8a3122]">No v=spf1 record published.</p>}
      </Section>
      <Section label="DMARC">
        {dns.dmarc.present ? (
          <div className="space-y-1.5">
            <p className="text-sm font-mono text-[#6b572f] break-all bg-[#efe1c4] border border-[#e9dab8] rounded px-2 py-1.5">{dns.dmarc.record}</p>
            <p className="text-sm text-[#937d57]">Policy <span className="text-[#4a3b1f]">{dns.dmarc.policy}</span>{dns.dmarc.subdomainPolicy && <> · subdomains {dns.dmarc.subdomainPolicy}</>}{dns.dmarc.percentage !== undefined && <> · pct {dns.dmarc.percentage}</>} · reporting {dns.dmarc.reportingEnabled ? 'on' : 'off'}</p>
            {dns.dmarc.issues.map((issue, index) => <p key={index} className="text-sm text-[#8a3122]">{issue}</p>)}
          </div>
        ) : <p className="text-sm text-[#8a3122]">No DMARC record published.</p>}
      </Section>
      {emailSecurity && (
        <Section label="Spoofing risk">
          <p className="text-sm text-[#6b572f] leading-relaxed"><span className={cn('font-semibold uppercase', emailSecurity.spoofingRisk === 'low' ? 'text-[#47601f]' : 'text-[#8a3122]')}>{emailSecurity.spoofingRisk}</span>{' — '}{emailSecurity.details}</p>
        </Section>
      )}
    </div>
  );
}

function ContentPanel({ result }: { result: ScanResult }) {
  const { content, subresourceIntegrity: sri, technologies, cookieAnalysis } = result;
  return (
    <div className="space-y-5">
      <Section label="Technologies">
        {technologies.length === 0 ? <p className="text-sm text-[#937d57]">Nothing positively identified.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {technologies.map((tech) => (
              <div key={tech.name} className={cn('p-2.5 rounded border bg-[#fffbf3]', tech.isOutdated ? 'border-[#a8402e]/35' : 'border-[#e3d2a9]')}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-[#2a2013] truncate">{tech.name}</span>
                  <span className="text-xs font-mono text-[#6b572f] shrink-0">{tech.version ?? '—'}</span>
                </div>
                <p className="text-xs text-[#a6906a] mt-0.5">{tech.category}</p>
                {tech.evidence && <p className="text-xs text-[#a6906a] mt-1 font-mono truncate">{tech.evidence}</p>}
                {tech.isOutdated && <p className="text-xs text-[#8a3122] mt-1.5 leading-relaxed">Outdated{tech.latestKnown ? ` — current is ${tech.latestKnown}` : ''}{tech.cveCount ? ` · ${tech.cveCount} known CVE(s)` : ''}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
      {sri && (
        <Section label="Subresource integrity">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="External scripts" value={String(sri.totalExternalScripts)} mono />
            <Field label="Without SRI" value={String(sri.missingSriCount)} mono tone={sri.missingSriCount > 0 ? 'bad' : 'good'} />
            <Field label="External styles" value={String(sri.totalExternalStyles ?? 0)} mono />
            <Field label="Styles without SRI" value={String(sri.missingStyleSriCount ?? 0)} mono tone={(sri.missingStyleSriCount ?? 0) > 0 ? 'bad' : 'good'} />
          </dl>
        </Section>
      )}
      <Section label="Cookies">
        {cookieAnalysis.total === 0 ? <p className="text-sm text-[#937d57]">No cookies were set on this response.</p> : (
          <div className="space-y-1.5">
            <p className="text-sm text-[#6b572f] tabular">{cookieAnalysis.total} total · {cookieAnalysis.httpOnly} HttpOnly · {cookieAnalysis.secure} Secure · {cookieAnalysis.sameSite} SameSite</p>
            {cookieAnalysis.issues?.map((issue, index) => <p key={index} className="text-sm text-[#8a3122] font-mono">{issue}</p>)}
          </div>
        )}
      </Section>
      {content && (
        <>
          <Section label="Page">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="HTML analysed" value={`${(content.htmlBytes / 1024).toFixed(1)} KB`} mono />
              <Field label="Mixed content" value={String(content.mixedContentItems.length)} mono tone={content.mixedContentItems.length > 0 ? 'bad' : 'good'} />
              <Field label="Password fields" value={String(content.passwordFieldCount)} mono />
              <Field label="Directory listing" value={content.directoryListing ? 'yes' : 'no'} tone={content.directoryListing ? 'bad' : 'good'} />
            </dl>
          </Section>
          {content.mixedContentItems.length > 0 && (
            <Section label="Mixed content references">
              <div className="space-y-1">
                {content.mixedContentItems.slice(0, 12).map((item, index) => (
                  <p key={index} className="text-sm font-mono text-[#6b572f] break-all"><span className={item.kind === 'active' ? 'text-[#8a3122]' : 'text-[#a6906a]'}>[{item.kind}] &lt;{item.element}&gt;</span> {item.url}</p>
                ))}
              </div>
            </Section>
          )}
          {content.disclosedPaths.length > 0 && (
            <Section label="Paths disclosed by robots.txt">
              <div className="flex flex-wrap gap-1.5">{content.disclosedPaths.map((path) => <span key={path} className="text-sm font-mono px-2 py-0.5 rounded bg-[#efe1c4] border border-[#e3d2a9] text-[#6b572f]">{path}</span>)}</div>
              <p className="text-xs text-[#a6906a] mt-2">Listed in robots.txt. These paths were not requested by the scanner.</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function SubdomainsPanel({ result }: { result: ScanResult }) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>((result.subdomains?.length ?? 0) > 0 ? 'loaded' : 'idle');
  const [subdomains, setSubdomains] = useState<string[]>(result.subdomains ?? []);
  const [error, setError] = useState<string | null>(null);

  const host = (() => { try { return new URL(result.finalUrl ?? result.url).hostname; } catch { return ''; } })();

  const load = async () => {
    setState('loading'); setError(null);
    try {
      const res = await fetch(`/api/scan/subdomains?host=${encodeURIComponent(host)}`);
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Lookup failed.'); setState('error'); return; }
      setSubdomains(json.data.subdomains ?? []); setState('loaded');
    } catch (err) { setError(err instanceof Error ? err.message : 'Lookup failed.'); setState('error'); }
  };

  if (state === 'idle' || state === 'loading' || state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <Globe className="h-5 w-5 text-[#a6906a]" />
        <p className="text-xs font-semibold text-[#4a3b1f]">Subdomain discovery</p>
        <p className="text-sm text-[#937d57] max-w-md leading-relaxed">Queries public Certificate Transparency logs for names published under <span className="font-mono text-[#6b572f]">{host}</span>. No traffic is sent to the target. Runs separately because the CT service is often slow.</p>
        {error && <p className="text-sm text-[#8a3122] max-w-md">{error}</p>}
        <button onClick={() => void load()} disabled={state === 'loading' || !host} className="mt-1 h-8 px-3.5 inline-flex items-center gap-2 rounded-md border border-[#7f9548]/30 text-[#47601f] hover:bg-[#7f9548]/10 disabled:opacity-50 text-sm font-semibold uppercase tracking-wider transition-colors cursor-pointer">
          {state === 'loading' ? 'Looking up…' : state === 'error' ? 'Retry' : 'Discover subdomains'}
        </button>
      </div>
    );
  }

  if (subdomains.length === 0) return <Empty title="No subdomains found" detail="No entries for this domain in the CT logs." />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#937d57]">{subdomains.length} name{subdomains.length === 1 ? '' : 's'} from public Certificate Transparency logs. No traffic was sent to these hosts.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {subdomains.map((subdomain) => (
          <a key={subdomain} href={`https://${subdomain}`} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-[#e3d2a9] bg-[#fffbf3] hover:border-[#7f9548]/40 transition-colors">
            <span className="font-mono text-sm text-[#6b572f] group-hover:text-[#2a2013] truncate transition-colors">{subdomain}</span>
            <ExternalLink className="h-3 w-3 text-[#a6906a] shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

function ChecksPanel({ result }: { result: ScanResult }) {
  const checks = result.checks ?? [];
  if (checks.length === 0) return <Empty title="No check log" detail="This scan predates check diagnostics." />;
  return (
    <div className="space-y-1">
      <p className="text-sm text-[#937d57] mb-3">Every check this scan attempted. Failed checks are excluded from the score — a lookup that did not complete is not evidence either way.</p>
      {checks.map((check) => (
        <div key={check.id} className="flex items-start gap-3 py-2 border-b border-[#e9dab8] last:border-0">
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5 w-12 text-center', statusBadge(check.status))}>{check.status}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#2a2013]">{check.label}</p>
            <p className="text-sm text-[#937d57] font-mono break-words mt-0.5">{check.detail}</p>
          </div>
          {check.durationMs !== undefined && <span className="text-xs text-[#a6906a] tabular shrink-0">{check.durationMs}ms</span>}
        </div>
      ))}
    </div>
  );
}

/** Explains where this finding's point deduction came from, including the
 *  repeat discount — otherwise "−7.2 pts" looks arbitrary next to a −12 rule. */
function ScoreImpactNote({ priority, applied }: { priority: Severity; applied: number }) {
  const base = SEVERITY_WEIGHT[priority];
  const discounted = base > 0 && applied < base - 0.05;
  const percent = base > 0 ? Math.round((applied / base) * 100) : 100;

  return (
    <p className="text-sm text-[#6b572f] leading-relaxed">
      A <span className="font-semibold text-[#4a3b1f]">{priority}</span> finding normally costs{' '}
      <span className="tabular text-[#8a3122]">−{base}</span> points.{' '}
      {discounted ? (
        <>
          Another finding in this category was already charged in full, so this one counts at {percent}% —{' '}
          <span className="tabular text-[#8a3122]">−{applied}</span> points.
        </>
      ) : (
        <>
          It was charged in full here: <span className="tabular text-[#8a3122]">−{applied}</span> points.
        </>
      )}
    </p>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs uppercase tracking-wider text-[#a6906a] mb-1.5">{label}</p>{children}</div>;
}

function Field({ label, value, mono, tone = 'neutral' }: { label: string; value: string; mono?: boolean; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-[#a6906a]">{label}</dt>
      <dd className={cn('text-xs mt-0.5 break-words', mono && 'font-mono', tone === 'good' ? 'text-[#47601f]' : tone === 'bad' ? 'text-[#8a3122]' : 'text-[#4a3b1f]')}>{value}</dd>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* denied */ }
  };
  return (
    <div className="border border-[#e9dab8] rounded bg-[#efe1c4] overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e9dab8]">
        <span className="text-xs uppercase tracking-wider text-[#a6906a]">{label}</span>
        <button onClick={copy} className="text-xs text-[#937d57] hover:text-[#47601f] inline-flex items-center gap-1 cursor-pointer transition-colors">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-2.5 text-sm font-mono text-[#4a3b1f] overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function Empty({ icon, title, detail }: { icon?: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      {icon}
      <p className="text-xs font-semibold text-[#4a3b1f]">{title}</p>
      <p className="text-sm text-[#937d57] max-w-md leading-relaxed">{detail}</p>
    </div>
  );
}
