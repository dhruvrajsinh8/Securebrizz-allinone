import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/session';
import { checkAuthRateLimit, recordAuthAttempt } from '@/lib/authRateLimit';
import { clientIp } from '@/lib/rateLimit';
import { createSession, purgeExpiredSessions } from '@/lib/sessionStore';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
    }

    // Throttle before touching the password, so guessing costs an attacker the
    // full window rather than one bcrypt comparison.
    const ip = clientIp(request);
    const limit = await checkAuthRateLimit(email, ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: limit.reason },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 900) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Unknown account and wrong password return the same message — no email enumeration.
    if (!user) {
      await recordAuthAttempt(email, ip, false);
      return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const { ok, needsUpgrade } = await verifyPassword(password, user.password);
    if (!ok) {
      await recordAuthAttempt(email, ip, false);
      return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    await recordAuthAttempt(email, ip, true);

    if (user.status === 'suspended') {
      return NextResponse.json({ success: false, error: 'Your account has been suspended.' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), ...(needsUpgrade ? { password: await hashPassword(password) } : {}) },
    });

    await purgeExpiredSessions(user.id);
    const sessionId = await createSession(user.id, request, ip);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id, sessionId ?? undefined), sessionCookieOptions(request));

    return NextResponse.json({
      success: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        company: user.company, plan: user.plan, createdAt: user.createdAt.toISOString(),
        lastLogin: new Date().toISOString(), twoFactorEnabled: user.twoFactorEnabled, status: user.status,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Login failed.' }, { status: 500 });
  }
}
