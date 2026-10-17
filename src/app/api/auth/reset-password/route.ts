import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { validatePasswordResetToken, consumePasswordResetToken } from '@/lib/tokens';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'Password reset token is required.' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` },
        { status: 400 }
      );
    }

    const validation = await validatePasswordResetToken(token);
    if (!validation.valid || !validation.email) {
      return NextResponse.json(
        { success: false, error: validation.error ?? 'Invalid or expired password reset link.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: validation.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Account no longer exists.' }, { status: 404 });
    }

    const hashedPassword = await hashPassword(newPassword);

    // Update password and invalidate reset token
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await consumePasswordResetToken(token);

    // Invalidate all active sessions for this user so any compromised device is logged out
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Password reset failed.' },
      { status: 500 }
    );
  }
}
