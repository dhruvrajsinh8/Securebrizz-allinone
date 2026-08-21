/**
 * Tests for the authentication primitives.
 *   npm run test:auth
 * Asserts: passwords are never recoverable from storage, and a session cookie
 * cannot be forged or edited without the server secret.
 */

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-that-is-definitely-long-enough-32';

import { createHmac } from 'crypto';
import { hashPassword, isHashed, verifyPassword } from '../src/lib/password';
import { createSessionToken, verifySessionToken } from '../src/lib/session';

let passed = 0, failed = 0;
function check(name: string, condition: boolean): void {
  if (condition) { passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { failed++; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`); }
}
function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main(): Promise<void> {
  console.log('\nPassword hashing');
  const hash = await hashPassword('correct horse battery staple');
  check('produces a self-describing scrypt hash', hash.startsWith('scrypt$16384$8$1$'));
  check('recognised as hashed', isHashed(hash));
  check('plaintext is not present in the stored value', !hash.includes('correct horse'));
  const second = await hashPassword('correct horse battery staple');
  check('same password hashes differently (random salt)', hash !== second);
  check('correct password verifies', (await verifyPassword('correct horse battery staple', hash)).ok);
  check('wrong password rejected', !(await verifyPassword('wrong password', hash)).ok);
  check('empty password rejected', !(await verifyPassword('', hash)).ok);
  const legacy = await verifyPassword('demo1234', 'demo1234');
  check('legacy plaintext row still authenticates', legacy.ok);
  check('legacy row is flagged for upgrade', legacy.needsUpgrade);
  check('legacy row with wrong password rejected', !(await verifyPassword('nope', 'demo1234')).ok);
  check('malformed stored value rejected', !(await verifyPassword('x', 'scrypt$broken')).ok);

  console.log('\nSession tokens');
  const token = createSessionToken('user-001');
  check('round-trips to the same user id', verifySessionToken(token) === 'user-001');
  check('missing token rejected', verifySessionToken(undefined) === null);
  check('garbage token rejected', verifySessionToken('not-a-token') === null);
  check('raw user id is not accepted as a token', verifySessionToken('user-001') === null);
  const [payload, signature] = token.split('.');
  const forgedPayload = base64url(JSON.stringify({ uid: 'user-999', exp: Math.floor(Date.now() / 1000) + 3600 }));
  check('edited payload with original signature rejected', verifySessionToken(`${forgedPayload}.${signature}`) === null);
  check('tampered signature rejected', verifySessionToken(`${payload}.${signature.slice(0, -2)}xy`) === null);
  const expiredPayload = base64url(JSON.stringify({ uid: 'user-001', exp: Math.floor(Date.now() / 1000) - 60 }));
  const expiredSig = base64url(createHmac('sha256', process.env.AUTH_SECRET as string).update(expiredPayload).digest());
  check('validly signed but expired token rejected', verifySessionToken(`${expiredPayload}.${expiredSig}`) === null);
  const otherSig = base64url(createHmac('sha256', 'a-completely-different-secret-value-here').update(payload).digest());
  check('token signed with another secret rejected', verifySessionToken(`${payload}.${otherSig}`) === null);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
