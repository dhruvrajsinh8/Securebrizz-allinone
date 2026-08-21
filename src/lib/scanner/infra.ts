/**
 * Findings from transport security (HTTPS/TLS) and DNS-layer records. A
 * certificate whose status is `unknown` produces no finding — "we could not
 * complete the TLS handshake" is not evidence the certificate is bad.
 */

import type { DnsInfo, EmailSecurityInfo, ScanRecommendation, SslCertificate } from '@/types/scanner';
import { makeFinding, REFS } from './findings';

export function transportFindings(args: {
  cert: SslCertificate;
  isHttps: boolean;
  hostname: string;
  finalUrl: string;
  redirectsToHttps: boolean;
}): ScanRecommendation[] {
  const { cert, isHttps, hostname, finalUrl, redirectsToHttps } = args;
  const findings: ScanRecommendation[] = [];

  if (!isHttps) {
    findings.push(makeFinding({
      id: 'rec-no-https', title: 'Site is served over unencrypted HTTP', severity: 'critical', category: 'Transport Security',
      description: `The final response for ${hostname} was delivered over plain HTTP.`,
      impact: 'All traffic is readable and modifiable by anyone on the network path. Session cookies, form submissions and page content are exposed, and an attacker can inject scripts into responses. Browsers mark the site "Not secure".',
      evidence: [{ label: 'Final URL after redirects', value: finalUrl }, { label: 'HTTPS redirect observed', value: redirectsToHttps ? 'yes' : 'no' }],
      remediation: 'Obtain a certificate (Let\'s Encrypt is free and automatable), serve the site over HTTPS, and 301-redirect all HTTP traffic to it. Then enable HSTS.',
      fix: [{ label: 'Nginx — permanent redirect', code: 'server {\n  listen 80;\n  server_name example.com;\n  return 301 https://$host$request_uri;\n}' }, { label: 'Certbot', code: 'sudo certbot --nginx -d example.com -d www.example.com' }],
      references: [REFS.tls], cwe: 'CWE-319', owasp: 'A02:2021 Cryptographic Failures', difficulty: 'medium', timeToFix: '1 hour',
    }));
    return findings;
  }

  if (cert.status === 'unknown' || cert.status === 'not_applicable') return findings;

  if (cert.status === 'expired') {
    findings.push(makeFinding({
      id: 'rec-ssl-expired', title: 'TLS certificate has expired', severity: 'critical', category: 'TLS Certificate',
      description: `The certificate for ${hostname} expired on ${formatDate(cert.validTo)}.`,
      impact: 'Browsers show a full-page interstitial warning before the site loads. Most visitors leave, API clients fail outright, and users who click through are trained to ignore certificate warnings.',
      evidence: [{ label: 'Valid to', value: formatDate(cert.validTo) }, { label: 'Issuer', value: cert.issuer }],
      remediation: 'Renew the certificate now and automate renewal so it cannot lapse again.', fix: [{ label: 'Certbot renewal', code: 'sudo certbot renew --force-renewal\nsudo systemctl reload nginx' }], references: [REFS.tls], cwe: 'CWE-298', timeToFix: '30 mins',
    }));
  } else if (cert.validated === false) {
    const selfSigned = cert.selfSigned === true;
    findings.push(makeFinding({
      id: 'rec-ssl-invalid', title: selfSigned ? 'TLS certificate is self-signed' : 'TLS certificate chain does not validate', severity: 'critical', category: 'TLS Certificate',
      description: cert.validationError ?? 'The certificate could not be validated against the system trust store.',
      impact: 'Browsers refuse the connection with a warning, and because the chain cannot be verified, an intercepting proxy presenting its own certificate is indistinguishable from the real server.',
      evidence: [{ label: 'Validation result', value: cert.validationError ?? 'chain validation failed' }, { label: 'Issuer', value: cert.issuer }, { label: 'Subject', value: cert.subject }],
      remediation: selfSigned ? 'Replace the self-signed certificate with one from a publicly trusted CA.' : 'Serve the full chain including intermediate certificates — a missing intermediate is the most common cause.',
      fix: [{ label: 'Nginx — full chain', code: 'ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;\nssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;' }], references: [REFS.tls], cwe: 'CWE-295', owasp: 'A02:2021 Cryptographic Failures', difficulty: 'medium', timeToFix: '45 mins',
    }));
  } else if (cert.hostnameMatch === false) {
    findings.push(makeFinding({
      id: 'rec-ssl-hostname', title: 'TLS certificate does not cover this hostname', severity: 'critical', category: 'TLS Certificate',
      description: `The certificate presented for ${hostname} lists a different subject.`,
      impact: 'Browsers reject the connection. Beyond the outage, a certificate that does not bind to the hostname provides no assurance that you are talking to the right server.',
      evidence: [{ label: 'Requested hostname', value: hostname }, { label: 'Certificate subject', value: cert.subject }, { label: 'Subject alternative names', value: cert.sans?.join(', ') || 'none presented' }],
      remediation: `Reissue the certificate with ${hostname} in the SAN list.`, references: [REFS.tls], cwe: 'CWE-297', difficulty: 'medium',
    }));
  } else if (cert.status === 'expiring_soon') {
    findings.push(makeFinding({
      id: 'rec-ssl-renew', title: `TLS certificate expires in ${cert.daysRemaining} days`, severity: cert.daysRemaining <= 14 ? 'high' : 'medium', category: 'TLS Certificate',
      description: `The certificate for ${hostname} is valid until ${formatDate(cert.validTo)}.`,
      impact: 'When it lapses the site becomes unreachable behind a browser warning. Expiry outages are common precisely because they are silent until the moment they are total.',
      evidence: [{ label: 'Valid to', value: formatDate(cert.validTo) }, { label: 'Days remaining', value: String(cert.daysRemaining) }],
      remediation: 'Renew now and verify that automated renewal is running.', fix: [{ label: 'Verify auto-renewal', code: 'sudo certbot renew --dry-run' }], references: [REFS.tls], timeToFix: '15 mins',
    }));
  }

  if (cert.protocol && ['TLSv1', 'TLSv1.1', 'SSLv3'].includes(cert.protocol)) {
    findings.push(makeFinding({
      id: 'rec-tls-version', title: `Server negotiates obsolete ${cert.protocol}`, severity: 'high', category: 'TLS Certificate',
      description: `The handshake completed using ${cert.protocol}.`,
      impact: 'TLS 1.0 and 1.1 are deprecated and rejected by current browsers, and are vulnerable to known downgrade and cipher attacks. PCI DSS also prohibits them.',
      evidence: [{ label: 'Negotiated protocol', value: cert.protocol }, { label: 'Negotiated cipher', value: cert.cipher ?? 'unknown' }],
      remediation: 'Restrict the server to TLS 1.2 and 1.3.', fix: [{ label: 'Nginx', code: 'ssl_protocols TLSv1.2 TLSv1.3;\nssl_prefer_server_ciphers off;' }, { label: 'Apache', code: 'SSLProtocol -all +TLSv1.2 +TLSv1.3' }], references: [REFS.tls], cwe: 'CWE-327', difficulty: 'medium', timeToFix: '30 mins',
    }));
  }

  if (cert.keySize > 0 && cert.algorithm.startsWith('RSA') && cert.keySize < 2048) {
    findings.push(makeFinding({
      id: 'rec-tls-weak-key', title: `TLS certificate uses a ${cert.keySize}-bit RSA key`, severity: 'high', category: 'TLS Certificate',
      description: `The certificate public key is ${cert.keySize} bits, below the 2048-bit minimum.`,
      impact: 'Keys below 2048 bits are considered factorable by well-resourced attackers and are rejected by modern CAs and browsers.',
      evidence: [{ label: 'Public key', value: `${cert.algorithm} ${cert.keySize} bits` }], remediation: 'Reissue with a 2048-bit (or larger) RSA key, or an ECDSA P-256 key.', references: [REFS.tls], cwe: 'CWE-326', difficulty: 'medium',
    }));
  }

  return findings;
}

