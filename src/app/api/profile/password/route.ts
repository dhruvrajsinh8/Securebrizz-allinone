import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';

export async function PATCH(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  const userId = userIdOrError;

  try {
    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Current password and new password are required.' }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ success: false, error: 'New password must be at least 8 characters long.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });

    const { ok } = await verifyPassword(currentPassword, user.password);
    if (!ok) return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 401 });

    await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 });
  }
}
