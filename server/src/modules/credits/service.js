// Sistema de créditos. Valores configuráveis. Não desconta em falha prévia.
import { prisma } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';

// Custo em créditos por tipo de operação (configurável).
export const CREDIT_COSTS = {
  CHAT: 1,
  SEARCH: 2,
  IMAGE: 5,
  ANALYSIS: 3,
  TOOL: 1,
};

export async function getBalance(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
  return u?.creditBalance ?? 0;
}

export async function hasCredits(userId, amount) {
  const balance = await getBalance(userId);
  return balance >= amount;
}

/**
 * Debita créditos de forma atômica. Lança erro se saldo insuficiente.
 * Só deve ser chamado APÓS a operação produzir resultado (não em falha prévia).
 */
export async function debit(userId, reason, amount, meta = {}) {
  if (amount <= 0) return;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
    if (!user) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');
    if (user.creditBalance < amount) {
      throw new AppError('Créditos insuficientes.', 402, 'INSUFFICIENT_CREDITS');
    }
    const balanceAfter = user.creditBalance - amount;
    await tx.user.update({ where: { id: userId }, data: { creditBalance: balanceAfter } });
    await tx.creditTransaction.create({
      data: { userId, amount: -amount, reason, balanceAfter, meta: JSON.stringify(meta || {}) },
    });
    return balanceAfter;
  });
}

export async function grant(userId, amount, reason = 'GRANT', meta = {}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
    const balanceAfter = (user?.creditBalance ?? 0) + amount;
    await tx.user.update({ where: { id: userId }, data: { creditBalance: balanceAfter } });
    await tx.creditTransaction.create({ data: { userId, amount, reason, balanceAfter, meta: JSON.stringify(meta || {}) } });
    return balanceAfter;
  });
}
