/**
 * Session tokens are the whole authentication story. A forged or non-expiring
 * token is a full account takeover, so tampering must be rejected in every
 * position of the token.
 */

import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret-that-is-definitely-long-enough-32'; });

const { createSessionToken, verifySessionToken, verifySessionClaims } = await import('@/lib/session');

describe('session tokens', () => {
  it('round-trips the user id', () => {
    expect(verifySessionToken(createSessionToken('user-1'))).toBe('user-1');
  });

  it('carries a session id when one is bound', () => {
    const claims = verifySessionClaims(createSessionToken('user-1', 'sess-9'));
    expect(claims).toEqual({ userId: 'user-1', sessionId: 'sess-9' });
  });

  it('omits the session id when none was bound', () => {
    expect(verifySessionClaims(createSessionToken('user-1'))?.sessionId).toBeUndefined();
  });

  it('rejects a tampered payload', () => {
    const [, signature] = createSessionToken('user-1').split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ uid: 'admin', exp: Math.floor(Date.now() / 1000) + 999 }))
      .toString('base64url');
    expect(verifySessionToken(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const [payload] = createSessionToken('user-1').split('.');
    expect(verifySessionToken(`${payload}.deadbeef`)).toBeNull();
  });

  it('rejects an unsigned token', () => {
    const payload = Buffer.from(JSON.stringify({ uid: 'admin', exp: Math.floor(Date.now() / 1000) + 999 }))
      .toString('base64url');
    expect(verifySessionToken(payload)).toBeNull();
    expect(verifySessionToken(`${payload}.`)).toBeNull();
  });

  it('rejects garbage and empty input without throwing', () => {
    for (const bad of [undefined, '', '.', 'a.b', 'not-a-token', '....']) {
      expect(verifySessionToken(bad as string | undefined), String(bad)).toBeNull();
    }
  });

  it('rejects an expired token even though the signature is valid', async () => {
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from(JSON.stringify({ uid: 'user-1', exp: Math.floor(Date.now() / 1000) - 10 }))
      .toString('base64url');
    const signature = createHmac('sha256', process.env.AUTH_SECRET!).update(payload).digest('base64url');
    expect(verifySessionToken(`${payload}.${signature}`)).toBeNull();
  });

  it('does not accept a token signed with a different secret', async () => {
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from(JSON.stringify({ uid: 'user-1', exp: Math.floor(Date.now() / 1000) + 999 }))
      .toString('base64url');
    const signature = createHmac('sha256', 'a-completely-different-secret-value').update(payload).digest('base64url');
    expect(verifySessionToken(`${payload}.${signature}`)).toBeNull();
  });
});
