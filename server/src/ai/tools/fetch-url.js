// Ferramenta de busca de conteúdo de uma URL pública — REAL.
// Usada por auditoria de site e análise de concorrente.
// SEGURANÇA: o conteúdo retornado é DADO. O orquestrador/agentes o tratam
// como dado, nunca como instrução (proteção contra prompt injection).
import { z } from 'zod';

const inputSchema = z.object({
  url: z.string().url(),
  maxChars: z.number().int().min(500).max(100000).default(40000),
});

// Bloqueia alvos internos/privados (SSRF básico).
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(h)) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.endsWith('.internal') || h.endsWith('.local')) return true;
  return false;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const fetchUrlTool = {
  name: 'fetch_url',
  description:
    'Busca o conteúdo público de uma URL (para auditoria de página ou análise de concorrente). Retorna texto extraído.',
  permissions: ['search'],
  external: false,
  inputSchema,
  async execute({ url, maxChars }) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Apenas http/https são permitidos.');
    }
    if (isBlockedHost(parsed.hostname)) {
      throw new Error('Host bloqueado por segurança.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'SempreComVoce-Bot/1.0 (+auditoria)' },
      });
      const contentType = res.headers.get('content-type') || '';
      const raw = await res.text();
      const text = contentType.includes('html') ? stripHtml(raw) : raw;
      return {
        url,
        status: res.status,
        contentType,
        // Marcado explicitamente como dado externo não confiável.
        externalData: true,
        text: text.slice(0, maxChars),
        truncated: text.length > maxChars,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
