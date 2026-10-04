// Definição dos agentes: cada um tem nome, prompt e ferramentas permitidas.
// O Orquestrador seleciona os agentes; o usuário nunca escolhe manualmente.
import { getAgentPrompt } from '../prompts/index.js';

// Mapa de ferramentas permitidas por agente (princípio do menor privilégio).
const AGENT_TOOLS = {
  general: [],
  research: ['web_search', 'fetch_url'],
  market: ['web_search', 'fetch_url'],
  product: ['web_search', 'fetch_url'],
  ads: [],
  competitor: ['web_search', 'fetch_url'],
  marketing: ['marketing_metrics'],
  copy: [],
  data: ['read_file', 'marketing_metrics'],
  image: ['generate_image'],
  vision: [],
  site: ['fetch_url'],
  campaign: ['web_search', 'fetch_url', 'marketing_metrics'],
  files: ['read_file'],
};

export const AGENT_NAMES = Object.keys(AGENT_TOOLS);

export function getAgentDefinition(name) {
  const key = AGENT_NAMES.includes(name) ? name : 'general';
  return {
    name: key,
    prompt: getAgentPrompt(key),
    tools: AGENT_TOOLS[key],
  };
}
