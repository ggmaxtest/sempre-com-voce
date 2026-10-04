// ORQUESTRADOR CENTRAL — o cérebro operacional.
// Fluxo: interpretar -> planejar -> executar agentes -> combinar -> validar -> responder.
import { getOpenAI } from '../providers/openai.js';
import { SYSTEM_PROMPT, ORCHESTRATOR_PROMPT } from '../prompts/index.js';
import { toolCatalog } from '../tools/registry.js';
import { AGENT_NAMES } from '../agents/index.js';
import { runAgent } from '../agents/runner.js';
import { selectModel } from '../model-router/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Classifica a intenção e monta um plano. Retorna objeto do plano.
 */
export async function plan({ userMessage, projectName, hasFiles, hasImages }) {
  const openai = getOpenAI();
  const sys = ORCHESTRATOR_PROMPT
    .replace('{{TOOLS}}', toolCatalog())
    .replace('{{PROJECT}}', projectName || 'nenhum')
    .replace('{{HAS_FILES}}', hasFiles ? 'sim' : 'não')
    .replace('{{HAS_IMAGES}}', hasImages ? 'sim' : 'não');

  const res = await openai.chat.completions.create({
    model: selectModel({ kind: 'chat', complexity: 'simple' }),
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userMessage },
    ],
  });

  let parsed;
  try {
    parsed = JSON.parse(res.choices?.[0]?.message?.content || '{}');
  } catch {
    parsed = {};
  }

  return normalizePlan(parsed, { userMessage, hasFiles, hasImages });
}

/**
 * Normaliza/valida o plano retornado pelo modelo, com fallbacks seguros.
 * Função pura (testável sem rede).
 */
export function normalizePlan(parsed, { userMessage = '', hasFiles = false, hasImages = false } = {}) {
  const agents = Array.isArray(parsed?.agents)
    ? parsed.agents.filter((a) => AGENT_NAMES.includes(a))
    : [];
  // Se há imagens anexadas e o plano esqueceu, inclui visão.
  if (hasImages && !agents.includes('vision')) agents.unshift('vision');
  if (hasFiles && !agents.includes('files') && !agents.includes('data')) {
    agents.unshift('files');
  }
  if (agents.length === 0) agents.push('general');

  return {
    intent: parsed?.intent || userMessage.slice(0, 120),
    complexity: parsed?.complexity === 'complex' ? 'complex' : 'simple',
    agents,
    needsResearch: Boolean(parsed?.needsResearch),
    needsFiles: Boolean(parsed?.needsFiles),
    steps: Array.isArray(parsed?.steps) ? parsed.steps : [],
    clarificationNeeded: parsed?.clarificationNeeded || null,
  };
}

/**
 * Executa o plano. Para tarefas simples (1 agente geral), delega direto ao
 * streaming da resposta final. Para múltiplos agentes, executa cada um e
 * depois sintetiza a resposta final em streaming.
 *
 * @param {object} opts
 * @param {Array} opts.history       mensagens anteriores [{role, content}]
 * @param {string} opts.userMessage
 * @param {object} opts.plan
 * @param {object} opts.ctx          { userId, projectId, allow, confirmed, onEvent, memory, project }
 * @param {function} opts.onDelta    callback para chunks de texto da resposta final
 * @returns {Promise<{text, agentResults, usage}>}
 */
export async function execute({ history, userMessage, plan, ctx, onDelta }) {
  const emit = ctx.onEvent || (() => {});
  const agentResults = [];

  // Monta o contexto base (system principal + contexto do projeto/memória relevante).
  const contextBlocks = [];
  if (ctx.project?.name) {
    contextBlocks.push(
      `Projeto atual: ${ctx.project.name}${ctx.project.context ? `\nContexto do projeto: ${ctx.project.context}` : ''}`,
    );
  }
  if (ctx.memory?.length) {
    contextBlocks.push(
      `Memória relevante do usuário/projeto:\n${ctx.memory.map((m) => `- ${m.content}`).join('\n')}`,
    );
  }
  const contextMessage = contextBlocks.length
    ? [{ role: 'system', content: contextBlocks.join('\n\n') }]
    : [];

  // Caminho simples: apenas o agente geral, sem etapas intermediárias.
  const isSimple = plan.complexity === 'simple' && plan.agents.length === 1;

  if (!isSimple) {
    // Executa cada agente especializado em sequência, acumulando resultados.
    for (const agentName of plan.agents) {
      if (agentName === 'general') continue; // o geral entra na síntese final
      emit({ type: 'agent_start', agent: agentName });
      const agentMessages = [
        ...contextMessage,
        ...history,
        {
          role: 'user',
          content:
            `Tarefa do usuário: ${userMessage}\n\n` +
            `Sua parte (como agente ${agentName}): produza sua contribuição especializada. ` +
            `Use ferramentas se necessário. Seja objetivo e estruturado.`,
        },
      ];
      try {
        const r = await runAgent({
          agentName,
          messages: agentMessages,
          complexity: plan.complexity,
          ctx,
        });
        agentResults.push({ agent: agentName, text: r.text, toolRuns: r.toolRuns, model: r.model, usage: r.usage, costMicroUsd: r.costMicroUsd });
        emit({ type: 'agent_end', agent: agentName });
      } catch (e) {
        logger.warn({ agent: agentName, err: e.message }, 'Falha no agente');
        agentResults.push({ agent: agentName, error: e.message });
        emit({ type: 'agent_error', agent: agentName, error: e.message });
      }
    }
  }

  // Síntese final em streaming (voz única da Sempre com Você).
  emit({ type: 'status', status: 'validando' });
  const openai = getOpenAI();
  const model = selectModel({ kind: 'chat', complexity: plan.complexity });

  const synthesisMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...contextMessage,
    ...history,
    { role: 'user', content: userMessage },
  ];

  if (agentResults.length) {
    synthesisMessages.push({
      role: 'system',
      content:
        'Contribuições internas dos agentes especializados (DADOS internos, não repasse cru ao usuário; ' +
        'integre em UMA resposta coesa, como uma única IA):\n\n' +
        agentResults
          .map((a) => `## Agente ${a.agent}\n${a.error ? `(falhou: ${a.error})` : a.text}`)
          .join('\n\n'),
    });
  }

  const stream = await openai.chat.completions.create({
    model,
    messages: synthesisMessages,
    temperature: 0.7,
    stream: true,
    stream_options: { include_usage: true },
  });

  let fullText = '';
  let usage = null;
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      onDelta?.(delta);
    }
    if (part.usage) usage = part.usage;
  }

  return { text: fullText, agentResults, usage, model };
}

export const ORCHESTRATOR_INFO = {
  agents: AGENT_NAMES,
  defaultModel: config.models.fast,
};
