import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // Zod ou outros erros de validação.
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Dados inválidos.', details: err.issues },
    });
  }
  logger.error({ err: err.message, stack: err.stack }, 'Erro não tratado');
  // Nunca vazar stack trace ao cliente.
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno do servidor.' } });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
}
