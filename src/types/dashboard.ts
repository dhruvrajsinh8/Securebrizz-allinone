export interface DashboardStats {
  securityScore: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  resolvedIssues: number;
  domainsMonitored: number;
  scansThisMonth: number;
  sslCertificates: { valid: number; expiringSoon: number; expired: number };
}

export interface RiskSlice { name: string; value: number; color: string; }
export interface TrendPoint { label: string; score: number; }

export interface DashboardAnalytics {
  riskDistribution: RiskSlice[];
  scoreTrend: TrendPoint[];
}

export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  time: string;
  severity: string;
}

export const EMPTY_STATS: DashboardStats = {
  securityScore: 0,
  totalVulnerabilities: 0,
  criticalVulnerabilities: 0,
  highVulnerabilities: 0,
  resolvedIssues: 0,
  domainsMonitored: 0,
  scansThisMonth: 0,
  sslCertificates: { valid: 0, expiringSoon: 0, expired: 0 },
};

export const EMPTY_ANALYTICS: DashboardAnalytics = {
  riskDistribution: [],
  scoreTrend: [],
};
