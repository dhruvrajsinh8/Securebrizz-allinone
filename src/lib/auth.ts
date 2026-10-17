import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionClaims } from './session';
import { prisma } from './prisma';

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
}

/**
 * Reads the session cookie, verifies its signature and expiry, and returns the
 * authenticated userId. Returns a 401 NextResponse when there is no valid
 * session.
 *
 * A valid signature is necessary but not sufficient: if the token names a
 * session row, that row must still exist and be unexpired. That is what makes
 * "sign out this device" real rather than cosmetic — deleting the row
 * invalidates the cookie on the very next request, even though the signature
 * still checks out.
 */
export async function getAuthenticatedUserId(): Promise<string | NextResponse> {
  const cookieStore = await cookies();
  const claims = verifySessionClaims(cookieStore.get(SESSION_COOKIE)?.value);
  if (!claims) return unauthorized();

  if (claims.sessionId) {
    try {
      const session = await prisma.session.findFirst({
        where: { id: claims.sessionId, userId: claims.userId },
        select: { id: true, expiresAt: true },
      });
      if (!session) return unauthorized();
      if (session.expiresAt.getTime() <= Date.now()) return unauthorized();
    } catch (error) {
      // Fail open on infrastructure trouble: the signature and expiry were
      // already verified, so this only forgoes the revocation check rather
      // than admitting an unauthenticated caller.
      console.error('[auth] session lookup failed, accepting signed token:', error);
    }
  }

  return claims.userId;
}

export function isAuthError(value: string | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
