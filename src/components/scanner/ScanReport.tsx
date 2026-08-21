'use client';

/**
 * Full scan report. Findings first (each with evidence, consequence, and the
 * exact change to make); raw observations behind tabs; a Checks tab so the
 * coverage behind the score is visible.
 */

import React, { useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, Globe, ShieldCheck, AlertCircle, MinusCircle } from 'lucide-react';
import type { ScanRecommendation, ScanResult } from '@/types/scanner';
import { useScan } from '@/providers/ScanProvider';
import { cn } from '@/lib/utils';
import { gradeBadge, scoreColor, severityBadge, severityDot, statusBadge } from '@/lib/severity';

type SubTab = 'findings' | 'headers' | 'tls' | 'dns' | 'content' | 'subdomains' | 'checks';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'findings', label: 'Findings' },
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
      <ScoreHeader result={result} openCount={openFindings.length} />
      <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg">
        <div className="flex flex-wrap gap-0.5 px-2 pt-2 border-b border-[#242424]">
          {TABS.map((entry) => (
            <button key={entry.id} onClick={() => setTab(entry.id)}
              className={cn('px-3 py-2 text-xs font-medium rounded-t-md transition-colors cursor-pointer border-b-2 -mb-px', tab === entry.id ? 'text-[#f5f5f5] border-[#22c55e]' : 'text-[#71717a] border-transparent hover:text-[#d4d4d8]')}>
              {entry.label}
              {entry.id === 'findings' && openFindings.length > 0 && <span className="ml-1.5 text-[#52525b] tabular">{openFindings.length}</span>}
              {entry.id === 'subdomains' && (result.subdomains?.length ?? 0) > 0 && <span className="ml-1.5 text-[#52525b] tabular">{result.subdomains?.length}</span>}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          {tab === 'findings' && <FindingsPanel result={result} />}
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
    <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg p-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex items-center gap-5 shrink-0">
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="#1a1a1a" strokeWidth="6" fill="none" />
              <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - result.overallScore / 100)} className="transition-all duration-700" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold tabular" style={{ color }}>{result.overallScore}</span>
              <span className="text-[10px] text-[#52525b] uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="space-y-2">
            <span className={cn('inline-block px-2.5 py-1 rounded text-sm font-bold tracking-wide', gradeBadge(result.grade))}>{result.grade ?? '—'}</span>
            <div className="text-xs text-[#71717a] space-y-0.5">
              <p className="tabular">{openCount} open finding{openCount === 1 ? '' : 's'}</p>
              <p className="tabular">{((result.durationMs ?? result.duration * 1000) / 1000).toFixed(1)}s · {result.checks?.length ?? 0} checks</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-3.5 w-3.5 text-[#52525b] shrink-0" />
            <a href={result.finalUrl ?? result.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#a1a1aa] hover:text-[#4ade80] truncate transition-colors">{result.finalUrl ?? result.url}</a>
            {result.httpStatus ? <span className="text-[10px] text-[#52525b] font-mono shrink-0">HTTP {result.httpStatus}</span> : null}
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">{result.aiSummary}</p>
          {result.scoreBreakdown && result.scoreBreakdown.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-wider text-[#52525b] mb-1.5">Score deductions</p>
              <div className="flex flex-wrap gap-1.5">
                {result.scoreBreakdown.map((component) => (
                  <span key={component.category} className="text-[11px] px-2 py-1 rounded bg-[#161616] border border-[#242424] text-[#a1a1aa]">
                    {component.category}<span className="ml-1.5 text-[#f87171] tabular">−{component.deducted}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.redirectChain && result.redirectChain.length > 0 && (
            <p className="text-[11px] text-[#52525b] font-mono truncate">Redirects: {result.redirectChain.join(' → ')} → {result.finalUrl}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingsPanel({ result }: { result: ScanResult }) {
  if (result.recommendations.length === 0) {
    return <Empty icon={<ShieldCheck className="h-5 w-5 text-[#4ade80]" />} title="No findings" detail="Every check that ran completed without raising an issue. Review the Checks tab to confirm coverage." />;
  }
  return <div className="space-y-2">{result.recommendations.map((finding) => <FindingRow key={finding.id} finding={finding} />)}</div>;
}

function FindingRow({ finding }: { finding: ScanRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const { toggleResolved } = useScan();

  return (
    <div className={cn('border rounded-md transition-colors', finding.resolved ? 'border-[#22c55e]/20 bg-[#22c55e]/4' : 'border-[#242424] bg-[#0a0a0a] hover:border-[#333333]')}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-start gap-3 p-3 text-left cursor-pointer">
        <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', finding.resolved ? 'bg-[#22c55e]' : severityDot(finding.priority))} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-xs font-semibold', finding.resolved ? 'text-[#71717a] line-through' : 'text-[#f5f5f5]')}>{finding.title}</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', severityBadge(finding.priority))}>{finding.priority}</span>
            {finding.scoreImpact ? <span className="text-[10px] text-[#52525b] tabular">−{finding.scoreImpact} pts</span> : null}
          </div>
          <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">{finding.description}</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-[#52525b] shrink-0 transition-transform mt-0.5', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-8 space-y-3 border-t border-[#1a1a1a] pt-3">
          {finding.evidence && finding.evidence.length > 0 && (
            <Section label="Evidence">
              <div className="space-y-1">
                {finding.evidence.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:gap-2 text-[11px]">
                    <span className="text-[#52525b] font-mono shrink-0 sm:min-w-40">{item.label}</span>
                    <span className="text-[#d4d4d8] font-mono break-all">{item.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {finding.impact && <Section label="Why it matters"><p className="text-[11px] text-[#a1a1aa] leading-relaxed">{finding.impact}</p></Section>}
          {finding.remediation && <Section label="Fix"><p className="text-[11px] text-[#a1a1aa] leading-relaxed">{finding.remediation}</p></Section>}
          {finding.fix && finding.fix.length > 0 && (
            <Section label="Configuration">
              <div className="space-y-2">{finding.fix.map((snippet, index) => <CodeBlock key={index} label={snippet.label} code={snippet.code} />)}</div>
            </Section>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {finding.cwe && <span className="text-[10px] font-mono text-[#71717a]">{finding.cwe}</span>}
            {finding.owasp && <span className="text-[10px] font-mono text-[#71717a]">{finding.owasp}</span>}
            {finding.confidence && <span className="text-[10px] text-[#52525b]">confidence: {finding.confidence}</span>}
            {finding.references?.map((reference) => (
              <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#4ade80] hover:underline inline-flex items-center gap-1">{reference.label}<ExternalLink className="h-2.5 w-2.5" /></a>
            ))}
          </div>
          <button onClick={() => void toggleResolved(finding.id)} className={cn('text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded border transition-colors cursor-pointer', finding.resolved ? 'border-[#242424] text-[#71717a] hover:text-[#f87171] hover:border-[#dc2626]/40' : 'border-[#22c55e]/30 text-[#4ade80] hover:bg-[#22c55e]/10')}>
            {finding.resolved ? 'Reopen' : 'Mark resolved'}
          </button>
        </div>
      )}
    </div>
  );
}

function HeadersPanel({ result }: { result: ScanResult }) {
  if (result.securityHeaders.length === 0) return <Empty title="No header data" detail="The HTTP response could not be inspected." />;
  return (
    <div className="divide-y divide-[#1a1a1a]">
      {result.securityHeaders.map((header) => (
        <div key={header.name} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#f5f5f5]">{header.name}</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', statusBadge(header.status))}>{header.status}</span>
          </div>
          <p className="text-[11px] text-[#71717a] mt-1 leading-relaxed">{header.description}</p>
          {header.value && <p className="text-[11px] font-mono text-[#a1a1aa] mt-1.5 break-all bg-[#000000] border border-[#1a1a1a] rounded px-2 py-1.5">{header.value}</p>}
          {header.issue && <p className="text-[11px] text-[#f87171] mt-1.5 leading-relaxed">{header.issue}</p>}
          {header.status === 'missing' && <p className="text-[11px] text-[#a1a1aa] mt-1.5">{header.recommendation}</p>}
        </div>
      ))}
    </div>
  );
}

function TlsPanel({ result }: { result: ScanResult }) {
  const { ssl } = result;
  if (ssl.status === 'not_applicable') return <Empty icon={<AlertCircle className="h-5 w-5 text-[#f87171]" />} title="No TLS certificate" detail="The target was served over plain HTTP, so no certificate was presented." />;
  if (ssl.status === 'unknown') return <Empty icon={<MinusCircle className="h-5 w-5 text-[#a1a1aa]" />} title="Certificate could not be inspected" detail={ssl.validationError ?? 'The TLS handshake did not complete.'} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-xs px-2 py-1 rounded font-bold', gradeBadge(ssl.grade))}>Grade {ssl.grade}</span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', statusBadge(ssl.status))}>{ssl.status.replace('_', ' ')}</span>
        {ssl.validated === false && <span className="text-[11px] text-[#f87171]">{ssl.validationError}</span>}
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
          <ol className="space-y-1">{ssl.chain.map((entry, index) => <li key={index} className="text-[11px] font-mono text-[#a1a1aa]"><span className="text-[#52525b]">{index === 0 ? 'leaf' : `ca ${index}`}</span> · {entry}</li>)}</ol>
        </Section>
      )}
      {ssl.sans && ssl.sans.length > 0 && (
        <Section label={`Subject alternative names (${ssl.sans.length})`}>
          <p className="text-[11px] font-mono text-[#a1a1aa] break-all leading-relaxed">{ssl.sans.slice(0, 30).join(', ')}{ssl.sans.length > 30 ? ` … +${ssl.sans.length - 30} more` : ''}</p>
        </Section>
      )}
      <Section label="SHA-256 fingerprint"><p className="text-[11px] font-mono text-[#71717a] break-all">{ssl.fingerprint}</p></Section>
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
            <p className="text-[11px] font-mono text-[#a1a1aa] break-all bg-[#000000] border border-[#1a1a1a] rounded px-2 py-1.5">{dns.spf.record}</p>
            <p className="text-[11px] text-[#71717a]">Terminating qualifier: <span className="text-[#d4d4d8]">{dns.spf.qualifier}</span>{dns.spf.lookupCount !== undefined && <> · <span className="tabular">{dns.spf.lookupCount}</span>/10 DNS lookups</>}</p>
            {dns.spf.issues.map((issue, index) => <p key={index} className="text-[11px] text-[#f87171]">{issue}</p>)}
          </div>
        ) : <p className="text-[11px] text-[#f87171]">No v=spf1 record published.</p>}
      </Section>
      <Section label="DMARC">
        {dns.dmarc.present ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono text-[#a1a1aa] break-all bg-[#000000] border border-[#1a1a1a] rounded px-2 py-1.5">{dns.dmarc.record}</p>
            <p className="text-[11px] text-[#71717a]">Policy <span className="text-[#d4d4d8]">{dns.dmarc.policy}</span>{dns.dmarc.subdomainPolicy && <> · subdomains {dns.dmarc.subdomainPolicy}</>}{dns.dmarc.percentage !== undefined && <> · pct {dns.dmarc.percentage}</>} · reporting {dns.dmarc.reportingEnabled ? 'on' : 'off'}</p>
            {dns.dmarc.issues.map((issue, index) => <p key={index} className="text-[11px] text-[#f87171]">{issue}</p>)}
          </div>
        ) : <p className="text-[11px] text-[#f87171]">No DMARC record published.</p>}
      </Section>
      {emailSecurity && (
        <Section label="Spoofing risk">
          <p className="text-[11px] text-[#a1a1aa] leading-relaxed"><span className={cn('font-semibold uppercase', emailSecurity.spoofingRisk === 'low' ? 'text-[#4ade80]' : 'text-[#f87171]')}>{emailSecurity.spoofingRisk}</span>{' — '}{emailSecurity.details}</p>
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
        {technologies.length === 0 ? <p className="text-[11px] text-[#71717a]">Nothing positively identified.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {technologies.map((tech) => (
              <div key={tech.name} className={cn('p-2.5 rounded border bg-[#0a0a0a]', tech.isOutdated ? 'border-[#dc2626]/35' : 'border-[#242424]')}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-[#f5f5f5] truncate">{tech.name}</span>
                  <span className="text-[10px] font-mono text-[#a1a1aa] shrink-0">{tech.version ?? '—'}</span>
                </div>
                <p className="text-[10px] text-[#52525b] mt-0.5">{tech.category}</p>
                {tech.evidence && <p className="text-[10px] text-[#52525b] mt-1 font-mono truncate">{tech.evidence}</p>}
                {tech.isOutdated && <p className="text-[10px] text-[#f87171] mt-1.5 leading-relaxed">Outdated{tech.latestKnown ? ` — current is ${tech.latestKnown}` : ''}{tech.cveCount ? ` · ${tech.cveCount} known CVE(s)` : ''}</p>}
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
        {cookieAnalysis.total === 0 ? <p className="text-[11px] text-[#71717a]">No cookies were set on this response.</p> : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[#a1a1aa] tabular">{cookieAnalysis.total} total · {cookieAnalysis.httpOnly} HttpOnly · {cookieAnalysis.secure} Secure · {cookieAnalysis.sameSite} SameSite</p>
            {cookieAnalysis.issues?.map((issue, index) => <p key={index} className="text-[11px] text-[#f87171] font-mono">{issue}</p>)}
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
                  <p key={index} className="text-[11px] font-mono text-[#a1a1aa] break-all"><span className={item.kind === 'active' ? 'text-[#f87171]' : 'text-[#52525b]'}>[{item.kind}] &lt;{item.element}&gt;</span> {item.url}</p>
                ))}
              </div>
            </Section>
          )}
          {content.disclosedPaths.length > 0 && (
            <Section label="Paths disclosed by robots.txt">
              <div className="flex flex-wrap gap-1.5">{content.disclosedPaths.map((path) => <span key={path} className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#161616] border border-[#242424] text-[#a1a1aa]">{path}</span>)}</div>
              <p className="text-[10px] text-[#52525b] mt-2">Listed in robots.txt. These paths were not requested by the scanner.</p>
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
        <Globe className="h-5 w-5 text-[#52525b]" />
        <p className="text-xs font-semibold text-[#d4d4d8]">Subdomain discovery</p>
        <p className="text-[11px] text-[#71717a] max-w-md leading-relaxed">Queries public Certificate Transparency logs for names published under <span className="font-mono text-[#a1a1aa]">{host}</span>. No traffic is sent to the target. Runs separately because the CT service is often slow.</p>
        {error && <p className="text-[11px] text-[#f87171] max-w-md">{error}</p>}
        <button onClick={() => void load()} disabled={state === 'loading' || !host} className="mt-1 h-8 px-3.5 inline-flex items-center gap-2 rounded-md border border-[#22c55e]/30 text-[#4ade80] hover:bg-[#22c55e]/10 disabled:opacity-50 text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer">
          {state === 'loading' ? 'Looking up…' : state === 'error' ? 'Retry' : 'Discover subdomains'}
        </button>
      </div>
    );
  }

  if (subdomains.length === 0) return <Empty title="No subdomains found" detail="No entries for this domain in the CT logs." />;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#71717a]">{subdomains.length} name{subdomains.length === 1 ? '' : 's'} from public Certificate Transparency logs. No traffic was sent to these hosts.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {subdomains.map((subdomain) => (
          <a key={subdomain} href={`https://${subdomain}`} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-[#242424] bg-[#0a0a0a] hover:border-[#22c55e]/40 transition-colors">
            <span className="font-mono text-[11px] text-[#a1a1aa] group-hover:text-[#f5f5f5] truncate transition-colors">{subdomain}</span>
            <ExternalLink className="h-3 w-3 text-[#52525b] shrink-0" />
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
      <p className="text-[11px] text-[#71717a] mb-3">Every check this scan attempted. Failed checks are excluded from the score — a lookup that did not complete is not evidence either way.</p>
      {checks.map((check) => (
        <div key={check.id} className="flex items-start gap-3 py-2 border-b border-[#1a1a1a] last:border-0">
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5 w-12 text-center', statusBadge(check.status))}>{check.status}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#f5f5f5]">{check.label}</p>
            <p className="text-[11px] text-[#71717a] font-mono break-words mt-0.5">{check.detail}</p>
          </div>
          {check.durationMs !== undefined && <span className="text-[10px] text-[#52525b] tabular shrink-0">{check.durationMs}ms</span>}
        </div>
      ))}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-wider text-[#52525b] mb-1.5">{label}</p>{children}</div>;
}

function Field({ label, value, mono, tone = 'neutral' }: { label: string; value: string; mono?: boolean; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-[#52525b]">{label}</dt>
      <dd className={cn('text-xs mt-0.5 break-words', mono && 'font-mono', tone === 'good' ? 'text-[#4ade80]' : tone === 'bad' ? 'text-[#f87171]' : 'text-[#d4d4d8]')}>{value}</dd>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* denied */ }
  };
  return (
    <div className="border border-[#1a1a1a] rounded bg-[#000000] overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1a1a1a]">
        <span className="text-[10px] uppercase tracking-wider text-[#52525b]">{label}</span>
        <button onClick={copy} className="text-[10px] text-[#71717a] hover:text-[#4ade80] inline-flex items-center gap-1 cursor-pointer transition-colors">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-2.5 text-[11px] font-mono text-[#d4d4d8] overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function Empty({ icon, title, detail }: { icon?: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      {icon}
      <p className="text-xs font-semibold text-[#d4d4d8]">{title}</p>
      <p className="text-[11px] text-[#71717a] max-w-md leading-relaxed">{detail}</p>
    </div>
  );
}
