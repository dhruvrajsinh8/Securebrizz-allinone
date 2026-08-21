export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';

/** Severity of a finding. Ordered: critical > high > medium > low > info. */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * How sure the scanner is about a finding.
 * - confirmed: directly observed in a response (header value, cert field, DNS record)
 * - likely:    inferred from strong but indirect evidence (fingerprints, heuristics)
 * - unknown:   the underlying check could not run; never scored, never a finding
 */
export type Confidence = 'confirmed' | 'likely' | 'unknown';

/** Outcome of an individual scanner check, so failures are visible instead of silent. */
export type CheckStatus = 'ok' | 'failed' | 'skipped';

export interface Evidence {
  /** What was inspected, e.g. "Strict-Transport-Security". */
  label: string;
  /** What was actually observed, verbatim where possible. */
  value: string;
}

export interface Reference {
  label: string;
  url: string;
}

export interface FixSnippet {
  /** Platform this snippet targets, e.g. "Nginx", "Next.js". */
  label: string;
  code: string;
}

/**
 * Per-check diagnostic. A check that failed (timeout, blocked, no permission)
 * is reported as `failed` and is never converted into a finding or a score
 * penalty — "we could not check" must never render as "you are secure" or as
 * "you are vulnerable".
 */
export interface CheckDiagnostic {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  durationMs?: number;
}

export interface SslCertificate {
  status: 'valid' | 'expired' | 'expiring_soon' | 'invalid' | 'not_applicable' | 'unknown';
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  algorithm: string;
  keySize: number;
  chain: string[];
  fingerprint: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';

  // --- extended, all optional so older persisted scans still parse ---
  validated?: boolean;
  validationError?: string;
  hostnameMatch?: boolean;
  protocol?: string;
  cipher?: string;
  sans?: string[];
  selfSigned?: boolean;
  serialNumber?: string;
}

export interface SecurityHeader {
  name: string;
  status: 'present' | 'missing' | 'misconfigured' | 'unknown';
  value?: string;
  recommendation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  issue?: string;
}

export interface Port {
  number: number;
  service: string;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  version?: string;
  risk: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  evidence?: string;
}

export interface Technology {
  name: string;
  version?: string;
  category: string;
  isOutdated: boolean;
  cveCount?: number;
  confidence?: Confidence;
  evidence?: string;
  latestKnown?: string;
  advisory?: string;
}

export interface SpfInfo {
  present: boolean;
  record?: string;
  qualifier?: 'fail' | 'softfail' | 'neutral' | 'pass_all' | 'none';
  multipleRecords: boolean;
  lookupCount?: number;
  issues: string[];
}

export interface DmarcInfo {
  present: boolean;
  record?: string;
  policy: 'reject' | 'quarantine' | 'none' | 'missing';
  subdomainPolicy?: 'reject' | 'quarantine' | 'none';
  percentage?: number;
  reportingEnabled: boolean;
  issues: string[];
}

export interface CaaInfo {
  present: boolean;
  records: string[];
}

export interface DnsInfo {
  ipv4: string[];
  ipv6: string[];
  nameservers: string[];
  mxHosts: string[];
  dnssec: 'validated' | 'unsigned' | 'unknown';
  caa: CaaInfo;
  spf: SpfInfo;
  dmarc: DmarcInfo;
}

export interface EmailSecurityInfo {
  dmarcStatus: 'enforced' | 'monitoring_only' | 'missing' | 'unknown';
  dmarcPolicy: 'reject' | 'quarantine' | 'none' | 'missing';
  spfStatus: 'present' | 'missing' | 'unknown';
  spoofingRisk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  details: string;
}

export interface SubresourceIntegrityInfo {
  totalExternalScripts: number;
  missingSriCount: number;
  unprotectedScriptUrls: string[];
  riskGrade: 'safe' | 'warning' | 'high_risk';
  totalExternalStyles?: number;
  missingStyleSriCount?: number;
  unprotectedStyleUrls?: string[];
  sriMissingCrossorigin?: string[];
}

export interface MixedContentItem {
  url: string;
  kind: 'active' | 'passive';
  element: string;
}

export interface ContentAnalysis {
  mixedContentItems: MixedContentItem[];
  insecureForms: string[];
  passwordFieldCount: number;
  passwordFieldsWithoutAutocomplete: number;
  directoryListing: boolean;
  generator?: string;
  disclosedPaths: string[];
  htmlBytes: number;
}

export interface ScoreComponent {
  category: string;
  label: string;
  deducted: number;
}

export interface ScanResult {
  id: string;
  url: string;
  scanDate: string;
  duration: number;
  durationMs?: number;
  overallScore: number;
  ssl: SslCertificate;
  securityHeaders: SecurityHeader[];
  openPorts: Port[];
  technologies: Technology[];
  cms?: string;
  dnsSecEnabled: boolean;
  httpsEnabled: boolean;
  hasRobotsTxt: boolean;
  hasSecurityTxt: boolean;
  cookieAnalysis: {
    httpOnly: number;
    secure: number;
    sameSite: number;
    total: number;
    issues?: string[];
  };
  mixedContent: boolean;
  outdatedLibraries: string[];
  weakPasswordPolicy: boolean;
  adminPagesExposed: string[];
  directoryListing: boolean;
  serverInfo?: string;
  aiSummary: string;
  riskScore: number;
  scanResultStatus?: 'completed' | 'invalid_domain' | 'unreachable' | 'blocked';
  errorMessage?: string;
  subdomains?: string[];
  recommendations: ScanRecommendation[];
  emailSecurity?: EmailSecurityInfo;
  subresourceIntegrity?: SubresourceIntegrityInfo;

  grade?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  checks?: CheckDiagnostic[];
  dns?: DnsInfo;
  content?: ContentAnalysis;
  finalUrl?: string;
  redirectChain?: string[];
  httpStatus?: number;
  scoreBreakdown?: ScoreComponent[];
}

export interface ScanRecommendation {
  id: string;
  title: string;
  description: string;
  priority: Severity;
  estimatedImpact: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeToFix: string;
  resolved: boolean;
  category: string;

  confidence?: Confidence;
  evidence?: Evidence[];
  impact?: string;
  remediation?: string;
  fix?: FixSnippet[];
  references?: Reference[];
  cwe?: string;
  owasp?: string;
  scoreImpact?: number;
}
