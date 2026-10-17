import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp } from '@/lib/rateLimit';
import { checkAuthRateLimit } from '@/lib/authRateLimit';
import { createPasswordResetToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || !EMAIL_PATTERN.test(String(email))) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const ip = clientIp(request);
    const limit = await checkAuthRateLimit(email, ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: limit.reason },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 900) } }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, status: true },
    });

    if (user && user.status !== 'suspended') {
      const rawToken = await createPasswordResetToken(user.email);
      // Send email without blocking response on slow SMTP/API
      void sendPasswordResetEmail(user.email, rawToken);
    }

    // Always respond with the same message to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been sent.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process request.' },
      { status: 500 }
    );
  }
}
