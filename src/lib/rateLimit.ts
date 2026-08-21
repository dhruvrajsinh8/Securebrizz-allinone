/**
 * Rate limiting for the scan endpoint. `/api/scan` makes the SERVER fetch a
 * caller-supplied URL — unlimited, it is an open proxy and a traffic amplifier.
 * The counter lives in the database (ScanAudit) because serverless invocations
 * do not share memory, and it doubles as an abuse audit trail.
 */

import { prisma } from './prisma';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const LIMITS = {
  userPerWindow: () => envInt('SCAN_LIMIT_USER', 10),
  windowMinutes: () => envInt('SCAN_LIMIT_WINDOW_MINUTES', 10),
  userPerDay: () => envInt('SCAN_LIMIT_USER_DAILY', 100),
  ipPerWindow: () => envInt('SCAN_LIMIT_IP', 20),
};

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  remaining: number;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function checkScanRateLimit(userId: string | null, ip: string): Promise<RateLimitResult> {
  const windowMinutes = LIMITS.windowMinutes();
  const windowStart = new Date(Date.now() - windowMinutes * 60_000);
  const dayStart = new Date(Date.now() - 24 * 60 * 60_000);

  try {
    const [userWindowCount, userDayCount, ipWindowCount] = await Promise.all([
      userId ? prisma.scanAudit.count({ where: { userId, createdAt: { gte: windowStart } } }) : Promise.resolve(0),
      userId ? prisma.scanAudit.count({ where: { userId, createdAt: { gte: dayStart } } }) : Promise.resolve(0),
      prisma.scanAudit.count({ where: { ip, createdAt: { gte: windowStart } } }),
    ]);

    const userLimit = LIMITS.userPerWindow();
    const dailyLimit = LIMITS.userPerDay();
    const ipLimit = LIMITS.ipPerWindow();

    if (userId && userWindowCount >= userLimit) return { allowed: false, reason: `Scan limit reached: ${userLimit} scans per ${windowMinutes} minutes. Try again shortly.`, retryAfterSeconds: windowMinutes * 60, remaining: 0 };
    if (userId && userDayCount >= dailyLimit) return { allowed: false, reason: `Daily scan limit reached (${dailyLimit} per day).`, retryAfterSeconds: 60 * 60, remaining: 0 };
    if (ipWindowCount >= ipLimit) return { allowed: false, reason: `Too many scans from this network: ${ipLimit} per ${windowMinutes} minutes.`, retryAfterSeconds: windowMinutes * 60, remaining: 0 };

    return { allowed: true, remaining: userId ? Math.max(0, userLimit - userWindowCount - 1) : Math.max(0, ipLimit - ipWindowCount - 1) };
  } catch (error) {
    // Fail open: a database hiccup should not take the scanner offline; the SSRF guard still constrains what can be reached.
    console.error('[rateLimit] check failed, allowing request:', error);
    return { allowed: true, remaining: 0 };
  }
}

export async function recordScanAttempt(userId: string | null, ip: string, target: string): Promise<string | null> {
  try {
    const row = await prisma.scanAudit.create({ data: { userId, ip, target: target.slice(0, 500), outcome: 'started' } });
    return row.id;
  } catch (error) {
    console.error('[rateLimit] failed to record attempt:', error);
    return null;
  }
}

export async function finishScanAttempt(id: string | null, outcome: 'completed' | 'rejected' | 'failed'): Promise<void> {
  if (!id) return;
  try { await prisma.scanAudit.update({ where: { id }, data: { outcome } }); } catch { /* best-effort */ }
}
