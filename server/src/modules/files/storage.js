// Armazenamento de arquivos com driver plugável (local | s3).
// Isolamento e vínculo com usuário/projeto é feito pela camada de aplicação.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { prisma } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const LOCAL_DIR = path.resolve(process.cwd(), config.storage.localDir);

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

function newKey(filename) {
  const ext = path.extname(filename);
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

// Grava bytes no storage e cria o registro FileAsset.
export async function saveBuffer({ buffer, filename, mimeType, kind, userId, projectId }) {
  const storageKey = newKey(filename);

  if (config.storage.driver === 's3') {
    // Interface pronta para S3; implementação real requer credenciais.
    // Mantido explícito para não simular algo que não está configurado.
    if (!config.storage.s3.bucket) {
      throw new Error('STORAGE_DRIVER=s3 mas S3 não está configurado.');
    }
    throw new Error('Driver S3 ainda não implementado neste build (use STORAGE_DRIVER=local).');
  }

  await ensureLocalDir();
  await fs.writeFile(path.join(LOCAL_DIR, storageKey), buffer);

  const asset = await prisma.fileAsset.create({
    data: {
      userId,
      projectId: projectId || null,
      filename,
      mimeType,
      size: buffer.length,
      storageKey,
      kind: kind || 'other',
    },
  });
  logger.debug({ fileId: asset.id, kind }, 'Arquivo salvo');
  return asset;
}

export async function readFileBuffer(storageKey) {
  if (config.storage.driver === 's3') {
    throw new Error('Driver S3 ainda não implementado neste build.');
  }
  return fs.readFile(path.join(LOCAL_DIR, storageKey));
}

export async function deleteFile(storageKey) {
  if (config.storage.driver === 's3') return;
  try {
    await fs.unlink(path.join(LOCAL_DIR, storageKey));
  } catch {
    /* já removido */
  }
}
