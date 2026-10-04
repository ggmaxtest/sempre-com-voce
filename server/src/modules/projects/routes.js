import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../utils/errors.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(140),
  description: z.string().max(2000).optional(),
  context: z.string().max(8000).optional(),
  settings: z.record(z.any()).optional(),
});

projectsRouter.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ projects });
  } catch (e) { next(e); }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const data = upsertSchema.parse(req.body);
    if (data.settings) data.settings = JSON.stringify(data.settings);
    const project = await prisma.project.create({ data: { ...data, userId: req.user.id } });
    res.status(201).json({ project });
  } catch (e) { next(e); }
});

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        _count: { select: { conversations: true, files: true } },
      },
    });
    if (!project) throw NotFound('Projeto não encontrado.');
    res.json({ project });
  } catch (e) { next(e); }
});

projectsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = upsertSchema.partial().parse(req.body);
    if (data.settings) data.settings = JSON.stringify(data.settings);
    const result = await prisma.project.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data,
    });
    if (!result.count) throw NotFound('Projeto não encontrado.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await prisma.project.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!result.count) throw NotFound('Projeto não encontrado.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default projectsRouter;
