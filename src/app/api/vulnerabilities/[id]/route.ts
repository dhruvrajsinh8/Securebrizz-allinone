import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, isAuthError } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userIdOrError = await getAuthenticatedUserId();
  if (isAuthError(userIdOrError)) return userIdOrError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, assignee } = body as { status?: string; assignee?: string };

    const existing = await prisma.vulnerability.findFirst({ where: { id, userId: userIdOrError } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (status !== undefined) {
      data.status = status;
      data.resolvedAt = status === 'resolved' ? new Date() : null;
    }
    if (assignee !== undefined) data.assignee = assignee || null;

    const updated = await prisma.vulnerability.update({ where: { id }, data });
    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        tags: updated.tags ? updated.tags.split(',').filter(Boolean) : [],
        references: updated.references ? updated.references.split(',').filter(Boolean) : [],
        discoveredAt: updated.discoveredAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 });
  }
}
