'use client';

/**
 * Shared scan state, reachable from both the Overview page and the Scanner tab,
 * so a scan started on the front page and continued elsewhere keeps the same run.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ScanResult } from '@/types/scanner';
import { useAuth } from './AuthProvider';

export interface ScanHistoryEntry {
  id: string;
  url: string;
  scanDate: string;
  overallScore: number;
  riskScore: number;
  grade?: string | null;
  httpsEnabled: boolean;
  durationMs?: number | null;
  findingCount: number;
  criticalCount: number;
}

export type ScanPhase = 'idle' | 'loading' | 'scanning' | 'completed' | 'error';

const STAGES = [
  'Validating target and resolving DNS',
  'Requesting the page and following redirects',
  'Inspecting the TLS certificate chain',
  'Reading DNS records: DNSSEC, CAA, SPF, DMARC',
  'Evaluating security headers and cookie attributes',
  'Analysing page content, subresources and libraries',
  'Scoring findings',
] as const;

interface ScanContextValue {
  result: ScanResult | null;
  history: ScanHistoryEntry[];
  phase: ScanPhase;
  error: string | null;
  target: string;
  progress: number;
  stage: string;
  setTarget: (value: string) => void;
  runScan: (url?: string) => Promise<void>;
  toggleResolved: (findingId: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [phase, setPhase] = useState<ScanPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/history?limit=12');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) setHistory(json.data);
    } catch { /* supplementary */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setResult(null); setHistory([]); setPhase('idle'); return; }
    let cancelled = false;
    setPhase('loading');
    (async () => {
      try {
        const res = await fetch('/api/scan');
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data) { setResult(json.data); setTarget(json.data.finalUrl ?? json.data.url ?? ''); setPhase('completed'); }
        else setPhase('idle');
      } catch { if (!cancelled) setPhase('idle'); }
      if (!cancelled) void refreshHistory();
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, refreshHistory]);

  useEffect(() => stopTimer, [stopTimer]);

  const runScan = useCallback(
    async (url?: string) => {
      const requested = (url ?? target).trim();
      if (!requested) { setError('Enter a target URL first.'); return; }

      setTarget(requested);
      setPhase('scanning');
      setError(null);
      setProgress(4);
      setStage(STAGES[0]);

      const startedAt = Date.now();
      stopTimer();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(90, Math.round((elapsed / 4000) * 90));
        setProgress(Math.max(4, pct));
        setStage(STAGES[Math.min(STAGES.length - 1, Math.floor((pct / 90) * STAGES.length))]);
      }, 120);

      try {
        const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: requested }) });
        stopTimer();

        if (res.status === 401) {
          setPhase('idle'); setProgress(0); setError('Your session expired. Please sign in again.'); logout(); return;
        }

        const json = await res.json();
        if (!json.success) { setError(json.error ?? 'Scan failed.'); setPhase('error'); setProgress(0); return; }

        setProgress(100);
        setStage('Complete');
        setResult(json.data);
        setPhase('completed');
        void refreshHistory();
        window.dispatchEvent(new Event('scanner_updated'));
      } catch (err) {
        stopTimer();
        const message = err instanceof TypeError
          ? 'Could not reach the server. It may be restarting — wait a moment and try again.'
          : err instanceof Error ? err.message : 'Scan request failed.';
        setError(message); setPhase('error'); setProgress(0);
      }
    },
    [refreshHistory, stopTimer, target, logout]
  );

  const toggleResolved = useCallback(async (findingId: string) => {
    try {
      const res = await fetch(`/api/scan/recommendations/${findingId}`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) { setResult(json.data); window.dispatchEvent(new Event('scanner_updated')); }
    } catch { /* keep current state */ }
  }, []);

  const value = useMemo<ScanContextValue>(
    () => ({ result, history, phase, error, target, progress, stage, setTarget, runScan, toggleResolved, refreshHistory }),
    [result, history, phase, error, target, progress, stage, runScan, toggleResolved, refreshHistory]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanContextValue {
  const context = useContext(ScanContext);
  if (!context) throw new Error('useScan must be used inside a ScanProvider');
  return context;
}
