import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const { id } = await params;
    // Only the owner may revoke their own session.
    const session = await prisma.session.findFirst({ where: { id, userId: userIdOrError } });
    if (!session) return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
    await prisma.session.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 });
  }
}
