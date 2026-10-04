import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { publicUser } from '../auth/service.js';
import * as credits from '../credits/service.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const profileSchema = z.object({
  name: z.string().max(120).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  locale: z.string().max(10).optional(),
  theme: z.enum(['lunar', 'solar']).optional(),
  tone: z.string().max(200).optional(),
  preferences: z.record(z.any()).optional(),
});

usersRouter.patch('/me', async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    if (data.preferences) data.preferences = JSON.stringify(data.preferences);
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

usersRouter.get('/me/credits', async (req, res, next) => {
  try {
    const [balance, ledger] = await Promise.all([
      credits.getBalance(req.user.id),
      prisma.creditTransaction.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    res.json({ balance, ledger, costs: credits.CREDIT_COSTS });
  } catch (e) { next(e); }
});

export default usersRouter;
