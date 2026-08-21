/**
 * Password hashing with scrypt from Node's standard library: memory-hard, no
 * third-party dependency, no native build step. Stored format is
 * self-describing: scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>
 */

import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number }
) => Promise<Buffer>;

const PARAMS = { N: 16_384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('hex'), derived.toString('hex')].join('$');
}

export function isHashed(stored: string): boolean {
  return stored.startsWith('scrypt$');
}

export interface VerifyResult {
  ok: boolean;
  /** True when the password matched but was stored as legacy plaintext. */
  needsUpgrade: boolean;
}

export async function verifyPassword(plain: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { ok: false, needsUpgrade: false };

  // Legacy plaintext rows are accepted once and upgraded on the way through.
  if (!isHashed(stored)) {
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return { ok, needsUpgrade: ok };
  }

  const parts = stored.split('$');
  if (parts.length !== 6) return { ok: false, needsUpgrade: false };
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const N = parseInt(nRaw, 10);
  const r = parseInt(rRaw, 10);
  const p = parseInt(pRaw, 10);
  if (!N || !r || !p) return { ok: false, needsUpgrade: false };

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scryptAsync(plain, salt, expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
    const ok = derived.length === expected.length && timingSafeEqual(derived, expected);
    return { ok, needsUpgrade: false };
  } catch {
    return { ok: false, needsUpgrade: false };
  }
}
