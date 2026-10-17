/**
 * Throttling for credential endpoints. Without it `/api/auth/login` accepts
 * unlimited password guesses, which turns any leaked email list into an
 * offline-speed online attack.
 *
 * Two independent counters, because either one alone is bypassable:
 *   - per email  → stops one account being ground down from a botnet
 *   - per IP     → stops one host spraying one password across many accounts
 *
 * Only failures count toward the limit, and a successful sign-in clears the
 * email's history, so a legitimate user who mistypes twice and then succeeds is
 * never penalised afterwards.
 */

import { prisma } from './prisma';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const AUTH_LIMITS = {
  /** Failed attempts against one email address before it is locked. */
  perEmail: () => envInt('AUTH_LIMIT_EMAIL', 5),
  /** Failed attempts from one IP across all accounts. */
  perIp: () => envInt('AUTH_LIMIT_IP', 20),
  windowMinutes: () => envInt('AUTH_LIMIT_WINDOW_MINUTES', 15),
};

export interface AuthLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

/** Normalised so casing or padding cannot be used to mint fresh quota. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function checkAuthRateLimit(email: string, ip: string): Promise<AuthLimitResult> {
  const windowMinutes = AUTH_LIMITS.windowMinutes();
  const windowStart = new Date(Date.now() - windowMinutes * 60_000);
  const retryAfterSeconds = windowMinutes * 60;

  try {
    const [emailFailures, ipFailures] = await Promise.all([
      prisma.authAttempt.count({
        where: { email: normaliseEmail(email), success: false, createdAt: { gte: windowStart } },
      }),
      prisma.authAttempt.count({
        where: { ip, success: false, createdAt: { gte: windowStart } },
      }),
    ]);

    if (emailFailures >= AUTH_LIMITS.perEmail()) {
      return {
        allowed: false,
        retryAfterSeconds,
        reason: `Too many failed sign-in attempts for this account. Try again in ${windowMinutes} minutes.`,
      };
    }

    if (ipFailures >= AUTH_LIMITS.perIp()) {
      return {
        allowed: false,
        retryAfterSeconds,
        reason: `Too many failed sign-in attempts from this network. Try again in ${windowMinutes} minutes.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    // Fail open: the database is required to authenticate anyway, so refusing
    // here would only convert an outage into a total lockout.
    console.error('[authRateLimit] check failed, allowing request:', error);
    return { allowed: true };
  }
}

export async function recordAuthAttempt(email: string, ip: string, success: boolean): Promise<void> {
  try {
    await prisma.authAttempt.create({
      data: { email: normaliseEmail(email).slice(0, 320), ip, success },
    });
    // A correct password proves the owner is present; clear the failure history
    // so earlier typos cannot lock them out later in the window.
    if (success) {
      await prisma.authAttempt.deleteMany({
        where: { email: normaliseEmail(email), success: false },
      });
    }
  } catch (error) {
    console.error('[authRateLimit] failed to record attempt:', error);
  }
}
