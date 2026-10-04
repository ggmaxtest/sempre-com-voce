import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound, BadRequest } from '../../utils/errors.js';
import { saveBuffer, readFileBuffer, deleteFile } from './storage.js';

export const filesRouter = Router();
filesRouter.use(requireAuth);

// Validação de upload: tamanho, extensão e MIME type.
const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED = {
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/pdf': 'pdf',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'text/plain': 'document',
  'application/json': 'document',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new BadRequest(`Tipo de arquivo não permitido: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

filesRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw BadRequest('Nenhum arquivo enviado.');
    const kind = ALLOWED[req.file.mimetype] || 'other';
    const asset = await saveBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      kind,
      userId: req.user.id,
      projectId: req.body.projectId || null,
    });
    res.status(201).json({
      file: { id: asset.id, filename: asset.filename, kind: asset.kind, size: asset.size, mimeType: asset.mimeType },
    });
  } catch (e) { next(e); }
});

filesRouter.get('/', async (req, res, next) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.projectId) where.projectId = String(req.query.projectId);
    const files = await prisma.fileAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, filename: true, kind: true, size: true, mimeType: true, createdAt: true },
    });
    res.json({ files });
  } catch (e) { next(e); }
});

// Download/visualização — isolado por usuário.
filesRouter.get('/:id/raw', async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!asset) throw NotFound('Arquivo não encontrado.');
    const buffer = await readFileBuffer(asset.storageKey);
    res.setHeader('Content-Type', asset.mimeType);
    res.send(buffer);
  } catch (e) { next(e); }
});

filesRouter.delete('/:id', async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!asset) throw NotFound('Arquivo não encontrado.');
    await deleteFile(asset.storageKey);
    await prisma.fileAsset.delete({ where: { id: asset.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default filesRouter;
