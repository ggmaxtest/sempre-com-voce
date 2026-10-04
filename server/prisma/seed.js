// Seed: cria planos padrão, admin inicial e versões de prompts no banco.
// Importa a config primeiro: ela define DATABASE_URL (SQLite) e JWT_SECRET se ausentes.
import '../src/config/index.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLANS = [
  { tier: 'FREE', name: 'Free', monthlyCredits: 100, priceCents: 0, limits: { messages: 100, images: 10, searches: 20, files: 20 } },
  { tier: 'PRO', name: 'Pro', monthlyCredits: 2000, priceCents: 4900, limits: { messages: 2000, images: 200, searches: 500, files: 500 } },
  { tier: 'PREMIUM', name: 'Premium', monthlyCredits: 10000, priceCents: 14900, limits: { messages: 10000, images: 1000, searches: 3000, files: 3000 } },
];

async function main() {
  // Planos (limits serializado como JSON string para o SQLite)
  for (const p of PLANS) {
    const data = { ...p, limits: JSON.stringify(p.limits) };
    await prisma.plan.upsert({ where: { tier: p.tier }, update: data, create: data });
  }
  console.log('✓ Planos criados/atualizados');

  // Admin
  const email = process.env.ADMIN_EMAIL || 'admin@semprecomvoce.ai';
  const password = process.env.ADMIN_PASSWORD || 'change-me';
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: { email, passwordHash, name: 'Administrador', role: 'ADMIN', planTier: 'PREMIUM', creditBalance: 100000 },
  });
  console.log(`✓ Admin: ${admin.email}`);

  // Integrações (estado inicial)
  for (const provider of ['meta_ads', 'google_ads', 'tiktok']) {
    await prisma.integration.upsert({
      where: { provider },
      update: {},
      create: { provider, status: 'PENDING' },
    });
  }
  console.log('✓ Integrações registradas (PENDING)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
