import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const read = typeof (body as { read?: unknown }).read === 'boolean' ? (body as { read: boolean }).read : true;
    const updated = await prisma.notification.update({ where: { id }, data: { read } });
    return NextResponse.json({ success: true, data: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const { id } = await params;
    await prisma.notification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 });
  }
}
