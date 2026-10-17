import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/session';
import { clientIp } from '@/lib/rateLimit';
import { createSession } from '@/lib/sessionStore';
import { createEmailVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { name, email, password, company } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required.' }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(String(email))) {
      return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return NextResponse.json({ success: false, error: 'Email already registered.' }, { status: 400 });

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: await hashPassword(password),
        role: 'viewer',
        company,
        plan: 'starter',
        twoFactorEnabled: false,
        status: 'active',
        emailVerified: false,
      },
    });

    const ip = clientIp(request);
    const sessionId = await createSession(user.id, request, ip);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id, sessionId ?? undefined), sessionCookieOptions(request));

    // Generate verification token and send verification email in background
    try {
      const rawToken = await createEmailVerificationToken(user.id);
      void sendVerificationEmail(user.email, rawToken);
    } catch (err) {
      console.error('[register] could not send verification email:', err);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        company: user.company, plan: user.plan, createdAt: user.createdAt.toISOString(),
        lastLogin: null, twoFactorEnabled: user.twoFactorEnabled, status: user.status,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Registration failed.' }, { status: 500 });
  }
}
