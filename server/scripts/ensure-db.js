// Garante que o banco SQLite exista e esteja com o schema aplicado + seed.
// Roda automaticamente antes de `dev`/`start`, tornando a app ZERO-CONFIG.
import '../src/config/index.js'; // define DATABASE_URL (SQLite) e JWT_SECRET se ausentes
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

function dbFilePath() {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('file:')) return url.slice(5);
  return null; // banco externo (não-SQLite): não mexer
}

const file = dbFilePath();

// Só auto-provisiona quando é SQLite local.
if (file) {
  const exists = fs.existsSync(file) && fs.statSync(file).size > 0;
  if (!exists) {
    console.log('→ Primeiro arranque: criando banco SQLite e aplicando schema...');
    const push = spawnSync('npx', ['prisma', 'db', 'push'], {
      stdio: 'inherit', env: process.env, cwd: serverRoot,
      shell: process.platform === 'win32',
    });
    if (push.status !== 0) {
      console.error('Falha ao criar o banco.');
      process.exit(1);
    }
    console.log('→ Populando dados iniciais (admin, planos)...');
    const seed = spawnSync('node', ['prisma/seed.js'], {
      stdio: 'inherit', env: process.env, cwd: serverRoot,
      shell: process.platform === 'win32',
    });
    if (seed.status !== 0) {
      console.error('Falha no seed.');
      process.exit(1);
    }
    console.log('✓ Banco pronto.');
  }
}
