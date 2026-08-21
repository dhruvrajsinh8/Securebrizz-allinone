/**
 * Network primitives for the passive scanner.
 *
 * Two jobs:
 *  1. Stop the scanner being used as an SSRF proxy into the host's own network.
 *  2. Fetch a target while recording the redirect chain, because the page that
 *     actually gets analysed is the one at the END of the chain.
 */

import dns from 'dns/promises';
import { URL } from 'url';

/** Local scanning is an SSRF vector in a deployed app, so it is opt-in. */
export const ALLOW_LOCAL_SCAN = process.env.ALLOW_LOCAL_SCAN === 'true';

export const DEFAULT_TIMEOUT_MS = 8000;
export const LOCAL_TIMEOUT_MS = 3000;
const MAX_REDIRECTS = 5;

export const SCANNER_USER_AGENT =
  'Mozilla/5.0 (compatible; SecureBiz-PassiveScanner/2.0; +passive-audit)';

export function isLocalHostDomain(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.localhost')
  );
}

export function isIpLiteral(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
}

export function isValidHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (isLocalHostDomain(hostname)) return true;
  if (isIpLiteral(hostname)) return true;
  const domainRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return domainRegex.test(hostname);
}

/**
 * True for any address that must never be reachable from a user-supplied URL:
 * loopback, RFC1918, carrier-grade NAT, link-local (which includes the cloud
 * metadata endpoint 169.254.169.254), multicast and reserved space.
 */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const target = mapped ? mapped[1] : addr;

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(target)) {
    const parts = target.split('.').map((p) => parseInt(p, 10));
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0) return true;
    if (a >= 224) return true;
    return false;
  }

  if (target === '::1' || target === '::') return true;
  if (target.startsWith('fe80')) return true;
  if (/^f[cd]/.test(target)) return true;
  if (target.startsWith('ff')) return true;
  return false;
}

export interface TargetGuardResult {
  allowed: boolean;
  reason?: string;
  addresses: string[];
  isLocal: boolean;
}

/**
 * Resolve a hostname and decide whether it may be scanned. The DNS answer is
 * checked rather than the hostname string, so a public name that resolves to
 * 127.0.0.1 or 169.254.169.254 is refused too.
 */
export async function guardTarget(hostname: string): Promise<TargetGuardResult> {
  const local = isLocalHostDomain(hostname);

  if (local) {
    return ALLOW_LOCAL_SCAN
      ? { allowed: true, addresses: ['127.0.0.1'], isLocal: true }
      : {
          allowed: false,
          isLocal: true,
          addresses: [],
          reason:
            'Scanning local and internal hosts is disabled. Set ALLOW_LOCAL_SCAN=true in your environment to allow it during development.',
        };
  }

  const addresses: string[] = [];

  if (isIpLiteral(hostname)) {
    addresses.push(hostname);
  } else {
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ]);
    addresses.push(...v4, ...v6);
    if (addresses.length === 0) {
      return {
        allowed: false,
        isLocal: false,
        addresses: [],
        reason: `Domain "${hostname}" does not exist or has no DNS A/AAAA records.`,
      };
    }
  }

  const blocked = addresses.filter(isPrivateAddress);
  if (blocked.length > 0) {
    return {
      allowed: ALLOW_LOCAL_SCAN,
      isLocal: true,
      addresses,
      reason: ALLOW_LOCAL_SCAN
        ? undefined
        : `"${hostname}" resolves to a private or link-local address (${blocked[0]}). Scanning internal infrastructure is disabled.`,
    };
  }

  return { allowed: true, addresses, isLocal: false };
}

export interface ProbeResponse {
  ok: boolean;
  url: string;
  status: number;
  headers: Record<string, string>;
  setCookie: string[];
  body: string;
  redirectChain: string[];
  error?: string;
  elapsedMs: number;
}

/**
 * GET a URL, following redirects manually so the chain is observable and every
 * hop is re-checked against the SSRF guard.
 */
export async function probe(
  startUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; method?: 'GET' | 'HEAD' } = {}
): Promise<ProbeResponse> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const started = Date.now();

  const chain: string[] = [];
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return blank(current, chain, started, 'Malformed redirect target');
    }

    if (hop > 0) {
      const guard = await guardTarget(parsed.hostname);
      if (!guard.allowed) {
        return blank(current, chain, started, `Redirect blocked: ${guard.reason}`);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        method: opts.method ?? 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': SCANNER_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const isRedirect = res.status >= 300 && res.status < 400 && headers['location'];
      if (isRedirect && hop < MAX_REDIRECTS) {
        chain.push(current);
        current = new URL(headers['location'], current).toString();
        await res.arrayBuffer().catch(() => undefined);
        continue;
      }

      const setCookie =
        typeof res.headers.getSetCookie === 'function'
          ? res.headers.getSetCookie()
          : headers['set-cookie']
            ? [headers['set-cookie']]
            : [];

      const body = await readCapped(res, maxBytes);

      return {
        ok: true,
        url: current,
        status: res.status,
        headers,
        setCookie,
        body,
        redirectChain: chain,
        elapsedMs: Date.now() - started,
      };
    } catch (err) {
      clearTimeout(timer);
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `Timed out after ${timeoutMs}ms`
            : err.message
          : 'Request failed';
      return blank(current, chain, started, message);
    }
  }

  return blank(current, chain, started, `Exceeded ${MAX_REDIRECTS} redirects`);
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return res.text().catch(() => '');
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
        if (total >= maxBytes) break;
      }
    }
  } catch {
    // Partial body is still useful for analysis.
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

function blank(url: string, chain: string[], started: number, error: string): ProbeResponse {
  return {
    ok: false,
    url,
    status: 0,
    headers: {},
    setCookie: [],
    body: '',
    redirectChain: chain,
    error,
    elapsedMs: Date.now() - started,
  };
}
