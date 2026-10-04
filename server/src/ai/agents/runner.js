// AGENT RUNNER — executa um agente com acesso às suas ferramentas via function calling.
// Retorna o texto produzido + registro de ferramentas usadas (para observabilidade).
import { z } from 'zod';
import { getOpenAI } from '../providers/openai.js';
import { getTool, runTool } from '../tools/registry.js';
import { getAgentDefinition } from './index.js';
import { selectModel, estimateCostMicroUsd } from '../model-router/index.js';
import { logger } from '../../utils/logger.js';

// Converte um schema zod simples em JSON Schema (suficiente para function calling).
function zodToJsonSchema(schema) {
  // Suporte mínimo para os schemas usados nas tools (objetos planos).
  try {
    const shape = schema?._def?.shape?.() || {};
    const properties = {};
    const requiredArr = [];
    for (const [key, val] of Object.entries(shape)) {
      const def = val?._def;
      let type = 'string';
      if (def?.typeName === 'ZodNumber') type = 'number';
      else if (def?.typeName === 'ZodBoolean') type = 'boolean';
      else if (def?.typeName === 'ZodEnum') type = 'string';
      properties[key] = { type };
      if (def?.typeName === 'ZodEnum') properties[key].enum = def.values;
      const isOptional =
        def?.typeName === 'ZodOptional' || def?.typeName === 'ZodDefault';
      if (!isOptional) requiredArr.push(key);
    }
    return { type: 'object', properties, required: requiredArr };
  } catch {
    return { type: 'object', properties: {} };
  }
}

function toolsForAgent(agentDef) {
  return agentDef.tools
    .map((name) => getTool(name))
    .filter(Boolean)
    .map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.inputSchema),
      },
    }));
}

/**
 * Executa um agente.
 * @param {object} opts
 * @param {string} opts.agentName
 * @param {Array} opts.messages    histórico já montado (sem system do agente)
 * @param {string} opts.complexity
 * @param {object} opts.ctx        { userId, projectId, allow, confirmed, onEvent }
 * @returns {Promise<{text:string, toolRuns:Array, usage:object, model:string}>}
 */
export async function runAgent({ agentName, messages, complexity = 'simple', ctx = {} }) {
  const openai = getOpenAI();
  const agentDef = getAgentDefinition(agentName);
  const model = selectModel({
    kind: agentName === 'vision' ? 'vision' : 'chat',
    complexity,
    needsVision: agentName === 'vision',
  });
  const tools = toolsForAgent(agentDef);

  const convo = [
    { role: 'system', content: agentDef.prompt },
    ...messages,
  ];

  const toolRuns = [];
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  const MAX_ROUNDS = 4;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await openai.chat.completions.create({
      model,
      messages: convo,
      temperature: 0.6,
      ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
    });
    const choice = res.choices?.[0];
    const msg = choice?.message;
    if (res.usage) {
      totalUsage.prompt_tokens += res.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += res.usage.completion_tokens || 0;
    }

    const calls = msg?.tool_calls || [];
    if (!calls.length) {
      return {
        text: msg?.content || '',
        toolRuns,
        usage: totalUsage,
        model,
        costMicroUsd: estimateCostMicroUsd(model, totalUsage),
      };
    }

    // Executa as ferramentas chamadas.
    convo.push(msg);
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        /* ignora args inválidos */
      }
      ctx.onEvent?.({ type: 'tool_start', agent: agentName, tool: call.function.name });
      const result = await runTool(call.function.name, args, ctx);
      toolRuns.push({ tool: call.function.name, ok: result.ok, latencyMs: result.latencyMs });
      // Surfacing de fontes de pesquisa para a UI (e para persistir no histórico).
      if (call.function.name === 'web_search' && result.ok && result.data?.results?.length) {
        ctx.collectSources?.(result.data.results);
        ctx.onEvent?.({ type: 'sources', sources: result.data.results.slice(0, 8) });
      }
      ctx.onEvent?.({ type: 'tool_end', agent: agentName, tool: call.function.name, ok: result.ok });
      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 100000),
      });
    }
  }

  logger.warn({ agent: agentName }, 'Agente atingiu limite de rounds de ferramenta');
  // Última tentativa de resposta textual.
  const final = await openai.chat.completions.create({
    model,
    messages: convo,
    temperature: 0.6,
  });
  return {
    text: final.choices?.[0]?.message?.content || '',
    toolRuns,
    usage: totalUsage,
    model,
    costMicroUsd: estimateCostMicroUsd(model, totalUsage),
  };
}
