/**
 * Finding construction. A finding carries evidence, impact, a copy-pasteable
 * fix and a reference; a finding without evidence is an opinion.
 */

import type {
  Confidence,
  Evidence,
  FixSnippet,
  Reference,
  ScanRecommendation,
  Severity,
} from '@/types/scanner';

export interface FindingInput {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  impact: string;
  evidence: Evidence[];
  remediation: string;
  fix?: FixSnippet[];
  references?: Reference[];
  cwe?: string;
  owasp?: string;
  confidence?: Confidence;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeToFix?: string;
}

export function makeFinding(input: FindingInput): ScanRecommendation {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    priority: input.severity,
    estimatedImpact: input.impact,
    difficulty: input.difficulty ?? 'easy',
    timeToFix: input.timeToFix ?? '15 mins',
    resolved: false,
    category: input.category,
    confidence: input.confidence ?? 'confirmed',
    evidence: input.evidence,
    impact: input.impact,
    remediation: input.remediation,
    fix: input.fix,
    references: input.references,
    cwe: input.cwe,
    owasp: input.owasp,
  };
}

export const REFS = {
  hsts: { label: 'MDN — Strict-Transport-Security', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security' },
  csp: { label: 'MDN — Content-Security-Policy', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy' },
  cspCheatSheet: { label: 'OWASP — CSP Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html' },
  clickjacking: { label: 'OWASP — Clickjacking Defence Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html' },
  nosniff: { label: 'MDN — X-Content-Type-Options', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options' },
  referrerPolicy: { label: 'MDN — Referrer-Policy', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy' },
  permissionsPolicy: { label: 'MDN — Permissions-Policy', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy' },
  cors: { label: 'MDN — CORS', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS' },
  cookies: { label: 'OWASP — Session Management Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html' },
  sameSite: { label: 'MDN — SameSite cookies', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite' },
  sri: { label: 'MDN — Subresource Integrity', url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity' },
  mixedContent: { label: 'MDN — Mixed content', url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content' },
  dmarc: { label: 'RFC 7489 — DMARC', url: 'https://datatracker.ietf.org/doc/html/rfc7489' },
  spf: { label: 'RFC 7208 — SPF', url: 'https://datatracker.ietf.org/doc/html/rfc7208' },
  caa: { label: 'RFC 8659 — CAA records', url: 'https://datatracker.ietf.org/doc/html/rfc8659' },
  dnssec: { label: 'ICANN — DNSSEC', url: 'https://www.icann.org/resources/pages/dnssec-what-is-it-why-important-2019-03-05-en' },
  securityTxt: { label: 'RFC 9116 — security.txt', url: 'https://datatracker.ietf.org/doc/html/rfc9116' },
  tls: { label: 'Mozilla — Server Side TLS', url: 'https://wiki.mozilla.org/Security/Server_Side_TLS' },
  xssProtection: { label: 'MDN — X-XSS-Protection (deprecated)', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection' },
  directoryListing: { label: 'OWASP — Directory listing', url: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information' },
} as const satisfies Record<string, Reference>;

/** Header fix snippets across the stacks a developer is most likely to run. */
export function headerFix(headerName: string, headerValue: string): FixSnippet[] {
  return [
    {
      label: 'Next.js (next.config.ts)',
      code: `async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: '${headerName}', value: '${headerValue}' },
      ],
    },
  ];
}`,
    },
    { label: 'Nginx', code: `add_header ${headerName} "${headerValue}" always;` },
    { label: 'Apache', code: `Header always set ${headerName} "${headerValue}"` },
    {
      label: 'Express',
      code: `app.use((req, res, next) => {
  res.setHeader('${headerName}', '${headerValue}');
  next();
});`,
    },
  ];
}
