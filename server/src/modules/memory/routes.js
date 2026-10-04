import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../utils/errors.js';
import { listMemories, remember, forget } from '../../ai/memory/index.js';

export const memoryRouter = Router();
memoryRouter.use(requireAuth);

// GET /api/memory?scope=USER|PROJECT|BRAND&projectId=...
memoryRouter.get('/', async (req, res, next) => {
  try {
    const scope = req.query.scope || undefined;
    const projectId = req.query.projectId !== undefined ? (req.query.projectId || null) : undefined;
    const items = await listMemories({ userId: req.user.id, scope, projectId, limit: 100 });
    res.json({ memories: items });
  } catch (e) { next(e); }
});

const addSchema = z.object({
  content: z.string().min(2).max(2000),
  scope: z.enum(['USER', 'PROJECT']).default('USER'),
  projectId: z.string().optional(),
  importance: z.number().min(0).max(5).optional(),
});

// POST /api/memory → ensina um fato explicitamente (persistido de verdade)
memoryRouter.post('/', async (req, res, next) => {
  try {
    const body = addSchema.parse(req.body);
    const row = await remember({
      userId: req.user.id,
      projectId: body.projectId || null,
      scope: body.scope,
      content: body.content,
      importance: body.importance ?? 2,
    });
    res.status(201).json({ memory: { id: row.id, content: row.content, scope: row.scope } });
  } catch (e) { next(e); }
});

// DELETE /api/memory/:id → remove um fato (controle do usuário)
memoryRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await forget({ userId: req.user.id, id: req.params.id });
    if (!ok) throw NotFound('Memória não encontrada.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default memoryRouter;
