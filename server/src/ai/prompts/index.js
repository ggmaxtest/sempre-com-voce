// Registry de prompts. Server-only. Pode futuramente ler versões do banco (PromptTemplate).
import { SYSTEM_PROMPT } from './system.js';
import { ORCHESTRATOR_PROMPT } from './orchestrator.js';
import { AGENT_PROMPTS, getAgentPrompt } from './agents.js';

export { SYSTEM_PROMPT, ORCHESTRATOR_PROMPT, AGENT_PROMPTS, getAgentPrompt };

// Lista de chaves disponíveis (para o admin visualizar/gerir, sem expor conteúdo ao usuário).
export const PROMPT_KEYS = [
  'system.main',
  'orchestrator',
  ...Object.keys(AGENT_PROMPTS).map((k) => `agent.${k}`),
];
