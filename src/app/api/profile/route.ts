import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

function serialize(user: {
  id: string; name: string; email: string; role: string; avatar: string | null;
  company: string | null; plan: string; createdAt: Date; lastLogin: Date | null;
  twoFactorEnabled: boolean; status: string;
}) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar,
    company: user.company, plan: user.plan, createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null, twoFactorEnabled: user.twoFactorEnabled, status: user.status,
  };
}

export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const user = await prisma.user.findUnique({ where: { id: userIdOrError } });
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    return NextResponse.json({ success: true, user: serialize(user) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const body = await request.json();
    const { name, company, avatar, twoFactorEnabled } = body as { name?: string; company?: string; avatar?: string; twoFactorEnabled?: boolean };
    const data: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (company !== undefined) data.company = company || null;
    if (avatar !== undefined) data.avatar = avatar || null;
    if (typeof twoFactorEnabled === 'boolean') data.twoFactorEnabled = twoFactorEnabled;

    const user = await prisma.user.update({ where: { id: userIdOrError }, data });
    return NextResponse.json({ success: true, user: serialize(user) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 });
  }
}
