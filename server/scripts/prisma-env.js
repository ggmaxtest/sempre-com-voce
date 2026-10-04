// Executa a CLI do Prisma garantindo que DATABASE_URL exista (SQLite por padrão).
// Resolve o binário de forma portável (não depende de 'npx' no PATH).
// Uso: node scripts/prisma-env.js <args da prisma cli...>
import '../src/config/index.js'; // define DATABASE_URL se ausente
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(serverRoot, '..');
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);

function spawn(cmd, cmdArgs) {
  return spawnSync(cmd, cmdArgs, {
    stdio: 'inherit', env: process.env, cwd: serverRoot,
    shell: process.platform === 'win32',
  });
}

const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
let res;
const localBins = [
  path.join(serverRoot, 'node_modules', '.bin', binName),
  path.join(projectRoot, 'node_modules', '.bin', binName),
];
const found = localBins.find((b) => fs.existsSync(b));
if (found) {
  res = spawn(found, args);
} else {
  try {
    const prismaPkg = require.resolve('prisma/build/index.js');
    res = spawn(process.execPath, [prismaPkg, ...args]);
  } catch {
    res = spawn('npx', ['prisma', ...args]);
  }
}
process.exit(res.status ?? 1);
