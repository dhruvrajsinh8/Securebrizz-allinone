/**
 * Seeds one demo account. Vulnerabilities and scan results are NOT seeded:
 * they are created from real scan findings, so seeding invented ones would put
 * fabricated issues in the same list as measured ones with no way to tell them
 * apart. Run a scan to populate those tables.
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

/**
 * Override with SEED_PASSWORD when seeding anything publicly reachable, and
 * remove or suspend this account before deploying.
 */
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'demo1234';

async function main() {
  console.log('Seeding database...');

  const existing = await prisma.user.findUnique({ where: { email: 'alex@securebiz.io' } });
  if (existing) {
    console.log('Demo account already exists — nothing to do.');
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.create({
    data: {
      name: 'Alex Johnson',
      email: 'alex@securebiz.io',
      password: passwordHash,
      role: 'admin',
      company: 'SecureBiz Inc.',
      plan: 'enterprise',
      twoFactorEnabled: false,
      status: 'active',
    },
  });

  console.log(`Created demo account: ${user.email} / ${DEMO_PASSWORD}`);
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
