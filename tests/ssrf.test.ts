/**
 * The scanner fetches a URL the caller supplies, so these checks are the line
 * between "security tool" and "open proxy into our own network". They are the
 * first thing that should fail if someone loosens the guard by accident.
 */

import { describe, it, expect } from 'vitest';
import { isPrivateAddress, isValidHostname, isLocalHostDomain } from '@/lib/scanner/net';

describe('isPrivateAddress', () => {
  it('blocks loopback', () => {
    for (const ip of ['127.0.0.1', '127.1.2.3', '::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('blocks the cloud metadata endpoint', () => {
    // 169.254.169.254 serves IAM credentials on AWS/GCP/Azure.
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('blocks RFC1918 space', () => {
    for (const ip of ['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255', '192.168.1.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses that merely look adjacent to private ranges', () => {
    for (const ip of ['172.15.0.1', '172.32.0.1', '192.169.1.1', '11.0.0.1', '8.8.8.8', '1.1.1.1']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('blocks carrier-grade NAT', () => {
    expect(isPrivateAddress('100.64.0.1')).toBe(true);
    expect(isPrivateAddress('100.127.255.255')).toBe(true);
    expect(isPrivateAddress('100.128.0.1')).toBe(false);
  });

  it('blocks IPv4-mapped IPv6, which is a classic bypass', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks IPv6 link-local, unique-local and multicast', () => {
    for (const ip of ['fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('blocks bracketed and mixed-case forms', () => {
    expect(isPrivateAddress('[::1]')).toBe(true);
    expect(isPrivateAddress('FE80::1')).toBe(true);
  });

  it('treats malformed octets as unsafe rather than allowing them', () => {
    expect(isPrivateAddress('999.999.999.999')).toBe(true);
  });
});

describe('isLocalHostDomain', () => {
  it('recognises localhost spellings', () => {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', 'app.localhost']) {
      expect(isLocalHostDomain(host), host).toBe(true);
    }
  });

  it('does not treat a public domain merely containing "localhost" as local', () => {
    expect(isLocalHostDomain('localhost.evil.com')).toBe(false);
  });
});

describe('isValidHostname', () => {
  it('accepts ordinary domains', () => {
    for (const host of ['example.com', 'sub.example.co.uk', 'xn--80ak6aa92e.com']) {
      expect(isValidHostname(host), host).toBe(true);
    }
  });

  it('rejects empty and malformed input', () => {
    for (const host of ['', 'no-dot', 'has space.com', 'trailing-.com', '-leading.com']) {
      expect(isValidHostname(host), host).toBe(false);
    }
  });
});