export function dnsFindings(args: { dns: DnsInfo; hostname: string; failures: Record<string, string> }): ScanRecommendation[] {
  const { dns, hostname, failures } = args;
  const findings: ScanRecommendation[] = [];
  const hasMail = dns.mxHosts.length > 0;

  if (!failures['dns.dmarc']) {
    if (!dns.dmarc.present) {
      findings.push(makeFinding({
        id: 'rec-dmarc', title: 'No DMARC record published', severity: hasMail ? 'high' : 'medium', category: 'DNS & Email',
        description: `No v=DMARC1 record exists at _dmarc.${hostname}.`,
        impact: hasMail ? 'Anyone can send email that appears to come from this domain. Without DMARC, receiving servers have no instruction to reject forgeries, which is the mechanic behind invoice fraud and credential-phishing campaigns aimed at your own staff and customers.' : 'The domain sends no mail, but without a DMARC record an attacker can still spoof it convincingly. A reject policy on a non-mailing domain costs nothing.',
        evidence: [{ label: `_dmarc.${hostname} TXT`, value: 'no DMARC record returned' }],
        remediation: 'Publish a DMARC record. Start at p=none with rua reporting to observe legitimate senders, then move to quarantine and reject.',
        fix: [{ label: 'DNS TXT record', code: `Name:  _dmarc.${hostname}\nValue: v=DMARC1; p=reject; rua=mailto:dmarc@${hostname}; pct=100; adkim=s; aspf=s` }], references: [REFS.dmarc], cwe: 'CWE-290', timeToFix: '30 mins',
      }));
    } else if (dns.dmarc.policy === 'none') {
      findings.push(makeFinding({
        id: 'rec-dmarc-policy', title: 'DMARC policy is p=none (monitoring only)', severity: 'medium', category: 'DNS & Email',
        description: 'A DMARC record exists but instructs receivers to take no action on failures.',
        impact: 'Spoofed mail still reaches inboxes. The record satisfies a checklist and produces reports, but delivers no actual protection against domain impersonation.',
        evidence: [{ label: `_dmarc.${hostname}`, value: dns.dmarc.record ?? '' }],
        remediation: 'Review the aggregate reports, confirm all legitimate senders pass SPF/DKIM alignment, then move to p=quarantine and finally p=reject.',
        fix: [{ label: 'DNS TXT record', code: `Name:  _dmarc.${hostname}\nValue: v=DMARC1; p=reject; rua=mailto:dmarc@${hostname}; pct=100` }], references: [REFS.dmarc], timeToFix: '20 mins',
      }));
    } else if (dns.dmarc.issues.length > 0) {
      findings.push(makeFinding({
        id: 'rec-dmarc-weak', title: 'DMARC policy is only partially enforced', severity: 'low', category: 'DNS & Email',
        description: dns.dmarc.issues.join(' '),
        impact: 'Portions of failing mail are still delivered, or failures go unreported, so the gap between the policy on paper and the policy in effect stays invisible.',
        evidence: [{ label: `_dmarc.${hostname}`, value: dns.dmarc.record ?? '' }], remediation: 'Set pct=100, add an rua= reporting address, and apply the same policy to subdomains with sp=.', references: [REFS.dmarc], timeToFix: '15 mins',
      }));
    }
  }

  if (!failures['dns.txt']) {
    if (!dns.spf.present) {
      findings.push(makeFinding({
        id: 'rec-spf', title: 'No SPF record published', severity: hasMail ? 'medium' : 'low', category: 'DNS & Email',
        description: `No v=spf1 TXT record was found for ${hostname}.`,
        impact: 'Receiving servers cannot tell which hosts are permitted to send mail for this domain, so forged mail is more likely to be delivered and legitimate mail is more likely to be filtered.',
        evidence: [{ label: `${hostname} TXT`, value: 'no v=spf1 record returned' }], remediation: 'Publish an SPF record listing every legitimate sender and ending in -all or ~all.',
        fix: [{ label: 'DNS TXT record', code: `Name:  @\nValue: v=spf1 mx include:_spf.google.com -all` }], references: [REFS.spf], cwe: 'CWE-290', timeToFix: '20 mins',
      }));
    } else if (dns.spf.issues.length > 0) {
      const severe = dns.spf.qualifier === 'pass_all' || dns.spf.multipleRecords;
      findings.push(makeFinding({
        id: 'rec-spf-weak', title: dns.spf.multipleRecords ? 'Multiple SPF records break SPF entirely' : 'SPF record does not restrict senders', severity: severe ? 'high' : 'low', category: 'DNS & Email',
        description: dns.spf.issues.join(' '),
        impact: severe ? 'SPF evaluation fails or authorises everyone, so the domain has no send-side protection at all despite appearing configured.' : 'Unauthorised senders are given a soft or neutral result, which most receivers still deliver.',
        evidence: [{ label: `${hostname} TXT`, value: dns.spf.record ?? '' }, { label: 'Terminating qualifier', value: dns.spf.qualifier ?? 'none' }, ...(dns.spf.lookupCount !== undefined ? [{ label: 'DNS lookups required', value: `${dns.spf.lookupCount} of 10 permitted` }] : [])],
        remediation: 'Publish exactly one SPF record, keep it under 10 DNS lookups, and terminate it with -all.', references: [REFS.spf], timeToFix: '20 mins',
      }));
    }
  }

  if (dns.dnssec === 'unsigned') {
    findings.push(makeFinding({
      id: 'rec-dnssec', title: 'DNSSEC is not enabled', severity: 'low', category: 'DNS & Email',
      description: `The zone for ${hostname} is unsigned; a validating resolver returned no authenticated data.`,
      impact: 'DNS answers for this domain cannot be cryptographically verified, so cache-poisoning or a hostile resolver can direct visitors to an attacker-controlled address before TLS is ever negotiated.',
      evidence: [{ label: 'DNSSEC validation (AD flag)', value: 'not set — zone is unsigned' }], remediation: 'Enable DNSSEC signing at your DNS provider and publish the DS record at the registrar.', references: [REFS.dnssec], difficulty: 'medium', timeToFix: '1 hour',
    }));
  }

  if (!failures['dns.caa'] && !dns.caa.present) {
    findings.push(makeFinding({
      id: 'rec-caa', title: 'No CAA record restricts certificate issuance', severity: 'low', category: 'DNS & Email',
      description: `No CAA record is published for ${hostname}.`,
      impact: 'Any public CA may issue a certificate for this domain. A CAA record limits that to the CAs you actually use, closing off mis-issuance as an attack route.',
      evidence: [{ label: `${hostname} CAA`, value: 'no CAA records returned' }], remediation: 'Publish a CAA record naming your CA, plus an iodef address for violation reports.',
      fix: [{ label: 'DNS CAA records', code: `${hostname}. IN CAA 0 issue "letsencrypt.org"\n${hostname}. IN CAA 0 iodef "mailto:security@${hostname}"` }], references: [REFS.caa], timeToFix: '15 mins',
    }));
  }

  return findings;
}

