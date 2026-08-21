import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Unknown account and wrong password return the same message — no email enumeration.
    if (!user) return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });

    const { ok, needsUpgrade } = await verifyPassword(password, user.password);
    if (!ok) return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });

    if (user.status === 'suspended') {
      return NextResponse.json({ success: false, error: 'Your account has been suspended.' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), ...(needsUpgrade ? { password: await hashPassword(password) } : {}) },
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(request));

    return NextResponse.json({
      success: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        company: user.company, plan: user.plan, createdAt: user.createdAt.toISOString(),
        lastLogin: new Date().toISOString(), twoFactorEnabled: user.twoFactorEnabled, status: user.status,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Login failed.' }, { status: 500 });
  }
}
