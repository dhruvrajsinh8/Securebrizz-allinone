/**
 * DNS-layer inspection: addressing, mail authentication and certificate policy.
 *
 * Every lookup reports whether it SUCCEEDED separately from what it found, so a
 * timed-out query can never be presented as "this domain has no DMARC record".
 */

import dnsPromises from 'dns/promises';
import type { CaaRecord } from 'dns';
import type { CaaInfo, DmarcInfo, DnsInfo, SpfInfo } from '@/types/scanner';

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DOH_TIMEOUT_MS = 4000;

export interface DnsLookupOutcome {
  dns: DnsInfo;
  failures: Record<string, string>;
}

export function emptyDnsInfo(): DnsInfo {
  return {
    ipv4: [],
    ipv6: [],
    nameservers: [],
    mxHosts: [],
    dnssec: 'unknown',
    caa: { present: false, records: [] },
    spf: { present: false, multipleRecords: false, issues: [] },
    dmarc: { present: false, policy: 'missing', reportingEnabled: false, issues: [] },
  };
}

export async function inspectDns(hostname: string): Promise<DnsLookupOutcome> {
  const failures: Record<string, string> = {};
  const dns = emptyDnsInfo();

  const track = async <T>(id: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      failures[id] = err instanceof Error ? err.message : 'lookup failed';
      return fallback;
    }
  };

  const [ipv4, ipv6, ns, mx, txt, caa, dmarcTxt, dnssec] = await Promise.all([
    track('dns.a', () => dnsPromises.resolve4(hostname), [] as string[]),
    track('dns.aaaa', () => dnsPromises.resolve6(hostname), [] as string[]),
    track('dns.ns', () => dnsPromises.resolveNs(hostname), [] as string[]),
    track('dns.mx', () => dnsPromises.resolveMx(hostname), [] as { exchange: string; priority: number }[]),
    track('dns.txt', () => dnsPromises.resolveTxt(hostname), [] as string[][]),
    track('dns.caa', () => dnsPromises.resolveCaa(hostname), [] as CaaRecord[]),
    track('dns.dmarc', () => dnsPromises.resolveTxt(`_dmarc.${hostname}`), [] as string[][]),
    track('dns.dnssec', () => queryDnssec(hostname), 'unknown' as DnsInfo['dnssec']),
  ]);

  dns.ipv4 = ipv4;
  dns.ipv6 = ipv6;
  dns.nameservers = ns;
  dns.mxHosts = mx.map((entry) => entry.exchange);
  dns.dnssec = dnssec;
  dns.caa = parseCaa(caa, 'dns.caa' in failures);
  dns.spf = parseSpf(txt.map((parts) => parts.join('')));
  dns.dmarc = parseDmarc(dmarcTxt.map((parts) => parts.join('')));

  if (failures['dns.dmarc'] && /ENOTFOUND|ENODATA/i.test(failures['dns.dmarc'])) delete failures['dns.dmarc'];
  if (failures['dns.caa'] && /ENOTFOUND|ENODATA/i.test(failures['dns.caa'])) delete failures['dns.caa'];
  if (failures['dns.aaaa'] && /ENOTFOUND|ENODATA/i.test(failures['dns.aaaa'])) delete failures['dns.aaaa'];
  if (failures['dns.mx'] && /ENOTFOUND|ENODATA/i.test(failures['dns.mx'])) delete failures['dns.mx'];

  return { dns, failures };
}