export function buildEmailSecurity(dns: DnsInfo, checked: boolean): EmailSecurityInfo {
  if (!checked) return { dmarcStatus: 'unknown', dmarcPolicy: 'missing', spfStatus: 'unknown', spoofingRisk: 'unknown', details: 'DNS mail-authentication records could not be queried for this target.' };

  const { dmarc, spf } = dns;
  const dmarcStatus: EmailSecurityInfo['dmarcStatus'] = !dmarc.present ? 'missing' : dmarc.policy === 'none' ? 'monitoring_only' : dmarc.policy === 'missing' ? 'missing' : 'enforced';
  const spoofingRisk: EmailSecurityInfo['spoofingRisk'] = !dmarc.present ? 'critical' : dmarc.policy === 'none' ? 'high' : dmarc.policy === 'quarantine' ? 'medium' : spf.present && spf.qualifier === 'fail' ? 'low' : 'medium';
  const details = !dmarc.present ? `No DMARC record at _dmarc.*; SPF is ${spf.present ? 'present' : 'absent'}. The domain can be spoofed.` : `DMARC policy "${dmarc.policy}"${dmarc.percentage !== undefined && dmarc.percentage < 100 ? ` at ${dmarc.percentage}%` : ''} with ${spf.present ? `SPF terminating in ${spf.qualifier}` : 'no SPF record'}.`;

  return { dmarcStatus, dmarcPolicy: dmarc.policy, spfStatus: spf.present ? 'present' : 'missing', spoofingRisk, details };
}

function formatDate(iso: string): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10);
}
