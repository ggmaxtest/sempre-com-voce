import { Router } from 'express';
import { z } from 'zod';
import * as auth from './service.js';
import { requireAuth } from '../../middleware/auth.js';
import { config } from '../../config/index.js';
import { BadRequest } from '../../utils/errors.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  name: z.string().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const { user, token } = await auth.register(data);
    setCookie(res, token);
    res.status(201).json({ user, token });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { user, token } = await auth.login({
      ...data,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setCookie(res, token);
    res.json({ user, token });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await auth.logout(req.token);
    res.clearCookie('token');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: auth.publicUser(req.user) });
});

export default authRouter;
