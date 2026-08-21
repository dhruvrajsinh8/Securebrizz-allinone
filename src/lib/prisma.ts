import { PrismaClient } from '@prisma/client';

/**
 * A single Prisma client, reused across hot reloads and serverless invocations.
 * Without the global cache, dev mode opens a new connection on every request
 * and exhausts the database's connection limit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
