/**
 * Severity presentation, in one place. Red intensity for problems, neutral grey
 * as severity falls, green reserved for "this is fine".
 */

import type { Severity } from '@/types/scanner';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

export function severityBadge(severity: Severity | string): string {
  switch (severity) {
    case 'critical': return 'bg-[#dc2626]/16 text-[#fca5a5] border border-[#dc2626]/40';
    case 'high': return 'bg-[#dc2626]/8 text-[#f87171] border border-[#dc2626]/25';
    case 'medium': return 'bg-[#a1a1aa]/8 text-[#d4d4d8] border border-[#a1a1aa]/22';
    case 'low': return 'bg-[#71717a]/8 text-[#a1a1aa] border border-[#71717a]/20';
    default: return 'bg-[#52525b]/8 text-[#8b8b93] border border-[#52525b]/20';
  }
}

export function severityDot(severity: Severity | string): string {
  switch (severity) {
    case 'critical': return 'bg-[#dc2626]';
    case 'high': return 'bg-[#f87171]';
    case 'medium': return 'bg-[#a1a1aa]';
    case 'low': return 'bg-[#71717a]';
    default: return 'bg-[#52525b]';
  }
}

export function severityText(severity: Severity | string): string {
  switch (severity) {
    case 'critical': return 'text-[#fca5a5]';
    case 'high': return 'text-[#f87171]';
    case 'medium': return 'text-[#d4d4d8]';
    case 'low': return 'text-[#a1a1aa]';
    default: return 'text-[#8b8b93]';
  }
}

export function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 65) return '#a1a1aa';
  if (score >= 50) return '#f87171';
  return '#dc2626';
}

export function gradeBadge(grade?: string): string {
  switch (grade) {
    case 'A+':
    case 'A': return 'bg-[#22c55e]/12 text-[#4ade80] border border-[#22c55e]/30';
    case 'B':
    case 'C': return 'bg-[#a1a1aa]/10 text-[#d4d4d8] border border-[#a1a1aa]/25';
    case 'D': return 'bg-[#dc2626]/10 text-[#f87171] border border-[#dc2626]/25';
    case 'F': return 'bg-[#dc2626]/16 text-[#fca5a5] border border-[#dc2626]/40';
    default: return 'bg-[#52525b]/10 text-[#a1a1aa] border border-[#52525b]/25';
  }
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'present':
    case 'ok':
    case 'valid': return 'bg-[#22c55e]/12 text-[#4ade80] border border-[#22c55e]/30';
    case 'missing':
    case 'failed':
    case 'expired':
    case 'invalid': return 'bg-[#dc2626]/12 text-[#f87171] border border-[#dc2626]/30';
    case 'misconfigured':
    case 'expiring_soon': return 'bg-[#dc2626]/8 text-[#fca5a5] border border-[#dc2626]/22';
    default: return 'bg-[#71717a]/10 text-[#a1a1aa] border border-[#71717a]/25';
  }
}
