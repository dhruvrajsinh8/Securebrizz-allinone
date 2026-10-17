/**
 * The score is the number people quote and act on, and the report now shows its
 * arithmetic to users. These lock in the two rules that are easy to break
 * silently: severity pricing and the repeat discount.
 */

import { describe, it, expect } from 'vitest';
import { scoreFindings, toGrade, SEVERITY_WEIGHT, REPEAT_FACTORS } from '@/lib/scanner/scoring';
import type { ScanRecommendation, Severity } from '@/types/scanner';

let seq = 0;
function finding(priority: Severity, category = 'Header Security', resolved = false): ScanRecommendation {
  return { id: `f${seq++}`, title: `${priority} finding`, description: '', priority, category, resolved } as ScanRecommendation;
}

describe('scoreFindings', () => {
  it('starts at 100 when there is nothing to report', () => {
    const result = scoreFindings([]);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A+');
  });

  it('charges the documented price for a single finding', () => {
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      const result = scoreFindings([finding(severity)]);
      expect(result.score, severity).toBe(100 - SEVERITY_WEIGHT[severity]);
    }
  });

  it('never charges for info findings', () => {
    expect(scoreFindings([finding('info')]).score).toBe(100);
  });

  it('discounts repeats within one category', () => {
    // 6 + 6*0.6 + 6*0.35 = 11.7, not 18.
    const result = scoreFindings([finding('medium'), finding('medium'), finding('medium')]);
    expect(result.score).toBe(Math.round(100 - 11.7));
    expect(result.breakdown[0].deducted).toBeCloseTo(11.7, 5);
  });

  it('applies the discount per category, not globally', () => {
    const separate = scoreFindings([finding('medium', 'Header Security'), finding('medium', 'Cookie Security')]);
    // Two categories: each pays full price.
    expect(separate.score).toBe(100 - 12);
  });

  it('floors the repeat factor rather than reaching zero', () => {
    const many = Array.from({ length: 8 }, () => finding('low'));
    const result = scoreFindings(many);
    const expected = 2 * (REPEAT_FACTORS[0] + REPEAT_FACTORS[1] + REPEAT_FACTORS[2] + REPEAT_FACTORS[3] * 5);
    expect(result.breakdown[0].deducted).toBeCloseTo(Math.round(expected * 10) / 10, 5);
  });

  it('ignores resolved findings and zeroes their impact', () => {
    const resolved = finding('critical', 'Header Security', true);
    const result = scoreFindings([resolved]);
    expect(result.score).toBe(100);
    expect(resolved.scoreImpact).toBe(0);
  });

  it('clamps at zero instead of going negative', () => {
    const brutal = Array.from({ length: 12 }, (_, i) => finding('critical', `Category ${i}`));
    const result = scoreFindings(brutal);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('reports riskScore as the inverse of the score', () => {
    const result = scoreFindings([finding('high')]);
    expect(result.riskScore).toBe(100 - result.score);
  });

  it('annotates each finding with the points it actually cost', () => {
    const a = finding('high');
    const b = finding('high');
    scoreFindings([a, b]);
    expect(a.scoreImpact).toBe(12);
    expect(b.scoreImpact).toBeCloseTo(7.2, 5); // 12 * 0.6
  });

  it('orders the breakdown by impact', () => {
    const result = scoreFindings([finding('low', 'Cookies'), finding('critical', 'Headers')]);
    expect(result.breakdown[0].category).toBe('Headers');
  });
});

describe('toGrade', () => {
  it('maps the documented bands', () => {
    expect(toGrade(100)).toBe('A+');
    expect(toGrade(95)).toBe('A+');
    expect(toGrade(94)).toBe('A');
    expect(toGrade(85)).toBe('A');
    expect(toGrade(84)).toBe('B');
    expect(toGrade(75)).toBe('B');
    expect(toGrade(74)).toBe('C');
    expect(toGrade(65)).toBe('C');
    expect(toGrade(64)).toBe('D');
    expect(toGrade(50)).toBe('D');
    expect(toGrade(49)).toBe('F');
    expect(toGrade(0)).toBe('F');
  });
});
