// Serviço de autenticação: hashing bcrypt (puro JS), emissão de JWT, sessões.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../../db/client.js';
import { config } from '../../config/index.js';
import { Conflict, Unauthorized } from '../../utils/errors.js';
import { parseJSON } from '../../utils/json.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(hash, plain) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

function signToken(user) {
  return jwt.sign(
    // jti aleatório garante que cada token (e seu hash) seja único,
    // mesmo que dois logins ocorram no mesmo segundo.
    { sub: user.id, role: user.role, email: user.email, jti: crypto.randomUUID() },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
}

export async function register({ email, password, name }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Conflict('E-mail já cadastrado.');
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null, planTier: 'FREE', creditBalance: 100 },
  });
  // Registra a concessão inicial de créditos.
  await prisma.creditTransaction.create({
    data: { userId: user.id, amount: 100, reason: 'GRANT', balanceAfter: 100, meta: JSON.stringify({ note: 'créditos iniciais' }) },
  });
  const token = await createSession(user);
  return { user: publicUser(user), token };
}

export async function login({ email, password, userAgent, ip }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw Unauthorized('Credenciais inválidas.');
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw Unauthorized('Credenciais inválidas.');
  const token = await createSession(user, userAgent, ip);
  return { user: publicUser(user), token };
}

async function createSession(user, userAgent, ip) {
  const token = signToken(user);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.session.create({
    data: { userId: user.id, tokenHash, userAgent: userAgent || null, ip: ip || null, expiresAt },
  });
  return token;
}

export async function logout(token) {
  if (!token) return;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function isSessionValid(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) return false;
  if (session.revokedAt) return false;
  if (session.expiresAt < new Date()) return false;
  return true;
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    locale: user.locale,
    theme: user.theme,
    tone: user.tone,
    planTier: user.planTier,
    creditBalance: user.creditBalance,
    preferences: parseJSON(user.preferences, {}),
  };
}
