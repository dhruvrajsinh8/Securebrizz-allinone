/**
 * Creating and retiring the Session rows that back a session cookie.
 *
 * Kept out of the route handlers so login, logout and the device list all agree
 * on the shape of a session row, and so a failure to record one never blocks a
 * legitimate sign-in.
 */

import { prisma } from './prisma';
import { SESSION_MAX_AGE_SECONDS } from './session';

/** Coarse client description for the "signed-in devices" list. */
export function describeClient(request: Request): { device: string; browser: string } {
  const ua = request.headers.get('user-agent') ?? '';

  const device = /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Macintosh|Mac OS X/i.test(ua) ? 'macOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Unknown device';

  // Order matters: Edge and Chrome both claim "Chrome", Chrome claims "Safari".
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /OPR\//i.test(ua) ? 'Opera'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari'
    : 'Unknown browser';

  return { device, browser };
}

/**
 * Returns the new session's id, or null if it could not be stored. A null id
 * yields a token with no `sid`, which still authenticates — a database hiccup
 * should not stop someone signing in, it only costs revocability for that one
 * session.
 */
export async function createSession(userId: string, request: Request, ip: string): Promise<string | null> {
  const { device, browser } = describeClient(request);
  try {
    const session = await prisma.session.create({
      data: {
        userId,
        device,
        browser,
        ip,
        location: 'Unknown',
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
        isCurrent: true,
      },
      select: { id: true },
    });
    return session.id;
  } catch (error) {
    console.error('[session] could not record session:', error);
    return null;
  }
}

export async function destroySession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  try {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  } catch (error) {
    console.error('[session] could not delete session:', error);
  }
}

/** Housekeeping so the device list does not fill with dead rows. */
export async function purgeExpiredSessions(userId: string): Promise<void> {
  try {
    await prisma.session.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  } catch { /* best-effort */ }
}
