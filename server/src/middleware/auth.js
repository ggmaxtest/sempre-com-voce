// Middleware de autenticação e autorização.
import { verifyToken, isSessionValid } from '../modules/auth/service.js';
import { prisma } from '../db/client.js';
import { Unauthorized, Forbidden } from '../utils/errors.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw Unauthorized();
    const payload = verifyToken(token);
    if (!payload) throw Unauthorized('Token inválido ou expirado.');
    const valid = await isSessionValid(token);
    if (!valid) throw Unauthorized('Sessão expirada.');
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw Unauthorized('Usuário inativo.');
    req.user = user;
    req.token = token;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return next(Forbidden('Área restrita a administradores.'));
  next();
}
