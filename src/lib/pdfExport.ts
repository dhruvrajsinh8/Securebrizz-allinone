/**
 * Printable security report. Content is driven by the finding objects. Every
 * interpolated value is HTML-escaped — cert issuer, server banner and header
 * contents come from the scanned host and are untrusted input.
 */

import type { ScanResult, ScanRecommendation } from '@/types/scanner';

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function scoreColor(score: number): string {
  if (score >= 85) return '#15803d';
  if (score >= 65) return '#57534e';
  return '#b91c1c';
}

function severityStyle(severity: string): string {
  switch (severity) {
    case 'critical': return 'background:#b91c1c;color:#ffffff;';
    case 'high': return 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;';
    case 'medium': return 'background:#f4f4f5;color:#3f3f46;border:1px solid #e4e4e7;';
    case 'low': return 'background:#fafafa;color:#71717a;border:1px solid #e4e4e7;';
    default: return 'background:#fafafa;color:#a1a1aa;border:1px solid #f4f4f5;';
  }
}

function findingBlock(finding: ScanRecommendation, index: number): string {
  const evidence = (finding.evidence ?? []).map((item) => `<tr><td class="ev-label">${esc(item.label)}</td><td class="ev-value">${esc(item.value)}</td></tr>`).join('');
  const fixes = (finding.fix ?? []).map((snippet) => `<div class="snippet"><div class="snippet-label">${esc(snippet.label)}</div><pre>${esc(snippet.code)}</pre></div>`).join('');
  const references = (finding.references ?? []).map((reference) => `<li><a href="${esc(reference.url)}">${esc(reference.label)}</a></li>`).join('');
  const tags = [
    finding.cwe ? `<span class="tag">${esc(finding.cwe)}</span>` : '',
    finding.owasp ? `<span class="tag">${esc(finding.owasp)}</span>` : '',
    finding.confidence ? `<span class="tag">confidence: ${esc(finding.confidence)}</span>` : '',
    finding.scoreImpact ? `<span class="tag">−${esc(finding.scoreImpact)} pts</span>` : '',
    finding.resolved ? '<span class="tag resolved">marked resolved</span>' : '',
  ].filter(Boolean).join('');

  return `
    <section class="finding${finding.resolved ? ' is-resolved' : ''}">
      <div class="finding-head"><span class="sev" style="${severityStyle(finding.priority)}">${esc(finding.priority)}</span><h3>${index + 1}. ${esc(finding.title)}</h3></div>
      <p class="desc">${esc(finding.description)}</p>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${evidence ? `<div class="sub">Evidence</div><table class="ev">${evidence}</table>` : ''}
      ${finding.impact ? `<div class="sub">Why it matters</div><p class="body">${esc(finding.impact)}</p>` : ''}
      ${finding.remediation ? `<div class="sub">Fix</div><p class="body">${esc(finding.remediation)}</p>` : ''}
      ${fixes ? `<div class="sub">Configuration</div>${fixes}` : ''}
      ${references ? `<div class="sub">References</div><ul class="refs">${references}</ul>` : ''}
    </section>`;
}

export function exportScanReportPDF(scanResult: ScanResult): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Allow pop-ups for this site to export the report.'); return; }

  const scanDate = new Date(scanResult.scanDate).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const open = scanResult.recommendations.filter((f) => !f.resolved);
  const resolved = scanResult.recommendations.filter((f) => f.resolved);
  const counts = {
    critical: open.filter((f) => f.priority === 'critical').length,
    high: open.filter((f) => f.priority === 'high').length,
    medium: open.filter((f) => f.priority === 'medium').length,
    low: open.filter((f) => f.priority === 'low').length,
    info: open.filter((f) => f.priority === 'info').length,
  };
  const failedChecks = (scanResult.checks ?? []).filter((check) => check.status === 'failed');
  const checksRows = (scanResult.checks ?? []).map((check) => `<tr><td><span class="status status-${esc(check.status)}">${esc(check.status)}</span></td><td>${esc(check.label)}</td><td class="mono small">${esc(check.detail)}</td></tr>`).join('');
  const headerRows = scanResult.securityHeaders.map((header) => `<tr><td class="mono">${esc(header.name)}</td><td><span class="status status-${esc(header.status)}">${esc(header.status)}</span></td><td class="mono small">${esc(header.value ?? '—')}</td></tr>`).join('');
  const techRows = scanResult.technologies.map((tech) => `<tr><td>${esc(tech.name)}</td><td class="mono">${esc(tech.version ?? '—')}</td><td>${esc(tech.category)}</td><td class="small">${tech.isOutdated ? 'Outdated' : 'No known issue in bundled data'}</td></tr>`).join('');
  const ssl = scanResult.ssl;
  const dns = scanResult.dns;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Security report — ${esc(scanResult.finalUrl ?? scanResult.url)}</title>
