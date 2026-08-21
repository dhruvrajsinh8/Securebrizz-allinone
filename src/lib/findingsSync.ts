/**
 * Turns scan findings into tracked Vulnerability rows. Keyed by
 * (userId, target, findingId) so repeated scans update one row, workflow state
 * survives a re-scan, and findings that stop appearing auto-resolve.
 */

import { prisma } from './prisma';
import type { ScanResult, ScanRecommendation } from '@/types/scanner';

const EFFORT: Record<string, string> = { easy: 'low', medium: 'medium', hard: 'high' };
const MANUAL_STATUSES = new Set(['false_positive', 'accepted', 'in_progress']);

function hostOf(result: ScanResult): string {
  try { return new URL(result.finalUrl ?? result.url).hostname; } catch { return result.url; }
}

function toRow(finding: ScanRecommendation, result: ScanResult, host: string, userId: string) {
  return {
    title: finding.title,
    description: finding.description,
    severity: finding.priority,
    affectedAsset: result.finalUrl ?? result.url,
    category: finding.category,
    tags: [finding.cwe, finding.owasp, finding.confidence].filter(Boolean).join(','),
    recommendation: finding.remediation ?? finding.description,
    references: (finding.references ?? []).map((reference) => reference.url).join(','),
    effort: EFFORT[finding.difficulty] ?? 'medium',
    impact: finding.impact ?? finding.estimatedImpact,
    findingId: finding.id,
    target: host,
    lastScanId: result.id,
    userId,
    evidence: finding.evidence ? JSON.stringify(finding.evidence) : null,
  };
}

export interface SyncSummary { created: number; updated: number; autoResolved: number; }

export async function syncFindingsToVulnerabilities(result: ScanResult, userId: string): Promise<SyncSummary> {
  if (result.scanResultStatus !== 'completed') return { created: 0, updated: 0, autoResolved: 0 };

  const host = hostOf(result);
  const now = new Date();
  const summary: SyncSummary = { created: 0, updated: 0, autoResolved: 0 };
  const seenFindingIds = result.recommendations.map((finding) => finding.id);

  const existingRows = await prisma.vulnerability.findMany({ where: { target: host, userId } });
  const existingByFindingId = new Map(
    existingRows.filter((row): row is typeof row & { findingId: string } => row.findingId !== null).map((row) => [row.findingId, row])
  );

  const toCreate: ReturnType<typeof toRow>[] = [];
  const updates: Promise<unknown>[] = [];
  const unchangedIds: string[] = [];

  for (const finding of result.recommendations) {
    const row = toRow(finding, result, host, userId);
    const existing = existingByFindingId.get(finding.id);
    if (!existing) { toCreate.push(row); continue; }

    const keepStatus = MANUAL_STATUSES.has(existing.status);
    const reopening = !keepStatus && existing.status !== 'open';
    const contentSame = !reopening && existing.title === row.title && existing.description === row.description && existing.severity === row.severity && existing.recommendation === row.recommendation && existing.impact === row.impact && existing.evidence === row.evidence && existing.affectedAsset === row.affectedAsset;

    if (contentSame) { unchangedIds.push(existing.id); continue; }

    updates.push(prisma.vulnerability.update({ where: { id: existing.id }, data: { ...row, lastSeenAt: now, ...(keepStatus ? {} : { status: 'open', resolvedAt: null }) } }));
  }

  if (unchangedIds.length > 0) {
    await prisma.vulnerability.updateMany({ where: { id: { in: unchangedIds } }, data: { lastSeenAt: now, lastScanId: result.id } });
    summary.updated += unchangedIds.length;
  }

  if (toCreate.length > 0) {
    await prisma.vulnerability.createMany({ data: toCreate.map((row) => ({ ...row, status: 'open', firstSeenAt: now, lastSeenAt: now, discoveredAt: now })), skipDuplicates: true });
    summary.created = toCreate.length;
  }

  if (updates.length > 0) { await Promise.all(updates); summary.updated += updates.length; }

  const disappeared = await prisma.vulnerability.updateMany({
    where: { target: host, userId, status: { in: ['open', 'in_progress'] }, findingId: { notIn: seenFindingIds.length > 0 ? seenFindingIds : ['__none__'] } },
    data: { status: 'resolved', resolvedAt: now },
  });
  summary.autoResolved = disappeared.count;

  return summary;
}
