/**
 * TLS certificate inspection.
 *
 * The connection is made with `rejectUnauthorized: false` so a BROKEN
 * certificate can still be inspected — but the validation result is read back
 * from `socket.authorized` and the hostname is checked explicitly. Connecting
 * insecurely and then reporting "valid" grades self-signed and mismatched
 * certificates as trustworthy. Nothing here is invented: an absent field is
 * reported unknown, never defaulted to a plausible constant.
 */

import tls from 'tls';
import type { SslCertificate } from '@/types/scanner';

export interface TlsProbeResult {
  cert: SslCertificate;
  ok: boolean;
  error?: string;
}

export function unknownCertificate(hostname: string, reason: string): SslCertificate {
  return {
    status: 'unknown',
    issuer: 'Unknown',
    subject: hostname,
    validFrom: '',
    validTo: '',
    daysRemaining: 0,
    algorithm: 'Unknown',
    keySize: 0,
    chain: [],
    fingerprint: 'Unavailable',
    grade: 'N/A',
    validated: false,
    validationError: reason,
  };
}

export function notApplicableCertificate(hostname: string): SslCertificate {
  return {
    status: 'not_applicable',
    issuer: 'N/A',
    subject: hostname,
    validFrom: '',
    validTo: '',
    daysRemaining: 0,
    algorithm: 'N/A',
    keySize: 0,
    chain: [],
    fingerprint: 'N/A',
    grade: 'N/A',
    validated: false,
    validationError: 'Target served over plain HTTP; no TLS certificate presented.',
  };
}

export function inspectCertificate(
  hostname: string,
  port = 443,
  timeoutMs = 8000
): Promise<TlsProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: TlsProbeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        try {
          const peer = socket.getPeerCertificate(true);
          const authorized = socket.authorized;
          const authorizationError = socket.authorizationError
            ? String(socket.authorizationError)
            : undefined;
          const protocol = socket.getProtocol() ?? undefined;
          const cipherInfo = socket.getCipher();
          socket.end();

          if (!peer || Object.keys(peer).length === 0) {
            return done({
              ok: false,
              error: 'Server presented no certificate',
              cert: unknownCertificate(hostname, 'Server presented no certificate'),
            });
          }

          done({
            ok: true,
            cert: buildCertificate({
              peer,
              hostname,
              authorized,
              authorizationError,
              protocol,
              cipher: cipherInfo?.name,
            }),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Inspection failed';
          done({ ok: false, error: message, cert: unknownCertificate(hostname, message) });
        }
      }
    );

    socket.on('error', (err: Error) => {
      done({ ok: false, error: err.message, cert: unknownCertificate(hostname, err.message) });
    });

    socket.on('timeout', () => {
      socket.destroy();
      const message = `TLS handshake timed out after ${timeoutMs}ms`;
      done({ ok: false, error: message, cert: unknownCertificate(hostname, message) });
    });
  });
}

interface BuildArgs {
  peer: tls.DetailedPeerCertificate;
  hostname: string;
  authorized: boolean;
  authorizationError?: string;
  protocol?: string;
  cipher?: string;
}

function buildCertificate({
  peer,
  hostname,
  authorized,
  authorizationError,
  protocol,
  cipher,
}: BuildArgs): SslCertificate {
  const now = Date.now();
  const validFromMs = peer.valid_from ? new Date(peer.valid_from).getTime() : NaN;
  const validToMs = peer.valid_to ? new Date(peer.valid_to).getTime() : NaN;
  const hasDates = !Number.isNaN(validFromMs) && !Number.isNaN(validToMs);
  const daysRemaining = hasDates ? Math.floor((validToMs - now) / 86_400_000) : 0;

  const sans = parseSans(peer.subjectaltname);
  const hostnameMatch = checkHostname(hostname, peer);
  const selfSigned = isSelfSigned(peer, authorizationError);
  const notYetValid = hasDates && validFromMs > now;
  const expired = hasDates && validToMs <= now;

  let status: SslCertificate['status'];
  if (!hasDates) status = 'unknown';
  else if (expired) status = 'expired';
  else if (!authorized || !hostnameMatch || notYetValid) status = 'invalid';
  else if (daysRemaining <= 30) status = 'expiring_soon';
  else status = 'valid';

  const { algorithm, keySize } = describeKey(peer);

  return {
    status,
    issuer: nameOf(peer.issuer, 'O') ?? nameOf(peer.issuer, 'CN') ?? 'Unknown issuer',
    subject: nameOf(peer.subject, 'CN') ?? hostname,
    validFrom: hasDates ? new Date(validFromMs).toISOString() : '',
    validTo: hasDates ? new Date(validToMs).toISOString() : '',
    daysRemaining: Math.max(0, daysRemaining),
    algorithm,
    keySize,
    chain: buildChain(peer),
    fingerprint: peer.fingerprint256 || peer.fingerprint || 'Unavailable',
    grade: gradeCertificate({ status, authorized, hostnameMatch, daysRemaining, protocol, keySize, algorithm }),
    validated: authorized,
    validationError: authorized
      ? notYetValid
        ? 'Certificate is not valid yet (validFrom is in the future)'
        : hostnameMatch
          ? undefined
          : `Certificate does not cover ${hostname}`
      : authorizationError ?? 'Chain validation failed',
    hostnameMatch,
    protocol,
    cipher,
    sans,
    selfSigned,
    serialNumber: peer.serialNumber,
  };
}

