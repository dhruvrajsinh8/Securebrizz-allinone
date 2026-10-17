/**
 * Every structured field is stored as serialized JSON, so a field added to
 * ScanResult but forgotten in this mapping is silently dropped on reload. That
 * exact bug hid the phishing verdict: it was computed, shown once, then
 * vanished when the report was read back.
 */

import { describe, it, expect } from 'vitest';
import { toScanRow, fromScanRow } from '@/lib/scanner/persistence';
import type { ScanResult } from '@/types/scanner';

const scan = {
  url: 'https://example.com',
  scanDate: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  duration: 1,
  overallScore: 87,
  riskScore: 13,
  grade: 'A',
  dnsSecEnabled: true,
  httpsEnabled: true,
  hasRobotsTxt: true,
  hasSecurityTxt: false,
  mixedContent: false,
  weakPasswordPolicy: false,
  directoryListing: false,
  aiSummary: 'summary',
  ssl: { status: 'valid', grade: 'A' },
  securityHeaders: [{ name: 'CSP', status: 'present' }],
  openPorts: [],
  technologies: [{ name: 'Next.js' }],
  cookieAnalysis: { httpOnly: 1, secure: 1, sameSite: 1, total: 1 },
  outdatedLibraries: [],
  adminPagesExposed: [],
  subdomains: ['a.example.com'],
  recommendations: [{ id: 'f1', resolved: false }],
  checks: [{ id: 'tls', status: 'ok' }],
  scoreBreakdown: [{ category: 'Header Security', deducted: 13 }],
  redirectChain: ['https://example.com'],
  phishing: {
    verdict: 'looks_original',
    riskScore: 0,
    headline: 'The address matches the real domain.',
    signals: [{ label: 'ok', detail: 'no spoofing pattern', risk: 'good' }],
    evidence: [],
    disclaimer: 'heuristic only',
  },
} as unknown as ScanResult;

describe('scan persistence round-trip', () => {
  const restored = fromScanRow({ ...toScanRow(scan), scanDate: new Date(scan.scanDate) });

  it('preserves the phishing assessment', () => {
    // The regression that shipped once already.
    expect(restored.phishing).toBeDefined();
    expect(restored.phishing?.verdict).toBe('looks_original');
    expect(restored.phishing?.signals).toHaveLength(1);
  });

  it('preserves the score breakdown the report renders', () => {
    expect(restored.scoreBreakdown).toEqual(scan.scoreBreakdown);
  });

  it('preserves findings, headers and checks', () => {
    expect(restored.recommendations).toEqual(scan.recommendations);
    expect(restored.securityHeaders).toEqual(scan.securityHeaders);
    expect(restored.checks).toEqual(scan.checks);
  });

  it('preserves scalars and subdomains', () => {
    expect(restored.overallScore).toBe(87);
    expect(restored.grade).toBe('A');
    expect(restored.subdomains).toEqual(['a.example.com']);
  });

  it('normalises scanDate back to an ISO string', () => {
    expect(restored.scanDate).toBe(scan.scanDate);
  });

  it('omits phishing when the scan never produced one', () => {
    const withoutPhishing = { ...scan, phishing: undefined } as ScanResult;
    const back = fromScanRow({ ...toScanRow(withoutPhishing), scanDate: new Date(scan.scanDate) });
    expect(back.phishing).toBeUndefined();
  });

  it('survives corrupt JSON in a column instead of throwing', () => {
    const corrupted = { ...toScanRow(scan), phishing: '{not json', scanDate: new Date(scan.scanDate) };
    expect(() => fromScanRow(corrupted)).not.toThrow();
    expect(fromScanRow(corrupted).phishing).toBeUndefined();
  });
});
