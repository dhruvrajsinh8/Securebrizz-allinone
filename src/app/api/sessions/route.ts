import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const sessions = await prisma.session.findMany({ where: { userId: userIdOrError }, orderBy: { lastActive: 'desc' } });
    return NextResponse.json({ success: true, data: sessions.map((s) => ({ ...s, lastActive: s.lastActive.toISOString() })) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load' }, { status: 500 });
  }
}
