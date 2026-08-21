import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './session';

/**
 * Reads the session cookie, verifies its signature and expiry, and returns the
 * authenticated userId. Returns a 401 NextResponse when there is no valid
 * session. The signature check is what makes this trustworthy.
 */
export async function getAuthenticatedUserId(): Promise<string | NextResponse> {
  const cookieStore = await cookies();
  const userId = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  return userId;
}

export function isAuthError(value: string | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
