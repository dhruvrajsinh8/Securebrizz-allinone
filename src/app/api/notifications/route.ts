import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function GET() {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ success: true, data: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load' }, { status: 500 });
  }
}
