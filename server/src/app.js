import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { registerAllTools } from './ai/tools/index.js';

import authRouter from './modules/auth/routes.js';
import usersRouter from './modules/users/routes.js';
import chatRouter from './modules/chat/routes.js';
import projectsRouter from './modules/projects/routes.js';
import filesRouter from './modules/files/routes.js';
import adminRouter from './modules/admin/routes.js';
import { getIntegrationsStatus } from './modules/integrations/service.js';
import { hasOpenAI } from './config/index.js';

export function createApp() {
  // Garante que todas as ferramentas estejam registradas no boot.
  registerAllTools();

  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Rate limit global.
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Health público (sem dados sensíveis).
  app.get('/api/health', async (req, res) => {
    res.json({
      ok: true,
      ai: hasOpenAI() ? 'ready' : 'missing_openai_key',
      integrations: await getIntegrationsStatus(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
