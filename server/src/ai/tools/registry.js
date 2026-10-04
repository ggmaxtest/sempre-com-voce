// TOOL REGISTRY — arquitetura extensível de ferramentas.
// Cada ferramenta tem: nome, descrição, schema (zod), validação, execução,
// tratamento de erro, retorno estruturado e permissões.
// Adicionar novas ferramentas não exige reescrever o Orquestrador.

import { logger } from '../../utils/logger.js';

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {import('zod').ZodTypeAny} inputSchema
 * @property {string[]} [permissions]      // ex: ['search'], ['image']
 * @property {boolean} [external]           // true = ação externa (pode exigir confirmação)
 * @property {boolean} [destructive]        // true = exige confirmação explícita
 * @property {(input:any, ctx:any)=>Promise<any>} execute
 */

const _tools = new Map();

export function registerTool(tool) {
  if (!tool?.name) throw new Error('Tool sem nome');
  if (_tools.has(tool.name)) throw new Error(`Tool duplicada: ${tool.name}`);
  _tools.set(tool.name, tool);
  return tool;
}

export function getTool(name) {
  return _tools.get(name);
}

export function listTools() {
  return [..._tools.values()];
}

export function toolCatalog() {
  // Descrição textual para o Orquestrador (nunca inclui lógica interna).
  return listTools()
    .map((t) => `- ${t.name}: ${t.description}${t.external ? ' [externa]' : ''}`)
    .join('\n');
}

/**
 * Executa uma ferramenta com validação, permissões e tratamento de erro.
 * Retorno SEMPRE estruturado: { ok, data?, error? }.
 */
export async function runTool(name, rawInput, ctx = {}) {
  const tool = getTool(name);
  if (!tool) return { ok: false, error: `Ferramenta desconhecida: ${name}` };

  // Permissões (ex.: por plano/role). ctx.allow é um Set opcional.
  if (tool.permissions && ctx.allow instanceof Set) {
    const missing = tool.permissions.filter((p) => !ctx.allow.has(p));
    if (missing.length) {
      return { ok: false, error: `Sem permissão para: ${missing.join(', ')}` };
    }
  }

  // Ações destrutivas/externas exigem confirmação a menos que já confirmada.
  if ((tool.destructive || tool.external) && !ctx.confirmed) {
    return {
      ok: false,
      needsConfirmation: true,
      error: `A ferramenta "${name}" executa uma ação externa e requer confirmação do usuário.`,
    };
  }

  // Validação de entrada.
  let input;
  try {
    input = tool.inputSchema ? tool.inputSchema.parse(rawInput) : rawInput;
  } catch (e) {
    return { ok: false, error: `Entrada inválida para ${name}: ${e.message}` };
  }

  const started = Date.now();
  try {
    const data = await tool.execute(input, ctx);
    return { ok: true, data, latencyMs: Date.now() - started };
  } catch (e) {
    logger.warn({ tool: name, err: e.message }, 'Falha na execução da ferramenta');
    return { ok: false, error: e.message, latencyMs: Date.now() - started };
  }
}
