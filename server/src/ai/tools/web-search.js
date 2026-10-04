// Ferramenta de pesquisa na web — REAL, com drivers plugáveis.
// Drivers: tavily (API oficial), serpapi (API oficial), none (desabilitada honestamente).
import { z } from 'zod';
import { config } from '../../config/index.js';

const inputSchema = z.object({
  query: z.string().min(2).max(400),
  maxResults: z.number().int().min(1).max(10).default(5),
});

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
  return (json.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    date: r.published_date || null,
    source: new URL(r.url).hostname,
  }));
}

async function searchSerpApi(query, maxResults) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', config.search.serpApiKey);
  url.searchParams.set('num', String(maxResults));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi respondeu ${res.status}`);
  const json = await res.json();
  return (json.organic_results || []).slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    date: r.date || null,
    source: r.source || (r.link ? new URL(r.link).hostname : null),
  }));
}

export const webSearchTool = {
  name: 'web_search',
  description:
    'Pesquisa informações atuais na web e retorna fontes (título, URL, data). Use quando a resposta depender de atualidade.',
  permissions: ['search'],
  external: false,
  inputSchema,
  async execute({ query, maxResults }) {
    const driver = config.search.driver;
    if (driver === 'none' || (driver === 'tavily' && !config.search.tavilyApiKey) ||
        (driver === 'serpapi' && !config.search.serpApiKey)) {
      // Honestidade: ferramenta indisponível, sem inventar resultados.
      return {
        available: false,
        results: [],
        note:
          'Pesquisa na web indisponível: nenhuma chave de busca configurada (SEARCH_DRIVER=none). Configure TAVILY_API_KEY ou SERPAPI_API_KEY para habilitar.',
      };
    }
    const results =
      driver === 'serpapi'
        ? await searchSerpApi(query, maxResults)
        : await searchTavily(query, maxResults);
    return { available: true, query, results };
  },
};
