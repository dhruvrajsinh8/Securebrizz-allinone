/**
 * Severity presentation, in one place. Red intensity for problems, neutral grey
 * as severity falls, green reserved for "this is fine".
 */

import type { Severity } from '@/types/scanner';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

export function severityBadge(severity: Severity | string): string {
  switch (severity) {
    case 'critical': return 'bg-[#a8402e]/16 text-[#c97f68] border border-[#a8402e]/40';
    case 'high': return 'bg-[#a8402e]/8 text-[#8a3122] border border-[#a8402e]/25';
    case 'medium': return 'bg-[#6b572f]/8 text-[#4a3b1f] border border-[#6b572f]/22';
    case 'low': return 'bg-[#937d57]/8 text-[#6b572f] border border-[#937d57]/20';
    default: return 'bg-[#a6906a]/8 text-[#937d57] border border-[#a6906a]/20';
  }
}

export function severityDot(severity: Severity | string): string {
  switch (severity) {
    case 'critical': return 'bg-[#a8402e]';
    case 'high': return 'bg-[#8a3122]';
    case 'medium': return 'bg-[#6b572f]';
    case 'low': return 'bg-[#937d57]';
    default: return 'bg-[#a6906a]';
  }
}

export function severityText(severity: Severity | string): string {
  switch (severity) {
    case 'critical': return 'text-[#c97f68]';
    case 'high': return 'text-[#8a3122]';
    case 'medium': return 'text-[#4a3b1f]';
    case 'low': return 'text-[#6b572f]';
    default: return 'text-[#937d57]';
  }
}

export function scoreColor(score: number): string {
  if (score >= 85) return '#7f9548';
  if (score >= 65) return '#6b572f';
  if (score >= 50) return '#8a3122';
  return '#a8402e';
}

export function gradeBadge(grade?: string): string {
  switch (grade) {
    case 'A+':
    case 'A': return 'bg-[#7f9548]/12 text-[#47601f] border border-[#7f9548]/30';
    case 'B':
    case 'C': return 'bg-[#6b572f]/10 text-[#4a3b1f] border border-[#6b572f]/25';
    case 'D': return 'bg-[#a8402e]/10 text-[#8a3122] border border-[#a8402e]/25';
    case 'F': return 'bg-[#a8402e]/16 text-[#c97f68] border border-[#a8402e]/40';
    default: return 'bg-[#a6906a]/10 text-[#6b572f] border border-[#a6906a]/25';
  }
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'present':
    case 'ok':
    case 'valid': return 'bg-[#7f9548]/12 text-[#47601f] border border-[#7f9548]/30';
    case 'missing':
    case 'failed':
    case 'expired':
    case 'invalid': return 'bg-[#a8402e]/12 text-[#8a3122] border border-[#a8402e]/30';
    case 'misconfigured':
    case 'expiring_soon': return 'bg-[#a8402e]/8 text-[#c97f68] border border-[#a8402e]/22';
    default: return 'bg-[#937d57]/10 text-[#6b572f] border border-[#937d57]/25';
  }
}
