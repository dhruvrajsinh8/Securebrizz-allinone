/**
 * Phishing / brand-spoofing assessment.
 *
 * Answers the question a non-technical visitor actually has: "is this the real
 * site, or something pretending to be it?" Everything here is derived from the
 * domain name itself, the certificate, and the page content already fetched by
 * the passive scan — no external lookup APIs, so it works offline and never
 * blocks the rest of the scan.
 *
 * This is a heuristic signal, not a verdict of fact. It over-explains its
 * reasoning on purpose so a non-technical reader can judge it rather than
 * blindly trust it.
 */

import type { Evidence, PhishingAssessment, PhishingSignal, SslCertificate } from '@/types/scanner';

/** Brands most commonly impersonated in phishing, mapped to their real domain(s). */
const KNOWN_BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com'],
  google: ['google.com', 'accounts.google.com', 'gmail.com'],
  microsoft: ['microsoft.com', 'live.com', 'outlook.com', 'office.com'],
  apple: ['apple.com', 'icloud.com'],
  amazon: ['amazon.com'],
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
  netflix: ['netflix.com'],
  chase: ['chase.com'],
  wellsfargo: ['wellsfargo.com'],
  bankofamerica: ['bankofamerica.com'],
  coinbase: ['coinbase.com'],
  binance: ['binance.com'],
  dropbox: ['dropbox.com'],
  linkedin: ['linkedin.com'],
  whatsapp: ['whatsapp.com'],
  adobe: ['adobe.com'],
  ebay: ['ebay.com'],
  steam: ['steampowered.com', 'steamcommunity.com'],
  americanexpress: ['americanexpress.com'],
  usps: ['usps.com'],
  fedex: ['fedex.com'],
  ups: ['ups.com'],
  irs: ['irs.gov'],
  hmrc: ['hmrc.gov.uk'],
  docusign: ['docusign.com'],
  twitter: ['twitter.com', 'x.com'],
  github: ['github.com'],
};

/** Free / heavily-abused TLDs. Not proof of anything on their own — only a contributing signal. */
const RISKY_TLDS = new Set(['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'click', 'link', 'zip', 'country', 'kim', 'gq', 'men', 'loan', 'download']);

/** Look-alike character sequences normalised before comparing to a brand name. */
const HOMOGLYPH_PAIRS: [RegExp, string][] = [
  [/rn/g, 'm'],
  [/vv/g, 'w'],
  [/1/g, 'l'],
  [/0/g, 'o'],
  [/\|/g, 'l'],
  [/5/g, 's'],
  [/3/g, 'e'],
];

function normalizeForCompare(s: string): string {
  let out = s.toLowerCase();
  for (const [pattern, replacement] of HOMOGLYPH_PAIRS) out = out.replace(pattern, replacement);
  return out;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1]);
      prevDiag = temp;
    }
  }
  return dp[n];
}

/** Best-effort registrable domain: last two labels, extended for common two-part public suffixes. */
const TWO_PART_SUFFIXES = new Set(['co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.au', 'net.au', 'co.jp', 'co.nz', 'co.za', 'com.br']);

function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split('.');
  if (labels.length <= 2) return hostname.toLowerCase();
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) return labels.slice(-3).join('.');
  return lastTwo;
}

function extractTitle(html: string): string | undefined {
  const match = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html);
  return match ? match[1].trim() : undefined;
}

function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

/**
 * Sign-in flows that legitimately receive credentials from another domain.
 * Without this, every site using hosted SSO would be flagged.
 */
const TRUSTED_IDENTITY_DOMAINS = new Set([
  'google.com', 'accounts.google.com', 'microsoftonline.com', 'live.com', 'okta.com',
  'auth0.com', 'onelogin.com', 'duosecurity.com', 'apple.com', 'facebook.com',
  'github.com', 'gitlab.com', 'salesforce.com', 'amazoncognito.com', 'pingidentity.com',
]);

/** The `action` of every form on the page, in source order. */
function formActions(html: string): string[] {
  const actions: string[] = [];
  const formTag = /<form\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = formTag.exec(html)) !== null) {
    const action = /\baction\s*=\s*["']([^"']+)["']/i.exec(match[0]);
    if (action?.[1]) actions.push(action[1].trim());
  }
  return actions;
}

