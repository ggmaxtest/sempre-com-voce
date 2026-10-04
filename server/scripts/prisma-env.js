// Executa a CLI do Prisma garantindo que DATABASE_URL exista (SQLite por padrão).
// Uso: node scripts/prisma-env.js <args da prisma cli...>
import '../src/config/index.js'; // define DATABASE_URL se ausente
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const res = spawnSync('npx', ['prisma', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
process.exit(res.status ?? 1);
