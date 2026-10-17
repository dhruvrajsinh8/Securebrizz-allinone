/**
 * Session tokens, signed with HMAC-SHA256 over the payload so they cannot be
 * forged or edited without the server secret, carrying their own expiry:
 *   base64url({"uid":"…","exp":…}) . base64url(hmac)
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'sb_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const DEV_SECRET = 'securebiz-development-secret-do-not-use-in-production';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is not set, or is shorter than 32 characters. Set it in your environment before starting in production. Generate one with: openssl rand -base64 32');
  }
  if (secret) {
    console.warn('[auth] AUTH_SECRET is shorter than 32 characters; using it anyway in development.');
    return secret;
  }
  console.warn('[auth] AUTH_SECRET is not set. Falling back to a development-only secret. Set AUTH_SECRET before deploying.');
  return DEV_SECRET;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload: string): string {
  return base64url(createHmac('sha256', getSecret()).update(payload).digest());
}

/**
 * `sid` binds the token to a Session row so it can be revoked. Tokens minted
 * without one stay valid on signature alone (older cookies, and any caller that
 * has no session row to point at).
 */
export function createSessionToken(userId: string, sessionId?: string): string {
  const payload = base64url(JSON.stringify({
    uid: userId,
    sid: sessionId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
}

export interface SessionClaims {
  userId: string;
  sessionId?: string;
}

/** Signature + expiry only. Revocation is checked separately, against the database. */
export function verifySessionClaims(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(fromBase64url(payload).toString('utf8')) as { uid?: unknown; sid?: unknown; exp?: unknown };
    if (typeof decoded.uid !== 'string' || typeof decoded.exp !== 'number') return null;
    if (decoded.exp * 1000 <= Date.now()) return null;
    return { userId: decoded.uid, sessionId: typeof decoded.sid === 'string' ? decoded.sid : undefined };
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(fromBase64url(payload).toString('utf8')) as { uid?: unknown; exp?: unknown };
    if (typeof decoded.uid !== 'string' || typeof decoded.exp !== 'number') return null;
    if (decoded.exp * 1000 <= Date.now()) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * `secure` follows the request protocol, not NODE_ENV. `next start` sets
 * NODE_ENV=production even locally, which would mark the cookie Secure over
 * http://localhost — and Safari then silently drops it.
 */
function isSecureRequest(request?: Request): boolean {
  if (!request) return process.env.NODE_ENV === 'production';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto.split(',')[0].trim() === 'https';
  try { return new URL(request.url).protocol === 'https:'; } catch { return false; }
}

export function sessionCookieOptions(request?: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  };
}
