// Estado REAL das integrações externas. Nada é falso: se não há credencial,
// o status é PENDING e a interface mostra "indisponível".
import { config } from '../../config/index.js';

const PROVIDERS = [
  { provider: 'meta_ads', label: 'Meta Ads / Ad Library', hasKey: () => Boolean(config.integrations.metaAccessToken) },
  { provider: 'google_ads', label: 'Google Ads', hasKey: () => Boolean(config.integrations.googleAdsDeveloperToken) },
  { provider: 'tiktok', label: 'TikTok', hasKey: () => Boolean(config.integrations.tiktokAccessToken) },
  {
    provider: 'web_search',
    label: 'Pesquisa na Web',
    hasKey: () => {
      const d = config.search.driver;
      if (d === 'openai') return Boolean(config.openai.apiKey);
      if (d === 'tavily') return Boolean(config.search.tavilyApiKey);
      if (d === 'serpapi') return Boolean(config.search.serpApiKey);
      return false;
    },
  },
  { provider: 'openai', label: 'OpenAI (modelos de IA)', hasKey: () => Boolean(config.openai.apiKey) },
];

export async function getIntegrationsStatus() {
  return PROVIDERS.map((p) => ({
    provider: p.provider,
    label: p.label,
    status: p.hasKey() ? 'CONNECTED' : 'PENDING',
    note: p.hasKey() ? 'Credenciais presentes.' : 'Pendente: credenciais não configuradas.',
  }));
}
