// Erros de aplicação com status HTTP. Mensagens seguras (sem vazar internals).

export class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Unauthorized = (msg = 'Não autenticado') =>
  new AppError(msg, 401, 'UNAUTHORIZED');
export const Forbidden = (msg = 'Acesso negado') =>
  new AppError(msg, 403, 'FORBIDDEN');
export const NotFound = (msg = 'Não encontrado') =>
  new AppError(msg, 404, 'NOT_FOUND');
export const Conflict = (msg = 'Conflito') => new AppError(msg, 409, 'CONFLICT');
export const BadRequest = (msg = 'Requisição inválida', details) =>
  new AppError(msg, 400, 'BAD_REQUEST', details);
export const TooMany = (msg = 'Muitas requisições') =>
  new AppError(msg, 429, 'RATE_LIMITED');
export const Internal = (msg = 'Erro interno') =>
  new AppError(msg, 500, 'INTERNAL');
