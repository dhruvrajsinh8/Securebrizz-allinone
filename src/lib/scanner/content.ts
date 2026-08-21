/**
 * HTML response analysis: mixed content, SRI, form hygiene, directory listings.
 * Everything below is derived from the markup that was actually returned.
 */

import { URL } from 'url';
import type { ContentAnalysis, MixedContentItem, ScanRecommendation, SubresourceIntegrityInfo } from '@/types/scanner';
import { makeFinding, REFS } from './findings';

interface Tag { name: string; attrs: Record<string, string>; raw: string; }

const TAG_PATTERN = /<(script|link|img|iframe|form|input|meta|object|embed|source|video|audio|a)\b([^>]*)>/gi;
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseTags(html: string): Tag[] {
  const tags: Tag[] = [];
  let match: RegExpExecArray | null;
  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(html)) !== null) {
    const [raw, name, attrString] = match;
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    ATTR_PATTERN.lastIndex = 0;
    while ((attrMatch = ATTR_PATTERN.exec(attrString)) !== null) {
      const key = attrMatch[1].toLowerCase();
      attrs[key] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
    }
    tags.push({ name: name.toLowerCase(), attrs, raw });
  }
  return tags;
}

function resolve(url: string, pageUrl: string): URL | null {
  try { return new URL(url, pageUrl); } catch { return null; }
}

const SHARED_CDN_HOSTS = /(cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net|code\.jquery\.com|ajax\.googleapis\.com|stackpath\.bootstrapcdn\.com|maxcdn\.bootstrapcdn\.com|cdn\.polyfill\.io)$/i;

function safeHost(url: string): string {
  try { return new URL(url).host; } catch { return 'unknown host'; }
}

function isExternal(resolved: URL, pageUrl: string): boolean {
  try { return resolved.origin !== new URL(pageUrl).origin; } catch { return false; }
}

export interface ContentResult {
  content: ContentAnalysis;
  sri: SubresourceIntegrityInfo;
  findings: ScanRecommendation[];
  externalScriptUrls: string[];
}

