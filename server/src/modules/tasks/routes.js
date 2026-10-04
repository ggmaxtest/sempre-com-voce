import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../utils/errors.js';
import * as tasks from './service.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get('/', async (req, res, next) => {
  try {
    res.json({ tasks: await tasks.listTasks(req.user.id) });
  } catch (e) { next(e); }
});

tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const task = await tasks.getTask(req.params.id, req.user.id);
    if (!task) throw NotFound('Tarefa não encontrada.');
    res.json({ task });
  } catch (e) { next(e); }
});

tasksRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const task = await tasks.cancelTask(req.params.id, req.user.id);
    if (!task) throw NotFound('Tarefa não encontrada.');
    res.json({ task });
  } catch (e) { next(e); }
});

export default tasksRouter;
