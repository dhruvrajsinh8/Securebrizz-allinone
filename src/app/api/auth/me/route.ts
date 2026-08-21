import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const user = await prisma.user.findUnique({ where: { id: userIdOrError } });
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    if (user.status === 'suspended') return NextResponse.json({ success: false, error: 'Your account has been suspended.' }, { status: 403 });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
        company: user.company, plan: user.plan, createdAt: user.createdAt.toISOString(),
        lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null, twoFactorEnabled: user.twoFactorEnabled, status: user.status,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load session.' }, { status: 500 });
  }
}
