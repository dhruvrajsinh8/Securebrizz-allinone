import { NextResponse } from 'next/server';
import { verifyEmailVerificationToken } from '@/lib/tokens';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/?verify_error=missing_token', request.url));
  }

  const result = await verifyEmailVerificationToken(token);
  if (!result.success) {
    const errorParam = encodeURIComponent(result.error ?? 'Verification failed');
    return NextResponse.redirect(new URL(`/?verify_error=${errorParam}`, request.url));
  }

  return NextResponse.redirect(new URL('/?verified=true', request.url));
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required.' }, { status: 400 });
    }

    const result = await verifyEmailVerificationToken(token);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Email address verified successfully.' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Verification failed.' },
      { status: 500 }
    );
  }
}
