// Observabilidade de uso/custo. Nunca registra conteúdo sensível.
import { prisma } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

export async function recordUsage({
  userId, projectId, kind, model, agent, tool,
  usage, costMicroUsd = 0, latencyMs = 0, status = 'ok', error = null,
}) {
  try {
    await prisma.usageEvent.create({
      data: {
        userId: userId || null,
        projectId: projectId || null,
        kind,
        model: model || null,
        agent: agent || null,
        tool: tool || null,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        costMicroUsd,
        latencyMs,
        status,
        error: error ? String(error).slice(0, 500) : null,
      },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Falha ao registrar uso');
  }
}
