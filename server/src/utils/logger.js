import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.isProd ? 'info' : 'debug',
  // Nunca registrar segredos / PII desnecessária.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.apiKey',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  transport: config.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
