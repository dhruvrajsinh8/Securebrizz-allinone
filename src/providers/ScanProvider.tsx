'use client';

/**
 * Shared scan state, reachable from both the Overview page and the Scanner tab,
 * so a scan started on the front page and continued elsewhere keeps the same run.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ScanResult } from '@/types/scanner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

const PASSIVE_STAGES = [
  'Validating target and resolving DNS',
  'Requesting the page and following redirects',
  'Inspecting the TLS certificate chain',
  'Reading DNS records: DNSSEC, CAA, SPF, DMARC',
  'Evaluating security headers and cookie attributes',
  'Analysing page content, subresources and libraries',
  'Scoring findings',
] as const;

const ACTIVE_STAGES = [
  'Validating target and resolving DNS',
  'Probing TLS, headers and DNS configurations',
  'Auditing top exposed TCP ports (Databases, Remote Access, Web)',
  'Correlating technology fingerprints against OSV.dev CVE database',
  'Analysing page content, subresources and libraries',
  'Evaluating threat vectors and scoring findings',
] as const;

interface ScanContextValue {
  result: ScanResult | null;
  history: ScanHistoryEntry[];
  phase: ScanPhase;
  error: string | null;
  target: string;
  progress: number;
  stage: string;
  scanMode: 'passive' | 'active';
  hasHostPermission: boolean;
  setTarget: (value: string) => void;
  setScanMode: (mode: 'passive' | 'active') => void;
  setHasHostPermission: (val: boolean) => void;
  runScan: (url?: string) => Promise<void>;
  toggleResolved: (findingId: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const SCAN_KEYS = {
  latest: ['scan', 'latest'] as const,
  history: ['scan', 'history'] as const,
};

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();

  // The last scan and the history list are server state, so they are read
  // through the query cache rather than copied into state by an effect. Phase
  // and target are then *derived* from that read; only a scan the user starts
  // here overrides them, which keeps logout and account switching correct
  // without a reset effect.
  const latestQuery = useQuery({
    queryKey: SCAN_KEYS.latest,
    enabled: isAuthenticated,
    queryFn: async (): Promise<ScanResult | null> => {
      const res = await fetch('/api/scan');
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Could not load the last scan.');
      return (json.data ?? null) as ScanResult | null;
    },
  });

  const historyQuery = useQuery({
    queryKey: SCAN_KEYS.history,
    enabled: isAuthenticated,
    queryFn: async (): Promise<ScanHistoryEntry[]> => {
      const res = await fetch('/api/scan/history?limit=12');
      const json = await res.json();
      return json?.success && Array.isArray(json.data) ? (json.data as ScanHistoryEntry[]) : [];
    },
  });

  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [phaseOverride, setPhase] = useState<ScanPhase | null>(null);
  const [targetOverride, setTarget] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'passive' | 'active'>('passive');
  const [hasHostPermission, setHasHostPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const result = currentScan ?? (isAuthenticated ? latestQuery.data ?? null : null);
  const history = useMemo(
    () => (isAuthenticated ? historyQuery.data ?? [] : []),
    [isAuthenticated, historyQuery.data],
  );

  const phase: ScanPhase = !isAuthenticated
    ? 'idle'
    : phaseOverride ?? (latestQuery.isPending && !currentScan ? 'loading' : result ? 'completed' : 'idle');

  // Until the user types, the box shows whatever was scanned last.
  const target = targetOverride ?? (result ? result.finalUrl ?? result.url ?? '' : '');

  const setResult = useCallback(
    (next: ScanResult | null) => {
      setCurrentScan(next);
      queryClient.setQueryData(SCAN_KEYS.latest, next);
    },
    [queryClient],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const refreshHistory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SCAN_KEYS.history });
  }, [queryClient]);

  useEffect(() => stopTimer, [stopTimer]);

  const runScan = useCallback(
    async (url?: string) => {
      const requested = (url ?? target).trim();
      if (!requested) { setError('Enter a target URL first.'); return; }

      if (scanMode === 'active' && !hasHostPermission) {
        setError('Active deep scan requires confirmation that you own or have permission to audit this target.');
        return;
      }

      const stages = scanMode === 'active' ? ACTIVE_STAGES : PASSIVE_STAGES;
      const expectedDuration = scanMode === 'active' ? 7000 : 4000;

      setTarget(requested);
      setPhase('scanning');
      setError(null);
      setProgress(4);
      setStage(stages[0]);

      const startedAt = Date.now();
      stopTimer();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(90, Math.round((elapsed / expectedDuration) * 90));
        setProgress(Math.max(4, pct));
        setStage(stages[Math.min(stages.length - 1, Math.floor((pct / 90) * stages.length))]);
      }, 120);

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: requested,
            scanMode,
            confirmedAuthorization: scanMode === 'active' ? hasHostPermission : undefined,
          }),
        });
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
    [refreshHistory, stopTimer, target, logout, setResult, scanMode, hasHostPermission]
  );

  const toggleResolved = useCallback(async (findingId: string) => {
    try {
      const res = await fetch(`/api/scan/recommendations/${findingId}`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) { setResult(json.data); window.dispatchEvent(new Event('scanner_updated')); }
    } catch { /* keep current state */ }
  }, [setResult]);

  const value = useMemo<ScanContextValue>(
    () => ({
      result,
      history,
      phase,
      error,
      target,
      progress,
      stage,
      scanMode,
      hasHostPermission,
      setTarget,
      setScanMode,
      setHasHostPermission,
      runScan,
      toggleResolved,
      refreshHistory,
    }),
    [result, history, phase, error, target, progress, stage, scanMode, hasHostPermission, setScanMode, setHasHostPermission, runScan, toggleResolved, refreshHistory]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanContextValue {
  const context = useContext(ScanContext);
  if (!context) throw new Error('useScan must be used inside a ScanProvider');
  return context;
}
