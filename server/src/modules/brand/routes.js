import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import * as brand from './service.js';

export const brandRouter = Router();
brandRouter.use(requireAuth);

// GET /api/brand?projectId=...  → perfil de marca (do projeto ou global)
brandRouter.get('/', async (req, res, next) => {
  try {
    const projectId = req.query.projectId || null;
    const profile = await brand.getBrand(req.user.id, projectId);
    res.json({ profile: profile || null, fields: brand.BRAND_FIELDS });
  } catch (e) { next(e); }
});

const brandSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().max(4000).optional(),
  products: z.string().max(4000).optional(),
  pricing: z.string().max(4000).optional(),
  audience: z.string().max(4000).optional(),
  positioning: z.string().max(4000).optional(),
  differentials: z.string().max(4000).optional(),
  toneOfVoice: z.string().max(4000).optional(),
  visualStyle: z.string().max(4000).optional(),
  objectives: z.string().max(4000).optional(),
  competitors: z.string().max(4000).optional(),
  rules: z.string().max(4000).optional(),
  approvedExamples: z.string().max(4000).optional(),
  avoidExamples: z.string().max(4000).optional(),
});

// PUT /api/brand → cria/atualiza o perfil
brandRouter.put('/', async (req, res, next) => {
  try {
    const { projectId, ...data } = brandSchema.parse(req.body);
    const profile = await brand.upsertBrand(req.user.id, projectId || null, data);
    res.json({ profile });
  } catch (e) { next(e); }
});

// DELETE /api/brand?projectId=... → limpa o perfil
brandRouter.delete('/', async (req, res, next) => {
  try {
    await brand.clearBrand(req.user.id, req.query.projectId || null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default brandRouter;
