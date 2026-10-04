import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { prisma } from './db/client.js';

async function main() {
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(
      `Sempre com Você — API ouvindo em http://localhost:${config.port} (${config.env})`,
    );
    if (!config.openai.apiKey) {
      logger.warn('OPENAI_API_KEY ausente: as funções de IA ficarão indisponíveis até configurar.');
    }
  });

  const shutdown = async (sig) => {
    logger.info({ sig }, 'Encerrando...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error({ err: e.message, stack: e.stack }, 'Falha no bootstrap');
  process.exit(1);
});