function nameOf(
  subject: tls.PeerCertificate['subject'] | undefined,
  key: 'CN' | 'O'
): string | undefined {
  if (!subject || typeof subject !== 'object') return undefined;
  const value = (subject as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseSans(subjectaltname?: string): string[] {
  if (!subjectaltname) return [];
  return subjectaltname
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('DNS:') || entry.startsWith('IP Address:'))
    .map((entry) => entry.replace(/^DNS:/, '').replace(/^IP Address:/, ''));
}

function checkHostname(hostname: string, peer: tls.PeerCertificate): boolean {
  try {
    return tls.checkServerIdentity(hostname, peer) === undefined;
  } catch {
    return false;
  }
}

function isSelfSigned(peer: tls.DetailedPeerCertificate, authorizationError?: string): boolean {
  if (authorizationError && /SELF_SIGNED/i.test(authorizationError)) return true;
  const subjectCn = nameOf(peer.subject, 'CN');
  const issuerCn = nameOf(peer.issuer, 'CN');
  return Boolean(subjectCn && issuerCn && subjectCn === issuerCn);
}

function describeKey(peer: tls.DetailedPeerCertificate): { algorithm: string; keySize: number } {
  const bits = typeof peer.bits === 'number' ? peer.bits : 0;
  const curve = peer.nistCurve || peer.asn1Curve;
  if (curve) return { algorithm: `ECDSA (${curve})`, keySize: bits };
  if (peer.modulus) return { algorithm: 'RSA', keySize: bits };
  return { algorithm: bits > 0 ? 'Unknown key type' : 'Unknown', keySize: bits };
}

function buildChain(peer: tls.DetailedPeerCertificate): string[] {
  const chain: string[] = [];
  let current: tls.DetailedPeerCertificate | undefined = peer;
  const seen = new Set<string>();

  while (current) {
    const label =
      nameOf(current.subject, 'CN') ?? nameOf(current.subject, 'O') ?? 'Unnamed certificate';
    const key = current.fingerprint256 || label;
    if (seen.has(key)) break;
    seen.add(key);
    chain.push(label);

    const next: tls.DetailedPeerCertificate | undefined = current.issuerCertificate;
    if (!next || next === current) break;
    current = next;
  }
  return chain;
}

interface GradeArgs {
  status: SslCertificate['status'];
  authorized: boolean;
  hostnameMatch: boolean;
  daysRemaining: number;
  protocol?: string;
  keySize: number;
  algorithm: string;
}

function gradeCertificate({
  status,
  authorized,
  hostnameMatch,
  daysRemaining,
  protocol,
  keySize,
  algorithm,
}: GradeArgs): SslCertificate['grade'] {
  if (status === 'unknown') return 'N/A';
  if (status === 'expired' || !authorized || !hostnameMatch) return 'F';
  if (protocol === 'TLSv1' || protocol === 'TLSv1.1' || protocol === 'SSLv3') return 'D';

  const weakRsa = algorithm.startsWith('RSA') && keySize > 0 && keySize < 2048;
  const weakEc = algorithm.startsWith('ECDSA') && keySize > 0 && keySize < 256;
  if (weakRsa || weakEc) return 'C';

  if (daysRemaining <= 14) return 'C';
  if (daysRemaining <= 30) return 'B';
  if (protocol === 'TLSv1.3') return 'A+';
  return 'A';
}