<style>
@page { size: A4; margin: 16mm; } * { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; background: #ffffff; margin: 0; font-size: 12px; line-height: 1.55; }
.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; } .small { font-size: 10.5px; }
header.doc { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #18181b; padding-bottom: 10px; margin-bottom: 18px; }
.brand { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; } .brand em { font-style: normal; color: #15803d; }
.doc-type { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; }
.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 18px; margin-bottom: 18px; }
.meta div strong { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #a1a1aa; font-weight: 600; margin-bottom: 1px; }
.meta div span { word-break: break-all; }
.summary { display: flex; gap: 18px; align-items: center; border: 1px solid #e4e4e7; border-radius: 6px; padding: 14px 16px; margin-bottom: 8px; }
.score { font-size: 34px; font-weight: 700; line-height: 1; color: ${scoreColor(scanResult.overallScore)}; } .score small { display: block; font-size: 10px; color: #a1a1aa; font-weight: 500; }
.grade { font-size: 15px; font-weight: 700; padding: 3px 9px; border: 1px solid #d4d4d8; border-radius: 4px; }
.counts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; } .count { font-size: 10px; padding: 2px 7px; border-radius: 3px; font-weight: 700; text-transform: uppercase; }
.note { border-left: 3px solid #d4d4d8; padding: 8px 12px; background: #fafafa; margin: 14px 0 20px; font-size: 11.5px; } .note.warn { border-left-color: #b91c1c; background: #fef2f2; }
h2.section { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #52525b; border-bottom: 1px solid #e4e4e7; padding-bottom: 5px; margin: 22px 0 10px; }
.finding { border: 1px solid #e4e4e7; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; page-break-inside: avoid; } .finding.is-resolved { opacity: 0.55; }
.finding-head { display: flex; align-items: baseline; gap: 8px; } .finding-head h3 { font-size: 13px; margin: 0; font-weight: 650; }
.sev { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 3px; }
.desc { margin: 6px 0 0; color: #3f3f46; } .body { margin: 3px 0 0; color: #3f3f46; }
.sub { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #a1a1aa; font-weight: 600; margin-top: 10px; }
.tags { margin-top: 7px; display: flex; gap: 5px; flex-wrap: wrap; } .tag { font-size: 9px; padding: 2px 6px; background: #f4f4f5; border-radius: 3px; color: #52525b; } .tag.resolved { background: #dcfce7; color: #15803d; }
table { width: 100%; border-collapse: collapse; margin-top: 4px; } table.ev td { padding: 3px 0; vertical-align: top; }
.ev-label { width: 150px; color: #a1a1aa; font-size: 10.5px; font-family: ui-monospace, monospace; } .ev-value { font-family: ui-monospace, monospace; font-size: 10.5px; word-break: break-all; }
table.grid { border: 1px solid #e4e4e7; } table.grid th, table.grid td { border-bottom: 1px solid #f4f4f5; padding: 5px 8px; text-align: left; vertical-align: top; }
table.grid th { background: #fafafa; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
.status { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 5px; border-radius: 3px; }
.status-ok, .status-present, .status-valid { background: #dcfce7; color: #15803d; } .status-failed, .status-missing, .status-invalid, .status-expired { background: #fee2e2; color: #991b1b; }
.status-misconfigured, .status-expiring_soon { background: #ffedd5; color: #9a3412; } .status-skipped, .status-unknown, .status-not_applicable { background: #f4f4f5; color: #71717a; }
.snippet { border: 1px solid #e4e4e7; border-radius: 4px; margin-top: 5px; overflow: hidden; } .snippet-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; background: #fafafa; padding: 3px 8px; border-bottom: 1px solid #e4e4e7; }
.snippet pre { margin: 0; padding: 7px 8px; font-size: 10px; font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
ul.refs { margin: 4px 0 0; padding-left: 16px; font-size: 10.5px; } ul.refs a { color: #15803d; }
footer.doc { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e4e4e7; font-size: 10px; color: #a1a1aa; }
@media print { .no-print { display: none; } }
</style></head><body>
<header class="doc"><div><div class="brand">Secure<em>Biz</em></div><div class="doc-type">Passive security assessment</div></div><div class="doc-type">${esc(scanDate)}</div></header>
<div class="meta">
  <div><strong>Target</strong><span class="mono">${esc(scanResult.finalUrl ?? scanResult.url)}</span></div>
  <div><strong>Transport</strong><span>${scanResult.httpsEnabled ? 'HTTPS' : 'HTTP (unencrypted)'}</span></div>
  <div><strong>HTTP status</strong><span class="mono">${esc(scanResult.httpStatus ?? '—')}</span></div>
  <div><strong>Duration</strong><span>${((scanResult.durationMs ?? scanResult.duration * 1000) / 1000).toFixed(1)}s</span></div>
  <div><strong>Checks run</strong><span>${scanResult.checks?.length ?? 0}</span></div>
  <div><strong>Server</strong><span>${esc(scanResult.serverInfo ?? '—')}</span></div>
</div>
<div class="summary"><div class="score">${scanResult.overallScore}<small>out of 100</small></div><div class="grade">${esc(scanResult.grade ?? '—')}</div>
  <div style="flex:1"><div>${esc(scanResult.aiSummary)}</div><div class="counts">
    ${counts.critical ? `<span class="count" style="${severityStyle('critical')}">${counts.critical} critical</span>` : ''}
    ${counts.high ? `<span class="count" style="${severityStyle('high')}">${counts.high} high</span>` : ''}
    ${counts.medium ? `<span class="count" style="${severityStyle('medium')}">${counts.medium} medium</span>` : ''}
    ${counts.low ? `<span class="count" style="${severityStyle('low')}">${counts.low} low</span>` : ''}
    ${counts.info ? `<span class="count" style="${severityStyle('info')}">${counts.info} info</span>` : ''}
    ${open.length === 0 ? '<span class="count" style="background:#dcfce7;color:#15803d;">no open findings</span>' : ''}
  </div></div></div>
${failedChecks.length > 0 ? `<div class="note warn"><strong>Partial coverage.</strong> ${failedChecks.length} check(s) did not complete: ${esc(failedChecks.map((c) => c.label).join(', '))}. Nothing was inferred from these.</div>` : `<div class="note">All ${scanResult.checks?.length ?? 0} checks completed. Findings below reflect full coverage of the passive checks this tool performs.</div>`}
<h2 class="section">Findings (${open.length} open${resolved.length > 0 ? `, ${resolved.length} resolved` : ''})</h2>
${scanResult.recommendations.length > 0 ? scanResult.recommendations.map((finding, index) => findingBlock(finding, index)).join('') : '<p class="body">No findings were raised by the checks that ran.</p>'}
<h2 class="section">Check coverage</h2><table class="grid"><thead><tr><th>Result</th><th>Check</th><th>Detail</th></tr></thead><tbody>${checksRows || '<tr><td colspan="3">No check log recorded.</td></tr>'}</tbody></table>
<h2 class="section">Security headers</h2><table class="grid"><thead><tr><th>Header</th><th>Status</th><th>Observed value</th></tr></thead><tbody>${headerRows || '<tr><td colspan="3">No header data.</td></tr>'}</tbody></table>
<h2 class="section">TLS certificate</h2>
${ssl.status === 'not_applicable' ? '<p class="body">Target served over plain HTTP; no certificate was presented.</p>' : ssl.status === 'unknown' ? `<p class="body">Certificate could not be inspected: ${esc(ssl.validationError ?? 'handshake did not complete')}.</p>` : `<table class="grid"><tbody>
  <tr><th>Subject</th><td class="mono">${esc(ssl.subject)}</td></tr><tr><th>Issuer</th><td>${esc(ssl.issuer)}</td></tr>
  <tr><th>Validity</th><td class="mono">${esc(ssl.validFrom.slice(0, 10))} → ${esc(ssl.validTo.slice(0, 10))} (${esc(ssl.daysRemaining)} days remaining)</td></tr>
  <tr><th>Protocol</th><td class="mono">${esc(ssl.protocol ?? 'unknown')} · ${esc(ssl.cipher ?? 'unknown cipher')}</td></tr>
  <tr><th>Public key</th><td class="mono">${esc(ssl.algorithm)}${ssl.keySize ? ` ${esc(ssl.keySize)} bits` : ''}</td></tr>
  <tr><th>Chain validates</th><td>${ssl.validated ? 'Yes' : `No — ${esc(ssl.validationError ?? 'validation failed')}`}</td></tr>
  <tr><th>Hostname match</th><td>${ssl.hostnameMatch === undefined ? 'unknown' : ssl.hostnameMatch ? 'Yes' : 'No'}</td></tr>
  <tr><th>Fingerprint</th><td class="mono small">${esc(ssl.fingerprint)}</td></tr></tbody></table>`}
${dns ? `<h2 class="section">DNS and email authentication</h2><table class="grid"><tbody>
  <tr><th>Addresses</th><td class="mono small">${esc([...dns.ipv4, ...dns.ipv6].join(', ') || 'none')}</td></tr>
  <tr><th>Nameservers</th><td class="mono small">${esc(dns.nameservers.join(', ') || 'none')}</td></tr>
  <tr><th>DNSSEC</th><td>${esc(dns.dnssec)}</td></tr><tr><th>CAA</th><td class="mono small">${esc(dns.caa.present ? dns.caa.records.join(', ') : 'no records')}</td></tr>
  <tr><th>SPF</th><td class="mono small">${esc(dns.spf.record ?? 'not published')}</td></tr><tr><th>DMARC</th><td class="mono small">${esc(dns.dmarc.record ?? 'not published')}</td></tr></tbody></table>` : ''}
${techRows ? `<h2 class="section">Technologies identified</h2><table class="grid"><thead><tr><th>Name</th><th>Version</th><th>Category</th><th>Status</th></tr></thead><tbody>${techRows}</tbody></table>` : ''}
<footer class="doc">Passive assessment only: the scanner requests pages as a browser would, reads public DNS records and completes one TLS handshake. No port scanning, fuzzing or exploitation was performed, so this report does not establish the absence of vulnerabilities that only active testing would reveal.</footer>
<script>window.addEventListener('load', function () { window.print(); });</script>
</body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
