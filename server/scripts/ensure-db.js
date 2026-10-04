// Garante que o Prisma Client esteja gerado, o banco SQLite exista com o schema
// aplicado e os dados iniciais populados. Roda antes de `dev`/`start`.
// Torna a app ZERO-CONFIG e resiliente a hosts que bloqueiam install scripts
// (ex.: Square Cloud bloqueia o postinstall do @prisma/client).
import '../src/config/index.js'; // define DATABASE_URL (SQLite) e JWT_SECRET se ausentes
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function run(cmd, args) {
  return spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: serverRoot,
    shell: process.platform === 'win32',
  });
}

// --- 1) Garante que o Prisma Client esteja gerado ---
function prismaClientIsGenerated() {
  try {
    // Se o postinstall foi bloqueado, este require aponta para um stub que lança erro ao instanciar.
    // Verificamos a presença dos artefatos gerados em .prisma/client.
    const base = path.dirname(require.resolve('@prisma/client'));
    const generated = path.resolve(base, '../.prisma/client');
    return fs.existsSync(path.join(generated, 'index.js')) || fs.existsSync(path.join(generated, 'default.js'))
      && fs.readdirSync(generated).some((f) => f.endsWith('.node') || f.includes('query'));
  } catch {
    return false;
  }
}

if (!prismaClientIsGenerated()) {
  console.log('→ Gerando o Prisma Client...');
  const gen = run('npx', ['prisma', 'generate']);
  if (gen.status !== 0) {
    console.error('Falha ao gerar o Prisma Client.');
    process.exit(1);
  }
}

// --- 2) Provisiona o banco (apenas SQLite local) ---
function dbFilePath() {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('file:')) return url.slice(5);
  return null; // banco externo (não-SQLite): não mexer
}

const file = dbFilePath();
if (file) {
  const exists = fs.existsSync(file) && fs.statSync(file).size > 0;
  if (!exists) {
    console.log('→ Primeiro arranque: criando banco SQLite e aplicando schema...');
    const push = run('npx', ['prisma', 'db', 'push', '--skip-generate']);
    if (push.status !== 0) {
      console.error('Falha ao criar o banco.');
      process.exit(1);
    }
    console.log('→ Populando dados iniciais (admin, planos)...');
    const seed = run('node', ['prisma/seed.js']);
    if (seed.status !== 0) {
      console.error('Falha no seed.');
      process.exit(1);
    }
    console.log('✓ Banco pronto.');
  }
}
