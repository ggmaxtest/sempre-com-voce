// Ferramenta de pesquisa na web — REAL, com drivers plugáveis.
// Drivers:
//   openai  (padrão) → usa a pesquisa NATIVA da OpenAI (Responses API, web_search).
//                      Só precisa da OPENAI_API_KEY. Retorna texto + fontes com citação.
//   tavily            → API oficial da Tavily (requer TAVILY_API_KEY).
//   serpapi           → API oficial da SerpApi (requer SERPAPI_API_KEY).
//   none              → desabilitada honestamente (sem inventar resultados).
import { z } from 'zod';
import { config, hasOpenAI } from '../../config/index.js';
import { webSearch as openaiWebSearch } from '../providers/openai.js';

const inputSchema = z.object({
  query: z.string().min(2).max(400),
  maxResults: z.number().int().min(1).max(10).default(5),
});

async function searchOpenAI(query) {
  const model = config.models.search || config.models.smart;
  const { text, sources } = await openaiWebSearch({ model, query });
  return {
    answer: text,          // resposta sintetizada pela OpenAI já com base nas fontes
    results: sources,      // [{ title, url, source }]
  };
}

async function searchTavily(query, maxResults) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.search.tavilyApiKey,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily respondeu ${res.status}`);
  const json = await res.json();
  return {
    answer: null,
    results: (json.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      date: r.published_date || null,
      source: safeHost(r.url),
    })),
  };
}

async function searchSerpApi(query, maxResults) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', config.search.serpApiKey);
  url.searchParams.set('num', String(maxResults));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi respondeu ${res.status}`);
  const json = await res.json();
  return {
    answer: null,
    results: (json.organic_results || []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      date: r.date || null,
      source: r.source || safeHost(r.link),
    })),
  };
}

function safeHost(u) {
  try { return new URL(u).hostname; } catch { return null; }
}

// Resolve o driver efetivo e se está disponível.
function resolveDriver() {
  const driver = config.search.driver;
  if (driver === 'openai') return hasOpenAI() ? 'openai' : 'unavailable';
  if (driver === 'tavily') return config.search.tavilyApiKey ? 'tavily' : 'unavailable';
  if (driver === 'serpapi') return config.search.serpApiKey ? 'serpapi' : 'unavailable';
  return 'unavailable'; // none
}

export const webSearchTool = {
  name: 'web_search',
  description:
    'Pesquisa informações atuais na web e retorna fontes (título, URL). Use quando a resposta depender de atualidade.',
  permissions: ['search'],
  external: false,
  inputSchema,
  async execute({ query, maxResults }) {
    const driver = resolveDriver();
    if (driver === 'unavailable') {
      // Honestidade: ferramenta indisponível, sem inventar resultados.
      return {
        available: false,
        results: [],
        note:
          'Pesquisa na web indisponível. Defina SEARCH_DRIVER=openai (usa a OPENAI_API_KEY) ' +
          'ou configure TAVILY_API_KEY / SERPAPI_API_KEY.',
      };
    }

    let data;
    if (driver === 'openai') data = await searchOpenAI(query);
    else if (driver === 'serpapi') data = await searchSerpApi(query, maxResults);
    else data = await searchTavily(query, maxResults);

    return { available: true, driver, query, answer: data.answer, results: data.results };
  },
};
