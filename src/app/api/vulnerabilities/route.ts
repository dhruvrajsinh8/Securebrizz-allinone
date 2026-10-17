import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

/** Rows per response. An unbounded findMany turns a busy account into a
 *  multi-megabyte payload and an equally large DOM. */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function positiveInt(raw: string | null, fallback: number, max: number): number {
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = positiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = positiveInt(searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER);
    const severityParam = searchParams.get('severity');
    const statusParam = searchParams.get('status');

    // Scoped to the caller: findings belong to whoever ran the scan.
    const where: Record<string, unknown> = { userId: userIdOrError };
    if (search) {
      // Mirrors the fields the vulnerabilities table lets you search on.
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { affectedAsset: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { cveId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (severityParam) where.severity = { in: severityParam.split(',') };
    if (statusParam) where.status = { in: statusParam.split(',') };

    const [total, vulnerabilities] = await Promise.all([
      prisma.vulnerability.count({ where }),
      prisma.vulnerability.findMany({
        where,
        // `id` breaks ties: findings discovered in the same scan share a
        // timestamp, and without a unique tiebreaker OFFSET paging can repeat
        // or skip those rows between pages.
        orderBy: [{ discoveredAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
    ]);
    const formatted = vulnerabilities.map((v) => ({
      ...v,
      tags: v.tags ? v.tags.split(',').filter(Boolean) : [],
      references: v.references ? v.references.split(',').filter(Boolean) : [],
      discoveredAt: v.discoveredAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      resolvedAt: v.resolvedAt ? v.resolvedAt.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      total,
      limit,
      offset,
      hasMore: offset + formatted.length < total,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load' }, { status: 500 });
  }
}
