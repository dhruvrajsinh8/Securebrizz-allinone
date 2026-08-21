/**
 * Command-line runner for the passive scanner.
 *   npm run scan -- example.com
 *   npm run scan -- https://example.com --json
 */

import { performPassiveScan } from '../src/lib/scanner';
import type { ScanResult } from '../src/types/scanner';

const RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m', RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', GREY = '\x1b[90m';

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': case 'high': return RED;
    case 'medium': return YELLOW;
    default: return GREY;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function printReport(result: ScanResult): void {
  if (result.scanResultStatus !== 'completed') {
    console.log(`\n${RED}${BOLD}Scan did not complete${RESET}`);
    console.log(`${result.scanResultStatus}: ${result.errorMessage}\n`);
    return;
  }
  const scoreColor = result.overallScore >= 85 ? GREEN : result.overallScore >= 65 ? YELLOW : RED;
  console.log(`\n${BOLD}${result.url}${RESET}`);
  console.log(`${scoreColor}${BOLD}${result.overallScore}/100  grade ${result.grade}${RESET}  ${DIM}${((result.durationMs ?? 0) / 1000).toFixed(1)}s${RESET}\n`);
  console.log(`${result.aiSummary}\n`);
  console.log(`${BOLD}Checks${RESET}`);
  for (const check of result.checks ?? []) {
    const mark = check.status === 'ok' ? `${GREEN}ok${RESET}` : check.status === 'failed' ? `${RED}fail${RESET}` : `${GREY}skip${RESET}`;
    console.log(`  [${mark}] ${check.label.padEnd(26)} ${DIM}${check.detail}${RESET}`);
  }
  console.log(`\n${BOLD}Findings (${result.recommendations.length})${RESET}`);
  for (const finding of result.recommendations) {
    const color = severityColor(finding.priority);
    console.log(`\n  ${color}${BOLD}[${finding.priority.toUpperCase()}]${RESET} ${finding.title}  ${DIM}(-${finding.scoreImpact ?? 0} pts, ${finding.confidence})${RESET}`);
    console.log(`    ${finding.description}`);
    for (const item of finding.evidence ?? []) console.log(`      ${GREY}${item.label}:${RESET} ${truncate(item.value, 110)}`);
    if (finding.cwe) console.log(`      ${GREY}${finding.cwe}${finding.owasp ? ` · ${finding.owasp}` : ''}${RESET}`);
  }
  if (result.scoreBreakdown?.length) {
    console.log(`\n${BOLD}Score breakdown${RESET}`);
    for (const component of result.scoreBreakdown) console.log(`  -${String(component.deducted).padStart(5)}  ${component.category} ${DIM}(${component.label})${RESET}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith('--'));
  const asJson = args.includes('--json');
  if (!target) { console.error('Usage: npm run scan -- <url> [--json]'); process.exit(1); }

  const result = await performPassiveScan(target, { includeSubdomains: true });
  if (asJson) console.log(JSON.stringify(result, null, 2)); else printReport(result);
  process.exit(result.scanResultStatus === 'completed' ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
