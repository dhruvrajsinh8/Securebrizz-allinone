import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionClaims } from '@/lib/session';
import { destroySession } from '@/lib/sessionStore';

export async function POST() {
  const cookieStore = await cookies();

  // Clearing the cookie only affects this browser; deleting the row is what
  // actually invalidates the token, including any copy of it taken elsewhere.
  const claims = verifySessionClaims(cookieStore.get(SESSION_COOKIE)?.value);
  await destroySession(claims?.sessionId);

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete('session_user_id');
  return NextResponse.json({ success: true });
}
