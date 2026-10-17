/**
 * Scoring. Every deduction is attributed to a named finding and returned in
 * `scoreBreakdown`. Findings that could not be checked never deduct. Repeated
 * low-severity findings in one category get diminishing weight.
 */

import type { CheckDiagnostic, ScanRecommendation, ScoreComponent, Severity } from '@/types/scanner';

/** Full price for the first finding of a severity in its category. Exported so
 *  the report can show a reader where a deduction came from. */
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 25, high: 12, medium: 6, low: 2, info: 0 };
export const REPEAT_FACTORS = [1, 0.6, 0.35, 0.2];

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export interface ScoreResult {
  score: number;
  riskScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: ScoreComponent[];
}

export function scoreFindings(findings: ScanRecommendation[]): ScoreResult {
  const byCategory = new Map<string, ScanRecommendation[]>();
  for (const finding of findings) {
    if (finding.resolved) { finding.scoreImpact = 0; continue; }
    const list = byCategory.get(finding.category) ?? [];
    list.push(finding);
    byCategory.set(finding.category, list);
  }

  const breakdown: ScoreComponent[] = [];
  let totalDeduction = 0;

  for (const [category, categoryFindings] of byCategory) {
    const ordered = [...categoryFindings].sort((a, b) => SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority]);
    let categoryDeduction = 0;
    ordered.forEach((finding, index) => {
      const factor = REPEAT_FACTORS[Math.min(index, REPEAT_FACTORS.length - 1)];
      const deduction = Math.round(SEVERITY_WEIGHT[finding.priority] * factor * 10) / 10;
      finding.scoreImpact = deduction;
      categoryDeduction += deduction;
    });
    if (categoryDeduction > 0) {
      breakdown.push({ category, label: `${ordered.length} finding${ordered.length === 1 ? '' : 's'}`, deducted: Math.round(categoryDeduction * 10) / 10 });
      totalDeduction += categoryDeduction;
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  breakdown.sort((a, b) => b.deducted - a.deducted);
  return { score, riskScore: 100 - score, grade: toGrade(score), breakdown };
}

export function toGrade(score: number): ScoreResult['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function sortFindings(findings: ScanRecommendation[]): ScanRecommendation[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority];
    if (bySeverity !== 0) return bySeverity;
    return a.title.localeCompare(b.title);
  });
}

export function buildSummary(args: {
  hostname: string;
  findings: ScanRecommendation[];
  score: number;
  grade: string;
  checks: CheckDiagnostic[];
  durationMs: number;
}): string {
  const { hostname, findings, score, grade, checks, durationMs } = args;
  const open = findings.filter((finding) => !finding.resolved);
  const counts = {
    critical: open.filter((f) => f.priority === 'critical').length,
    high: open.filter((f) => f.priority === 'high').length,
    medium: open.filter((f) => f.priority === 'medium').length,
    low: open.filter((f) => f.priority === 'low').length,
  };
  const failedChecks = checks.filter((check) => check.status === 'failed');
  const seconds = (durationMs / 1000).toFixed(1);

  if (open.length === 0) {
    const base = `${hostname} scored ${score}/100 (grade ${grade}). No issues were raised across ${checks.length} checks in ${seconds}s.`;
    return failedChecks.length > 0 ? `${base} ${failedChecks.length} check(s) could not complete, so coverage is partial: ${failedChecks.map((c) => c.label).join(', ')}.` : base;
  }

  const severityParts = [
    counts.critical > 0 ? `${counts.critical} critical` : null,
    counts.high > 0 ? `${counts.high} high` : null,
    counts.medium > 0 ? `${counts.medium} medium` : null,
    counts.low > 0 ? `${counts.low} low` : null,
  ].filter(Boolean);

  const worst = open[0];
  let summary = `${hostname} scored ${score}/100 (grade ${grade}) across ${checks.length} checks in ${seconds}s. ${open.length} finding${open.length === 1 ? '' : 's'}: ${severityParts.join(', ')}. Highest impact: ${worst.title.toLowerCase()}.`;
  if (failedChecks.length > 0) summary += ` ${failedChecks.length} check(s) could not complete (${failedChecks.map((c) => c.label).join(', ')}), so these results are partial.`;
  return summary;
}