/** Whole days since the certificate became valid, or null if unknown. */
function certificateAgeInDays(cert?: SslCertificate): number | null {
  if (!cert?.validFrom) return null;
  const issued = new Date(cert.validFrom).getTime();
  if (Number.isNaN(issued)) return null;
  const days = Math.floor((Date.now() - issued) / 86_400_000);
  return days >= 0 ? days : null;
}

export interface PhishingInput {
  hostname: string;
  finalUrl: string;
  html: string;
  isHttps: boolean;
  /** Absent for plain-HTTP targets or when the TLS handshake never completed. */
  cert?: SslCertificate;
  hasLoginForm: boolean;
}

export function assessPhishing(input: PhishingInput): PhishingAssessment {
  const { hostname, finalUrl, html, isHttps, cert, hasLoginForm } = input;
  const signals: PhishingSignal[] = [];
  let riskPoints = 0;
  let matchedBrand: string | undefined;
  let matchedBrandKind: 'exact' | 'lookalike' | 'mentioned' | undefined;

  const domain = registrableDomain(hostname);
  const labels = hostname.toLowerCase().split('.');
  const tld = labels[labels.length - 1];
  const normalizedDomain = normalizeForCompare(domain.split('.')[0]);
  const title = extractTitle(html);
  const bodySample = html.slice(0, 20_000).toLowerCase();

  // 1. IP address instead of a domain name.
  if (isIpLiteral(hostname)) {
    signals.push({ label: 'Address is a raw IP, not a name', detail: `The site is reached at "${hostname}" — a bare number, not a domain name. Legitimate businesses almost always use a named domain.`, risk: 'bad' });
    riskPoints += 30;
  }

  // 2. Punycode / internationalized domain — a classic homograph vector.
  if (labels.some((label) => label.startsWith('xn--'))) {
    signals.push({ label: 'Domain uses disguised international characters', detail: 'Part of this address is encoded punycode (xn--…), which browsers use to display look-alike letters from other alphabets. This is a known trick for building domains that look identical to a real one.', risk: 'bad' });
    riskPoints += 35;
  }

  // 3. Brand match: exact official domain, close look-alike, or brand named as a decoy label.
  let exactBrandMatch = false;
  for (const [brand, officialDomains] of Object.entries(KNOWN_BRANDS)) {
    if (officialDomains.includes(domain)) { exactBrandMatch = true; matchedBrand = brand; matchedBrandKind = 'exact'; break; }
  }

  if (!exactBrandMatch) {
    const rawLabel = domain.split('.')[0];
    for (const [brand, officialDomains] of Object.entries(KNOWN_BRANDS)) {
      const normalizedBrand = normalizeForCompare(brand);
      const distance = levenshtein(normalizedDomain, normalizedBrand);
      // A pure look-alike swap (digit-for-letter, rn→m, …) normalises to the brand
      // exactly (distance 0). Guard on rawLabel !== brand so genuine regional
      // domains like "google.co.uk" — where the label already IS the brand — are
      // not mistaken for impersonation.
      const homoglyphImpersonation = normalizedBrand.length >= 4 && distance === 0 && rawLabel !== normalizedBrand;
      const closeEnough = normalizedBrand.length >= 4 && distance > 0 && distance <= (normalizedBrand.length <= 5 ? 1 : 2);
      // Brand smuggled into a longer label ("paypal-secure", "login-amazon") is the
      // real phishing pattern. A domain whose whole label IS the brand on another
      // TLD is usually a legitimate regional site (google.co.uk, amazon.de) — only
      // treat that as suspicious when the TLD itself is a throwaway one.
      const brandEmbeddedInLabel = rawLabel.includes(brand) && rawLabel !== brand;
      const brandOnRiskyTld = rawLabel === brand && RISKY_TLDS.has(tld) && !officialDomains.includes(domain);
      const domainContainsBrand = brandEmbeddedInLabel || brandOnRiskyTld;

      if (homoglyphImpersonation) {
        matchedBrand = brand; matchedBrandKind = 'lookalike';
        signals.push({ label: `Domain is "${officialDomains[0]}" with letters swapped for look-alikes`, detail: `"${domain}" reads as "${officialDomains[0]}" but substitutes look-alike characters — such as the digit "1" for the letter "l", or "0" for "o". That swap is deliberate, and it is one of the clearest signs of an impersonation site.`, risk: 'bad' });
        riskPoints += 60;
        break;
      }
      if (closeEnough) {
        matchedBrand = brand; matchedBrandKind = 'lookalike';
        signals.push({ label: `Domain looks like a misspelling of ${officialDomains[0]}`, detail: `"${domain}" is very close to the real "${officialDomains[0]}" — off by a character or two, the kind of difference easy to miss at a glance. This is the single strongest phishing signal there is.`, risk: 'bad' });
        riskPoints += 55;
        break;
      }
      if (domainContainsBrand) {
        matchedBrand = brand; matchedBrandKind = matchedBrandKind ?? 'mentioned';
        signals.push({ label: `"${brand}" appears in the domain, but this isn't ${officialDomains[0]}`, detail: `"${domain}" contains the brand name "${brand}" but is not one of its real domains (${officialDomains.join(', ')}). Real companies essentially never brand a login page under a lookalike domain like this.`, risk: 'bad' });
        riskPoints += 55; // A real company does not host its brand on a lookalike domain.
        break;
      }
    }
  }

  // 4. Brand named prominently in the page (title) while the domain doesn't match it at all.
  if (!matchedBrand && title) {
    const titleLower = title.toLowerCase();
    for (const [brand, officialDomains] of Object.entries(KNOWN_BRANDS)) {
      if (titleLower.includes(brand) && !officialDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        matchedBrand = brand; matchedBrandKind = 'mentioned';
        signals.push({ label: `Page identifies itself as "${brand}" on an unrelated domain`, detail: `The page title ("${title.slice(0, 80)}") references ${brand}, but it is hosted on "${domain}", which has no connection to ${officialDomains[0]}.`, risk: 'bad' });
        riskPoints += 45;
        break;
      }
    }
  }

  if (exactBrandMatch) {
    signals.push({ label: `Domain matches ${matchedBrand}'s real address`, detail: `"${domain}" is one of the domains ${matchedBrand} actually publishes. No lookalike or spoofing pattern was found.`, risk: 'good' });
  }

  // 5. Suspicious TLD, only weighted meaningfully alongside another signal.
  if (RISKY_TLDS.has(tld) && riskPoints > 0) {
    signals.push({ label: `Domain ending ".${tld}" is one that's frequently abused`, detail: `".${tld}" is free or very cheap to register and is disproportionately used for throwaway phishing domains. On its own this proves nothing — plenty of honest sites use it too — but combined with the signal above it adds up.`, risk: 'warning' });
    riskPoints += 10;
  }

  // 6. Excessive hyphens / subdomain depth — a common way to smuggle a brand name into a URL.
  const hyphenCount = (hostname.match(/-/g) ?? []).length;
  if (hyphenCount >= 3) {
    signals.push({ label: 'Unusually many hyphens in the address', detail: `"${hostname}" has ${hyphenCount} hyphens. Genuine brand domains are almost always short and simple; long hyphenated strings ("secure-login-verify-account") are a common way to make a fake address look official.`, risk: 'warning' });
    riskPoints += hyphenCount >= 5 ? 20 : 10;
  }
  if (labels.length >= 5) {
    signals.push({ label: 'Very long subdomain chain', detail: `"${hostname}" has ${labels.length} parts. Attackers sometimes bury a real-looking word ("paypal.com" as a subdomain of something else entirely) deep inside a long address, hoping a quick glance only catches the familiar-looking part.`, risk: 'warning' });
    riskPoints += 15;
  }

  // 7. Credentials being collected without basic transport security, or on an unverifiable certificate.
  if (hasLoginForm && !isHttps) {
    signals.push({ label: 'Login form on a page with no encryption at all', detail: 'This page asks for a password but is not served over HTTPS. No legitimate, modern login page does this — a real site would show a browser warning too.', risk: 'bad' });
    riskPoints += 25;
  }
  if (hasLoginForm && isHttps && cert && cert.validated === false) {
    signals.push({ label: "Login form, but the site's certificate doesn't check out", detail: `${cert.validationError ?? "The TLS certificate chain does not validate."} A real site's certificate is signed by a trusted authority; this one is not, which is unusual for anything handling passwords.`, risk: 'bad' });
    riskPoints += 30;
  }
  if (hasLoginForm && isHttps && cert && cert.validated !== false && cert.selfSigned) {
    signals.push({ label: 'Login form on a self-signed certificate', detail: 'The certificate was not issued by a recognised authority. Real businesses use certificates from providers browsers trust automatically; self-signed certificates on a page collecting passwords are a red flag.', risk: 'bad' });
    riskPoints += 25;
  }

  // 8. Urgency / pressure language often paired with credential-harvesting pages.
  const urgencyHits = ['verify your account', 'suspended', 'unusual activity', 'confirm your identity', 'act now', 'your account will be', 'click here immediately'].filter((phrase) => bodySample.includes(phrase));
  if (urgencyHits.length >= 2 && (hasLoginForm || matchedBrand)) {
    signals.push({ label: 'Urgent, pressuring language on the page', detail: `The page uses phrases designed to rush a decision (e.g. "${urgencyHits[0]}"). Real companies rarely word account pages this way; it's a standard pressure tactic in phishing.`, risk: 'warning' });
    riskPoints += 15;
  }

  // 9. Credentials posted to a different site than the one you are looking at.
  //    A real login posts back to its own domain (or its own identity provider);
  //    shipping a password to an unrelated host is how harvesting kits exfiltrate.
  if (hasLoginForm) {
    for (const action of formActions(html)) {
      let actionHost: string;
      try {
        actionHost = new URL(action, finalUrl).hostname;
      } catch { continue; }

      const actionDomain = registrableDomain(actionHost);
      if (!actionDomain || actionDomain === domain) continue;
      if (TRUSTED_IDENTITY_DOMAINS.has(actionDomain)) continue;

      signals.push({
        label: 'The sign-in form sends your password to a different website',
        detail: `This page is "${domain}", but the login form submits to "${actionDomain}". A genuine sign-in page sends your password back to its own site or to a well-known sign-in provider — not to an unrelated domain. This is how credential-stealing pages forward what you type to whoever built them.`,
        risk: 'bad',
      });
      riskPoints += 60; // Conclusive on its own: the page ships the password elsewhere.
      break;
    }
  }

  // 10. A certificate issued very recently, on a page that is already brand-
  //     adjacent or asking for a password. Deliberately compounding-only:
  //     automated renewal (Let's Encrypt and friends) means a perfectly honest
  //     site often has a certificate only days old, so this must never stand
  //     on its own.
  const certAgeDays = certificateAgeInDays(cert);
  if (certAgeDays !== null && certAgeDays <= 30 && riskPoints > 0 && (matchedBrand || hasLoginForm)) {
    signals.push({
      label: 'The site\'s certificate was issued very recently',
      detail: `This site's security certificate is only ${certAgeDays} day${certAgeDays === 1 ? '' : 's'} old. On its own that means nothing — many legitimate sites renew automatically every couple of months. It matters here only because it lines up with the other warning signs above: impersonation sites are usually built and abandoned within weeks.`,
      risk: 'warning',
    });
    riskPoints += 10;
  }

  const clampedRisk = Math.max(0, Math.min(100, riskPoints));
  let verdict: PhishingAssessment['verdict'];
  let headline: string;

  if (clampedRisk >= 55) {
    verdict = 'likely_spoofed';
    headline = matchedBrand
      ? `This looks like a fake version of ${matchedBrand}, not the real site.`
      : 'This site shows strong signs of being a spoofed or fake page.';
  } else if (clampedRisk >= 20) {
    verdict = 'uncertain';
    headline = 'Some things about this site look a little off — worth a second look before entering any details.';
  } else {
    verdict = 'looks_original';
    headline = exactBrandMatch
      ? `The address matches ${matchedBrand}'s real, official domain.`
      : "Nothing here matches the patterns of a typosquat, lookalike domain, or brand impersonation.";
  }

  const evidence: Evidence[] = [{ label: 'Address checked', value: finalUrl }, { label: 'Registrable domain', value: domain }];

  return {
    verdict,
    riskScore: clampedRisk,
    headline,
    signals: signals.length > 0 ? signals : [{ label: 'No spoofing indicators found', detail: 'The domain, certificate and page content show none of the patterns commonly seen in phishing or brand-impersonation pages.', risk: 'good' }],
    matchedBrand,
    matchedBrandKind,
    evidence,
    disclaimer: 'This is an automated pattern check, not a certified verdict. It cannot see reputation databases or takedown history — always verify by typing the address yourself rather than clicking a link, and check for the padlock and correct domain before entering a password.',
  };
}
