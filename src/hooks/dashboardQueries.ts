'use client';

/**
 * Data access for the dashboard tabs.
 *
 * These endpoints were each fetched by hand with useState + useEffect, which
 * meant every tab switch refetched from scratch behind a spinner and the same
 * endpoint could be in flight twice at once. React Query was already installed
 * and mounted but unused; routing the reads through it gives caching between
 * tab switches, request de-duplication, and retained data while refetching.
 *
 * The app signals "something changed" with window events rather than mutations,
 * so `useDashboardRefreshBridge` translates those into cache invalidation.
 */

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardStats, DashboardAnalytics, ActivityItem } from '@/types/dashboard';
import type { Vulnerability } from '@/types/vulnerability';
import type { Notification } from '@/types/common';

export const QUERY_KEYS = {
  attackSurface: ['attack-surface'] as const,
  vulnerabilities: ['vulnerabilities'] as const,
  dashboardStats: ['dashboard-stats'] as const,
  notifications: ['notifications'] as const,
};

/** Every dashboard endpoint answers `{ success, data }` — unwrap it in one place. */
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const json = await res.json();
  if (!json?.success) throw new Error(json?.error ?? 'Request failed.');
  return json.data as T;
}

export interface Exposure {
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface TargetSurface {
  host: string; url: string; lastScanAt: string; score: number; grade: string | null;
  httpsEnabled: boolean; httpStatus: number | null;
  addresses: string[]; nameservers: string[]; mxHosts: string[]; dnssec: string; caa: string[];
  technologies: { name: string; version?: string; isOutdated: boolean; category: string }[];
  ports: { number: number; service: string; risk: string }[];
  disclosedPaths: string[]; thirdPartyOrigins: string[]; exposures: Exposure[];
}

export interface AttackSurfaceSummary {
  targets: number; withoutHttps: number; outdatedComponents: number;
  thirdPartyOrigins: number; unsignedDns: number; totalExposures: number;
}

export interface DashboardStatsPayload {
  stats: DashboardStats;
  analyticsData: DashboardAnalytics;
  recentActivity: ActivityItem[];
}

export function useAttackSurface() {
  return useQuery({
    queryKey: QUERY_KEYS.attackSurface,
    queryFn: () => getJson<{ targets: TargetSurface[]; summary: AttackSurfaceSummary }>('/api/attack-surface'),
  });
}

export interface VulnerabilityQuery {
  search?: string;
  severities?: string[];
  statuses?: string[];
  limit?: number;
}

export interface VulnerabilityPage {
  items: Vulnerability[];
  total: number;
  hasMore: boolean;
}

/**
 * Filtering and paging happen in Postgres. Doing it in the browser meant
 * downloading every finding an account had ever collected in order to show a
 * screenful, and rendering all of them into the DOM.
 */
export function useVulnerabilities(params: VulnerabilityQuery = {}) {
  const { search = '', severities = [], statuses = [], limit = 100 } = params;

  return useQuery({
    // Sorted so an equivalent filter set reuses the same cache entry.
    queryKey: [...QUERY_KEYS.vulnerabilities, search, [...severities].sort(), [...statuses].sort(), limit],
    queryFn: async (): Promise<VulnerabilityPage> => {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (severities.length) query.set('severity', severities.join(','));
      if (statuses.length) query.set('status', statuses.join(','));
      query.set('limit', String(limit));

      const res = await fetch(`/api/vulnerabilities?${query.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Request failed.');
      return { items: json.data as Vulnerability[], total: json.total ?? json.data.length, hasMore: Boolean(json.hasMore) };
    },
    placeholderData: (previous) => previous, // keep the table visible while refiltering
  });
}

/** Debounce so typing in the search box does not fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardStats,
    queryFn: () => getJson<DashboardStatsPayload>('/api/dashboard/stats'),
  });
}

/**
 * Mount once, high in the tree. A finished scan or an edited vulnerability
 * dispatches a window event; every affected query is then marked stale so any
 * mounted tab refetches and the rest refresh when next shown.
 */
export function useNotifications() {
  return useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: () => getJson<Notification[]>('/api/notifications'),
  });
}

export function useDashboardRefreshBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = (keys: readonly (readonly string[])[]) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    const onScan = () => invalidate([QUERY_KEYS.attackSurface, QUERY_KEYS.vulnerabilities, QUERY_KEYS.dashboardStats]);
    const onVulnerability = () => invalidate([QUERY_KEYS.vulnerabilities, QUERY_KEYS.dashboardStats]);

    window.addEventListener('scanner_updated', onScan);
    window.addEventListener('vulnerabilities_updated', onVulnerability);
    return () => {
      window.removeEventListener('scanner_updated', onScan);
      window.removeEventListener('vulnerabilities_updated', onVulnerability);
    };
  }, [queryClient]);
}
