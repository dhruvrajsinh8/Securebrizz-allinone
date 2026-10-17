'use client';

/**
 * About the project and the team. The scope section is deliberately explicit
 * about what the scanner does NOT do — for a security tool that is what makes
 * the findings inside its boundary trustworthy.
 */

import React from 'react';
import { Check, Shield, X } from 'lucide-react';
import { VULN_DB_AS_OF } from '@/lib/scanner/fingerprint';

// ── EDIT YOUR TEAM HERE — replace each name with the real one ────────────────
const TEAM: { name: string; role: string; focus: string; contributions: string[] }[] = [
  {
    name: 'Team member 1',
    role: 'Security Analyst & Researcher',
    focus: 'Detection logic and vulnerability research',
    contributions: [
      'Defined the check catalogue: headers, TLS, cookies, DNS and content',
      'Wrote the severity model and the evidence requirements for each finding',
      'Researched CWE/OWASP mappings and the vulnerable-library dataset',
      'Validated findings against real targets to eliminate false positives',
    ],
  },
  {
    name: 'Team member 2',
    role: 'Backend Engineer',
    focus: 'Scanner engine, API and data layer',
    contributions: [
      'Built the passive scanning engine and its per-check diagnostics',
      'Implemented authentication: scrypt password hashing and signed sessions',
      'Designed the Postgres schema, migrations and finding-lifecycle tracking',
      'Added the SSRF guard and database-backed rate limiting',
    ],
  },
  {
    name: 'Team member 3',
    role: 'UI/UX Designer & Frontend Engineer',
    focus: 'Interface, design system and reporting',
    contributions: [
      'Designed the interface and the single-meaning colour system',
      'Built the scan report: findings, evidence, remediation and raw observations',
      'Created the printable security report',
      'Made the dashboard readable at a glance without hiding detail',
    ],
  },
  {
    name: 'Team member 4',
    role: 'QA & Test Engineer',
    focus: 'Verification and accuracy testing',
    contributions: [
      'Built the authentication test suite covering forgery and expiry cases',
      'Verified scanner output against targets with known configurations',
      'Tested the finding lifecycle: dedup, re-scan, auto-resolve',
      'Confirmed failed checks never surface as findings or affect the score',
    ],
  },
];

const DOES = [
  'Requests pages the way a browser does, and follows redirects',
  'Validates the TLS certificate chain, hostname and protocol version',
  'Reads public DNS records: A, MX, NS, CAA, SPF, DMARC, DNSSEC',
  'Parses security headers by value, not merely presence',
  'Parses Set-Cookie attributes for HttpOnly, Secure and SameSite',
  'Analyses returned HTML for mixed content, SRI and form hygiene',
  'Reads public Certificate Transparency logs for subdomains',
];

const DOES_NOT = [
  'Send exploit payloads, injections or any attack traffic',
  'Scan ports, fuzz endpoints or brute-force credentials',
  'Log in, or test anything behind authentication',
  'Observe attacks against the target — that needs access to its own logs',
  'Detect vulnerabilities in server-side code it cannot see',
  'Replace a manual penetration test or a code audit',
];

export default function AboutTab() {
  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-base font-semibold text-[#2a2013]">About SecureBiz</h1>
        <p className="text-xs text-[#937d57] mt-0.5">A passive web security scanner, and the team that built it.</p>
      </div>

      <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-[#7f9548]/10 border border-[#7f9548]/25 flex items-center justify-center shrink-0"><Shield className="h-4 w-4 text-[#47601f]" /></div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-[#2a2013]">What this project does</h2>
            <p className="text-xs text-[#6b572f] leading-relaxed">SecureBiz assesses the security posture of a website from the outside, using only what any ordinary visitor can observe: the pages it serves, the certificate it presents, and the DNS records it publishes. It produces findings with the evidence that produced them, the consequence of leaving them, and the exact configuration change that fixes them.</p>
            <p className="text-xs text-[#6b572f] leading-relaxed">Every result is measured. When a check cannot complete, it is reported as failed rather than converted into a finding or a score penalty — because “we could not check” is a different statement from “you are secure”, and conflating the two is how scanners mislead the people relying on them.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#47601f] uppercase tracking-wider mb-3">What it checks</h3>
          <ul className="space-y-2">{DOES.map((item) => <li key={item} className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-[#47601f] shrink-0 mt-0.5" /><span className="text-sm text-[#6b572f] leading-relaxed">{item}</span></li>)}</ul>
        </div>
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#8a3122] uppercase tracking-wider mb-3">What it does not do</h3>
          <ul className="space-y-2">{DOES_NOT.map((item) => <li key={item} className="flex items-start gap-2"><X className="h-3.5 w-3.5 text-[#8a3122] shrink-0 mt-0.5" /><span className="text-sm text-[#6b572f] leading-relaxed">{item}</span></li>)}</ul>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[#2a2013] mb-3">The team</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TEAM.map((member) => (
            <div key={member.role} className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-4 hover:border-[#cbae72] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#efe1c4] border border-[#e3d2a9] flex items-center justify-center text-xs font-bold text-[#47601f] shrink-0 uppercase">{member.name.charAt(0)}</div>
                <div className="min-w-0"><p className="text-sm font-semibold text-[#2a2013] truncate">{member.name}</p><p className="text-sm text-[#47601f]">{member.role}</p></div>
              </div>
              <p className="text-sm text-[#937d57] mt-2.5 mb-2">{member.focus}</p>
              <ul className="space-y-1">{member.contributions.map((item) => <li key={item} className="flex items-start gap-1.5"><span className="text-[#a6906a] mt-1.5 h-1 w-1 rounded-full bg-[#a6906a] shrink-0" /><span className="text-sm text-[#6b572f] leading-relaxed">{item}</span></li>)}</ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#2a2013] uppercase tracking-wider mb-2">Known limitations</h3>
        <ul className="space-y-1.5 text-sm text-[#6b572f] leading-relaxed">
          <li>• Library vulnerability data comes from a bundled table current as of <span className="font-mono text-[#4a3b1f]">{VULN_DB_AS_OF}</span>, not a live CVE feed. A newly published advisory will not be detected.</li>
          <li>• Only the page at the scanned URL is analysed. Headers frequently differ on other routes, so a clean homepage does not guarantee a clean login page.</li>
          <li>• Scores are comparative, not absolute. A grade A means no issues were found by these checks — not that the site is secure.</li>
          <li>• Subdomain discovery depends on Certificate Transparency logs, so hosts that never had a public certificate will not appear.</li>
        </ul>
      </div>
    </div>
  );
}
