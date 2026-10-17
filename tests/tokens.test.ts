import { describe, it, expect } from 'vitest';
import { generateRawToken, hashToken } from '@/lib/tokens';

describe('auth tokens: generation and hashing', () => {
  it('generates a 64-character hexadecimal random token (32 bytes)', () => {
    const token = generateRawToken();
    expect(token).toBeTypeOf('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('generates unique tokens on subsequent calls', () => {
    const token1 = generateRawToken();
    const token2 = generateRawToken();
    expect(token1).not.toBe(token2);
  });

  it('computes deterministic SHA-256 hash of token', () => {
    const raw = 'test-token-value-1234567890';
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
  });

  it('produces completely different hashes for slightly differing tokens', () => {
    const hash1 = hashToken('token_a');
    const hash2 = hashToken('token_b');
    expect(hash1).not.toBe(hash2);
  });
});
