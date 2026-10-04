// MODEL ROUTER — seleciona o modelo adequado conforme a tarefa.
// Arquitetura permite trocar/adicionar modelos e provedores no futuro.
import { config } from '../../config/index.js';

// Preços estimados por 1M de tokens (micro-USD por token). Ajustável.
// Usado apenas para ESTIMATIVA de custo em observabilidade — não é cobrança.
const PRICING = {
  'gpt-4o': { in: 2.5, out: 10 }, // USD / 1M tokens
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'text-embedding-3-small': { in: 0.02, out: 0 },
};

/**
 * Seleciona um modelo com base nas características da tarefa.
 * @param {object} opts
 * @param {('chat'|'embedding'|'image'|'vision')} opts.kind
 * @param {('simple'|'complex')} [opts.complexity]
 * @param {boolean} [opts.needsVision]
 * @param {number} [opts.contextSize]
 */
export function selectModel({ kind, complexity = 'simple', needsVision = false } = {}) {
  if (kind === 'embedding') return config.models.embedding;
  if (kind === 'image') return config.models.image;
  if (kind === 'vision' || needsVision) return config.models.vision;
  // chat
  if (complexity === 'complex') return config.models.smart;
  return config.models.fast;
}

export function estimateCostMicroUsd(model, usage) {
  if (!usage) return 0;
  const p = PRICING[model];
  if (!p) return 0;
  const inTok = usage.prompt_tokens || 0;
  const outTok = usage.completion_tokens || 0;
  // preço por 1M tokens -> micro-USD por token = preço (USD/1M) * 1e6 / 1e6 = preço (USD) ...
  // custo USD = (inTok/1e6)*p.in + (outTok/1e6)*p.out ; em micro-USD multiplica por 1e6.
  const usd = (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
  return Math.round(usd * 1e6);
}
