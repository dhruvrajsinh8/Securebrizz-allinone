import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/session';

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ success: false, error: 'Email already registered.' }, { status: 400 });

    const user = await prisma.user.create({
      data: { name, email, password: await hashPassword(password), role: 'viewer', company, plan: 'starter', twoFactorEnabled: false, status: 'active' },
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(request));

    return NextResponse.json({
      success: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        company: user.company, plan: user.plan, createdAt: user.createdAt.toISOString(),
        lastLogin: null, twoFactorEnabled: user.twoFactorEnabled, status: user.status,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Registration failed.' }, { status: 500 });
  }
}
