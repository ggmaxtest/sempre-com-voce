import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { registerAllTools } from './ai/tools/index.js';

import authRouter from './modules/auth/routes.js';
import usersRouter from './modules/users/routes.js';
import chatRouter from './modules/chat/routes.js';
import projectsRouter from './modules/projects/routes.js';
import filesRouter from './modules/files/routes.js';
import tasksRouter from './modules/tasks/routes.js';
import brandRouter from './modules/brand/routes.js';
import memoryRouter from './modules/memory/routes.js';
import adminRouter from './modules/admin/routes.js';
import { getIntegrationsStatus } from './modules/integrations/service.js';
import { hasOpenAI } from './config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Caminho do build do frontend (web/dist), relativo a server/src.
const WEB_DIST = path.resolve(__dirname, '../../web/dist');

export function createApp() {
  // Garante que todas as ferramentas estejam registradas no boot.
  registerAllTools();

  const app = express();
  const serveFrontend = fs.existsSync(path.join(WEB_DIST, 'index.html'));

  app.set('trust proxy', 1);

  // Helmet: desliga a CSP padrão quando servimos o SPA (ela quebraria scripts/estilos).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS: em produção servindo o próprio frontend, as chamadas são same-origin.
  // Mantém CORS liberado para a origem do frontend em dev (Vite :5173).
  app.use(
    cors({
      origin: config.isProd ? true : config.webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Rate limit só nas rotas de API (não nos assets estáticos).
  app.use(
    '/api',
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
      frontend: serveFrontend ? 'served' : 'not_built',
      integrations: await getIntegrationsStatus(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/brand', brandRouter);
  app.use('/api/memory', memoryRouter);
  app.use('/api/admin', adminRouter);

  // 404 apenas para rotas /api desconhecidas.
  app.use('/api', notFoundHandler);

  // --- Frontend (SPA) ---
  if (serveFrontend) {
    // Assets com cache; index.html sem cache (para pegar novas versões).
    app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
    // Fallback SPA: qualquer rota não-API devolve o index.html.
    app.get('*', (req, res) => {
      res.sendFile(path.join(WEB_DIST, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.status(200).json({
        service: 'Sempre com Você — API',
        note: 'Frontend não compilado. Rode "npm run build" para servir a interface, ou acesse /api/health.',
      });
    });
  }

  app.use(errorHandler);

  return app;
}