export function analyzeContent(html: string, pageUrl: string, disclosedPaths: string[]): ContentResult {
  const tags = parseTags(html);
  const findings: ScanRecommendation[] = [];
  const isHttpsPage = pageUrl.startsWith('https://');

  const externalScriptUrls: string[] = [];
  const unprotectedScriptUrls: string[] = [];
  const externalStyleUrls: string[] = [];
  const unprotectedStyleUrls: string[] = [];
  const sriMissingCrossorigin: string[] = [];

  for (const tag of tags) {
    const isScript = tag.name === 'script' && tag.attrs.src;
    const isStylesheet = tag.name === 'link' && tag.attrs.href && (tag.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('stylesheet');
    if (!isScript && !isStylesheet) continue;

    const rawUrl = isScript ? tag.attrs.src : tag.attrs.href;
    const resolved = resolve(rawUrl, pageUrl);
    if (!resolved || !isExternal(resolved, pageUrl)) continue;

    const href = resolved.toString();
    const hasIntegrity = Boolean(tag.attrs.integrity);
    const hasCrossorigin = 'crossorigin' in tag.attrs;

    if (isScript) { externalScriptUrls.push(href); if (!hasIntegrity) unprotectedScriptUrls.push(href); }
    else { externalStyleUrls.push(href); if (!hasIntegrity) unprotectedStyleUrls.push(href); }
    if (hasIntegrity && !hasCrossorigin) sriMissingCrossorigin.push(href);
  }

  const missingSriCount = unprotectedScriptUrls.length;
  const sri: SubresourceIntegrityInfo = {
    totalExternalScripts: externalScriptUrls.length,
    missingSriCount,
    unprotectedScriptUrls,
    totalExternalStyles: externalStyleUrls.length,
    missingStyleSriCount: unprotectedStyleUrls.length,
    unprotectedStyleUrls,
    sriMissingCrossorigin,
    riskGrade: missingSriCount === 0 ? 'safe' : missingSriCount <= 2 ? 'warning' : 'high_risk',
  };

  if (missingSriCount > 0 || unprotectedStyleUrls.length > 0) {
    const total = missingSriCount + unprotectedStyleUrls.length;
    const unprotected = [...unprotectedScriptUrls, ...unprotectedStyleUrls];
    const hostCounts = new Map<string, number>();
    for (const url of unprotected) { const host = safeHost(url); hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1); }
    const usesSharedCdn = [...hostCounts.keys()].some((host) => SHARED_CDN_HOSTS.test(host));

    findings.push(makeFinding({
      id: 'rec-sri', title: 'Third-party resources load without Subresource Integrity', severity: usesSharedCdn && missingSriCount > 0 ? 'high' : 'medium', category: 'Supply Chain',
      description: `${total} externally-hosted resource(s) across ${hostCounts.size} host(s) are loaded with no integrity attribute${usesSharedCdn ? ', including from a shared public CDN' : ''}.`,
      impact: 'If any of these third-party hosts is compromised — or its domain later changes hands — the attacker-supplied file executes with full access to your page, your DOM and your users\' sessions. Every visitor is affected simultaneously and nothing in your own codebase changes.',
      evidence: [...hostCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([host, count]) => ({ label: SHARED_CDN_HOSTS.test(host) ? `${host} (shared CDN)` : host, value: `${count} resource(s) loaded without integrity` })),
      remediation: 'Add integrity="sha384-…" and crossorigin="anonymous" to every external script and stylesheet, or self-host the file so it is covered by your own deployment pipeline.',
      fix: [{ label: 'HTML', code: '<script src="https://cdn.example.com/lib.js"\n        integrity="sha384-<base64-hash>"\n        crossorigin="anonymous"></script>' }, { label: 'Generate the hash', code: 'curl -s https://cdn.example.com/lib.js | openssl dgst -sha384 -binary | openssl base64 -A' }],
      references: [REFS.sri], cwe: 'CWE-494', owasp: 'A08:2021 Software and Data Integrity Failures', timeToFix: '20 mins',
    }));
  }

  if (sriMissingCrossorigin.length > 0) {
    findings.push(makeFinding({
      id: 'rec-sri-crossorigin', title: 'Integrity attribute is ignored without crossorigin', severity: 'medium', category: 'Supply Chain',
      description: `${sriMissingCrossorigin.length} resource(s) declare integrity but omit the crossorigin attribute.`,
      impact: 'Browsers cannot verify a hash for a cross-origin response fetched in no-cors mode, so the integrity attribute is discarded silently. The protection appears to be in place in code review but is not applied at runtime.',
      evidence: sriMissingCrossorigin.slice(0, 5).map((url) => ({ label: 'integrity without crossorigin', value: url })), remediation: 'Add crossorigin="anonymous" next to every integrity attribute.', references: [REFS.sri], cwe: 'CWE-494', timeToFix: '10 mins',
    }));
  }

  const ACTIVE_ELEMENTS = new Set(['script', 'iframe', 'link', 'object', 'embed', 'form']);
  const mixedContentItems: MixedContentItem[] = [];
  if (isHttpsPage) {
    for (const tag of tags) {
      const candidate = tag.name === 'form' ? tag.attrs.action : tag.attrs.src ?? tag.attrs.href;
      if (!candidate || !candidate.toLowerCase().startsWith('http://')) continue;
      if (tag.name === 'a') continue;
      if (tag.name === 'link') { const rel = (tag.attrs.rel ?? '').toLowerCase(); if (!rel.includes('stylesheet') && !rel.includes('preload')) continue; }
      mixedContentItems.push({ url: candidate, kind: ACTIVE_ELEMENTS.has(tag.name) ? 'active' : 'passive', element: tag.name });
    }
  }

  if (mixedContentItems.length > 0) {
    const active = mixedContentItems.filter((item) => item.kind === 'active');
    findings.push(makeFinding({
      id: 'rec-mixed-content', title: active.length > 0 ? 'Active mixed content on an HTTPS page' : 'Passive mixed content on an HTTPS page', severity: active.length > 0 ? 'high' : 'low', category: 'Transport Security',
      description: `${mixedContentItems.length} resource(s) are referenced over plain http:// from an https:// page.`,
      impact: active.length > 0 ? 'Scripts and stylesheets loaded over HTTP can be rewritten in transit by anyone on the network path, giving them script execution inside your HTTPS origin. Browsers block most of this, which turns it into a functional outage as well as a security hole.' : 'Images and media loaded over HTTP break the padlock indicator and can be swapped by a network attacker.',
      evidence: mixedContentItems.slice(0, 8).map((item) => ({ label: `<${item.element}> (${item.kind})`, value: item.url })),
      remediation: 'Serve every subresource over HTTPS and add Content-Security-Policy: upgrade-insecure-requests as a backstop.',
      fix: [{ label: 'CSP backstop', code: 'Content-Security-Policy: upgrade-insecure-requests' }], references: [REFS.mixedContent], cwe: 'CWE-319', timeToFix: '30 mins',
    }));
  }

  const forms = tags.filter((tag) => tag.name === 'form');
  const passwordInputs = tags.filter((tag) => tag.name === 'input' && (tag.attrs.type ?? '').toLowerCase() === 'password');
  const passwordFieldsWithoutAutocomplete = passwordInputs.filter((tag) => !tag.attrs.autocomplete).length;
  const insecureForms = forms.map((tag) => tag.attrs.action).filter((action): action is string => Boolean(action) && action.toLowerCase().startsWith('http://'));

  const passwordOverHttp = passwordInputs.length > 0 && !isHttpsPage;
  if (passwordOverHttp || (passwordInputs.length > 0 && insecureForms.length > 0)) {
    findings.push(makeFinding({
      id: 'rec-password-plaintext', title: 'Password field submitted over an unencrypted connection', severity: 'critical', category: 'Transport Security',
      description: passwordOverHttp ? 'The page containing a password input was served over plain HTTP.' : 'A form containing a password input posts to an http:// endpoint.',
      impact: 'Credentials travel in cleartext. Anyone sharing the network — public Wi-Fi, a compromised router, an ISP intermediary — can read them directly, and browsers display an explicit "Not secure" warning on the field.',
      evidence: [{ label: 'Page URL', value: pageUrl }, ...(insecureForms.length > 0 ? insecureForms.slice(0, 3).map((action) => ({ label: 'form action', value: action })) : []), { label: 'Password inputs found', value: String(passwordInputs.length) }],
      remediation: 'Serve the page over HTTPS, post to an https:// endpoint, and redirect all HTTP traffic permanently.', references: [REFS.tls], cwe: 'CWE-319', owasp: 'A02:2021 Cryptographic Failures', difficulty: 'medium', timeToFix: '1 hour',
    }));
  }

  const directoryListing = /<title>\s*Index of \//i.test(html) || /<h1>\s*Index of \//i.test(html) || /Directory listing for \//i.test(html);
  if (directoryListing) {
    findings.push(makeFinding({
      id: 'rec-directory-listing', title: 'Directory listing is enabled', severity: 'medium', category: 'Information Disclosure',
      description: 'The server returned an auto-generated file index instead of a page.',
      impact: 'Every file in the directory is enumerable, including backups, .env copies, database dumps and source archives that were never meant to be linked.',
      evidence: [{ label: 'Response body', value: 'Contains an auto-generated "Index of /" listing' }], remediation: 'Disable auto-indexing: autoindex off in Nginx, Options -Indexes in Apache.',
      fix: [{ label: 'Nginx', code: 'autoindex off;' }, { label: 'Apache', code: 'Options -Indexes' }], references: [REFS.directoryListing], cwe: 'CWE-548', timeToFix: '10 mins',
    }));
  }

  const generatorTag = tags.find((tag) => tag.name === 'meta' && (tag.attrs.name ?? '').toLowerCase() === 'generator');

  const content: ContentAnalysis = {
    mixedContentItems, insecureForms, passwordFieldCount: passwordInputs.length, passwordFieldsWithoutAutocomplete,
    directoryListing, generator: generatorTag?.attrs.content, disclosedPaths, htmlBytes: Buffer.byteLength(html, 'utf8'),
  };

  return { content, sri, findings, externalScriptUrls };
}
