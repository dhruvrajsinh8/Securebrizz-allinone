import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function GET(request: Request) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const severityParam = searchParams.get('severity');
    const statusParam = searchParams.get('status');

    // Scoped to the caller: findings belong to whoever ran the scan.
    const where: Record<string, unknown> = { userId: userIdOrError };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { affectedAsset: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (severityParam) where.severity = { in: severityParam.split(',') };
    if (statusParam) where.status = { in: statusParam.split(',') };

    const vulnerabilities = await prisma.vulnerability.findMany({ where, orderBy: { discoveredAt: 'desc' } });
    const formatted = vulnerabilities.map((v) => ({
      ...v,
      tags: v.tags ? v.tags.split(',').filter(Boolean) : [],
      references: v.references ? v.references.split(',').filter(Boolean) : [],
      discoveredAt: v.discoveredAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      resolvedAt: v.resolvedAt ? v.resolvedAt.toISOString() : null,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load' }, { status: 500 });
  }
}
