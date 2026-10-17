import { randomBytes, createHash } from 'crypto';
import { prisma } from './prisma';

export const EMAIL_VERIFY_MAX_AGE_HOURS = 24;
export const PASSWORD_RESET_MAX_AGE_HOURS = 1;

/**
 * Generate a cryptographically strong 32-byte (64 hex char) random token.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a raw token with SHA-256 before storing or querying the database.
 * Storing only hashes prevents leaked database dumps from yielding valid tokens.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Create a new single-use email verification token for the given user.
 * Returns the unhashed raw token to be sent via email.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_MAX_AGE_HOURS * 60 * 60 * 1000);

  // Invalidate any existing unused verification tokens for this user
  await prisma.emailVerifyToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  await prisma.emailVerifyToken.create({
    data: {
      userId,
      token: tokenHash,
      expiresAt,
      used: false,
    },
  });

  return rawToken;
}

/**
 * Verifies an email token. If valid, marks the user as verified and the token as used.
 */
export async function verifyEmailVerificationToken(rawToken: string): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
}> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, error: 'Verification token is required.' };
  }

  const tokenHash = hashToken(rawToken);

  const record = await prisma.emailVerifyToken.findFirst({
    where: { token: tokenHash, used: false },
  });

  if (!record) {
    return { success: false, error: 'Invalid or already used verification link.' };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return { success: false, error: 'Verification link has expired. Please request a new one.' };
  }

  // Mark token used and user verified
  await prisma.$transaction([
    prisma.emailVerifyToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
  ]);

  return { success: true, userId: record.userId };
}

/**
 * Create a new single-use password reset token for the given email address.
 * Returns the unhashed raw token to be sent via email.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_MAX_AGE_HOURS * 60 * 60 * 1000);

  // Invalidate any existing unused reset tokens for this email
  await prisma.passwordResetToken.updateMany({
    where: { email: email.toLowerCase(), used: false },
    data: { used: true },
  });

  await prisma.passwordResetToken.create({
    data: {
      email: email.toLowerCase(),
      token: tokenHash,
      expiresAt,
      used: false,
    },
  });

  return rawToken;
}

/**
 * Validate a password reset token without consuming it yet.
 */
export async function validatePasswordResetToken(rawToken: string): Promise<{
  valid: boolean;
  error?: string;
  email?: string;
}> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'Password reset token is required.' };
  }

  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findFirst({
    where: { token: tokenHash, used: false },
  });

  if (!record) {
    return { valid: false, error: 'Invalid or already used password reset link.' };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return { valid: false, error: 'Password reset link has expired. Please request a new one.' };
  }

  return { valid: true, email: record.email };
}

/**
 * Consume a password reset token after resetting the password.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.passwordResetToken.updateMany({
    where: { token: tokenHash, used: false },
    data: { used: true },
  });
}
