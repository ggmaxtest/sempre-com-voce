import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

// Instância única do Prisma (evita múltiplas conexões em dev --watch).
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: config.isProd ? ['error'] : ['warn', 'error'],
  });

if (!config.isProd) globalForPrisma.__prisma = prisma;