async function queryDnssec(hostname: string): Promise<DnsInfo['dnssec']> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=A&do=1`, {
      headers: { accept: 'application/dns-json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`resolver returned ${res.status}`);
    const data = (await res.json()) as { AD?: boolean };
    if (typeof data.AD !== 'boolean') throw new Error('resolver omitted AD flag');
    return data.AD ? 'validated' : 'unsigned';
  } finally {
    clearTimeout(timer);
  }
}

function parseCaa(records: CaaRecord[], failed: boolean): CaaInfo {
  if (failed) return { present: false, records: [] };
  const rendered = records
    .map((record) => {
      const entries = Object.entries(record as unknown as Record<string, string | number>);
      const tag = entries.find(([key]) => key !== 'critical');
      return tag ? `${tag[0]} "${tag[1]}"` : '';
    })
    .filter(Boolean);
  return { present: rendered.length > 0, records: rendered };
}

const SPF_LOOKUP_MECHANISMS = /^(include|a|mx|ptr|exists|redirect)([:=]|$)/i;

export function parseSpf(txtRecords: string[]): SpfInfo {
  const spfRecords = txtRecords.filter((record) => record.trim().toLowerCase().startsWith('v=spf1'));
  if (spfRecords.length === 0) return { present: false, multipleRecords: false, issues: [] };

  const record = spfRecords[0];
  const issues: string[] = [];
  const multipleRecords = spfRecords.length > 1;
  if (multipleRecords) {
    issues.push(
      `${spfRecords.length} SPF records published; RFC 7208 permits exactly one, and receivers treat this as a permanent error (SPF fails entirely).`
    );
  }

  const terms = record.trim().split(/\s+/).slice(1);
  let qualifier: SpfInfo['qualifier'] = 'none';
  const allTerm = [...terms].reverse().find((term) => /^[-~?+]?all$/i.test(term));
  if (allTerm) {
    const prefix = allTerm[0];
    if (prefix === '-') qualifier = 'fail';
    else if (prefix === '~') qualifier = 'softfail';
    else if (prefix === '?') qualifier = 'neutral';
    else qualifier = 'pass_all';
  }

  if (qualifier === 'none') issues.push('Record has no "all" mechanism, so unmatched senders get no policy at all.');
  else if (qualifier === 'pass_all') issues.push('"+all" authorises every sender on the internet to send as this domain — equivalent to publishing no SPF at all.');
  else if (qualifier === 'neutral') issues.push('"?all" expresses no opinion on unauthorised senders and gives no spoofing protection.');

  const lookupCount = terms.filter((term) => SPF_LOOKUP_MECHANISMS.test(term.replace(/^[-~?+]/, ''))).length;
  if (lookupCount > 10) {
    issues.push(`Record needs ${lookupCount} DNS lookups; the RFC limit is 10, above which receivers return permerror and SPF stops working.`);
  }

  return { present: true, record, qualifier, multipleRecords, lookupCount, issues };
}

export function parseDmarc(txtRecords: string[]): DmarcInfo {
  const dmarcRecords = txtRecords.filter((record) => record.trim().toLowerCase().startsWith('v=dmarc1'));
  if (dmarcRecords.length === 0) return { present: false, policy: 'missing', reportingEnabled: false, issues: [] };

  const record = dmarcRecords[0];
  const issues: string[] = [];
  const tags = new Map<string, string>();
  for (const part of record.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if (!rawKey || rest.length === 0) continue;
    tags.set(rawKey.trim().toLowerCase(), rest.join('=').trim());
  }

  const policyTag = (tags.get('p') ?? '').toLowerCase();
  const policy: DmarcInfo['policy'] =
    policyTag === 'reject' || policyTag === 'quarantine' || policyTag === 'none' ? policyTag : 'missing';

  if (policy === 'missing') issues.push('Record is present but has no valid p= policy tag, so receivers ignore it.');
  else if (policy === 'none') issues.push('p=none only monitors; spoofed mail is still delivered to inboxes.');

  const subdomainTag = (tags.get('sp') ?? '').toLowerCase();
  const subdomainPolicy =
    subdomainTag === 'reject' || subdomainTag === 'quarantine' || subdomainTag === 'none' ? subdomainTag : undefined;
  if (subdomainPolicy === 'none' && policy !== 'none') issues.push('sp=none exempts subdomains from the policy, leaving them spoofable.');

  let percentage: number | undefined;
  const pctTag = tags.get('pct');
  if (pctTag !== undefined) {
    const parsed = parseInt(pctTag, 10);
    if (!Number.isNaN(parsed)) {
      percentage = parsed;
      if (parsed < 100) issues.push(`pct=${parsed} applies the policy to only ${parsed}% of failing mail.`);
    }
  }

  const reportingEnabled = Boolean(tags.get('rua'));
  if (!reportingEnabled) issues.push('No rua= address, so no aggregate reports arrive and failures stay invisible.');

  return { present: true, record, policy, subdomainPolicy, percentage, reportingEnabled, issues };
}
