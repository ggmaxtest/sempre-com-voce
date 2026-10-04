// MEMÓRIA — usuário / projeto / conversa.
// Embeddings guardados como JSON (String) no SQLite; similaridade de cosseno em JS.
// Recupera apenas o que é relevante; nunca mistura usuários.
import { prisma } from '../../db/client.js';
import { embed } from '../providers/openai.js';
import { config, hasOpenAI } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { parseJSON } from '../../utils/json.js';

async function embedText(text) {
  if (!hasOpenAI()) return null;
  const [vec] = await embed({ model: config.models.embedding, input: text });
  return vec;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Salva um fato de memória. scope: USER | PROJECT | CONVERSATION.
 */
export async function remember({ userId, projectId, scope, refId, content, importance = 1 }) {
  const vec = await embedText(content).catch((e) => {
    logger.warn({ err: e.message }, 'Falha ao gerar embedding de memória');
    return null;
  });

  return prisma.memory.create({
    data: {
      userId,
      projectId: projectId || null,
      scope,
      refId: refId || null,
      content,
      importance,
      embedding: vec ? JSON.stringify(vec) : null,
    },
  });
}

// Lista fatos de memória do usuário (opcionalmente filtrados por escopo/projeto).
// Para controle do usuário na UI. Não retorna embeddings.
export async function listMemories({ userId, projectId, scope, limit = 100 }) {
  const where = { userId };
  if (scope) where.scope = scope;
  if (projectId !== undefined) where.projectId = projectId || null;
  return prisma.memory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, content: true, scope: true, projectId: true, importance: true, createdAt: true },
  });
}

// Remove um fato (isolado por usuário).
export async function forget({ userId, id }) {
  const r = await prisma.memory.deleteMany({ where: { id, userId } });
  return r.count > 0;
}

/**
 * Recupera memórias relevantes por similaridade semântica, respeitando isolamento.
 * Faz fallback para recência quando não há embeddings.
 */
export async function recall({ userId, projectId, query, limit = 6 }) {
  const vec = await embedText(query).catch(() => null);

  // Candidatos do usuário (e do projeto, se houver), limitados por recência.
  const candidates = await prisma.memory.findMany({
    where: {
      userId,
      OR: [{ projectId: null }, { projectId: projectId || undefined }],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, content: true, scope: true, importance: true, embedding: true },
  });

  if (vec) {
    const scored = candidates
      .map((m) => {
        const emb = parseJSON(m.embedding, null);
        const sim = emb ? cosineSimilarity(vec, emb) : 0;
        return { ...m, score: sim * (m.importance || 1) };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    if (scored.length) {
      return scored.map(({ id, content, scope, importance }) => ({ id, content, scope, importance }));
    }
  }

  // Fallback: mais recentes.
  return candidates.slice(0, limit).map(({ id, content, scope, importance }) => ({ id, content, scope, importance }));
}
