import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';
import { createEmailVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';
import { clientIp } from '@/lib/rateLimit';
import { checkAuthRateLimit } from '@/lib/authRateLimit';

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    let userId: string | null = null;
    let userEmail: string | null = null;

    // First check if caller has an active authenticated session
    const authResult = await getAuthenticatedUserId();
    if (!isAuthError(authResult)) {
      userId = authResult;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, emailVerified: true },
      });
      if (user) {
        if (user.emailVerified) {
          return NextResponse.json({ success: true, message: 'Email is already verified.' });
        }
        userEmail = user.email;
      }
    }

    // If not logged in, accept email from request body
    if (!userEmail) {
      const body = await request.json().catch(() => ({}));
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email) {
        return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
      }

      const limit = await checkAuthRateLimit(email, ip);
      if (!limit.allowed) {
        return NextResponse.json(
          { success: false, error: limit.reason },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 900) } }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, emailVerified: true },
      });

      if (user) {
        if (user.emailVerified) {
          return NextResponse.json({ success: true, message: 'Email is already verified.' });
        }
        userId = user.id;
        userEmail = user.email;
      }
    }

    if (userId && userEmail) {
      const rawToken = await createEmailVerificationToken(userId);
      void sendVerificationEmail(userEmail, rawToken);
    }

    // Uniform message to avoid account discovery
    return NextResponse.json({
      success: true,
      message: 'If the account exists and is unverified, a verification email has been sent.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send verification email.' },
      { status: 500 }
    );
  }
}
