// Cliente HTTP para a API. Usa cookie httpOnly (credentials) + fallback de token.
const BASE = '/api';

let authToken = localStorage.getItem('scv_token') || null;

export function setToken(t) {
  authToken = t;
  if (t) localStorage.setItem('scv_token', t);
  else localStorage.removeItem('scv_token');
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

async function handle(res) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Erro na requisição');
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => fetch(BASE + path, { headers: headers(), credentials: 'include' }).then(handle),
  post: (path, body) =>
    fetch(BASE + path, { method: 'POST', headers: headers(), credentials: 'include', body: JSON.stringify(body || {}) }).then(handle),
  patch: (path, body) =>
    fetch(BASE + path, { method: 'PATCH', headers: headers(), credentials: 'include', body: JSON.stringify(body || {}) }).then(handle),
  del: (path) => fetch(BASE + path, { method: 'DELETE', headers: headers(), credentials: 'include' }).then(handle),
  upload: (path, formData) =>
    fetch(BASE + path, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      credentials: 'include',
      body: formData,
    }).then(handle),
};

/**
 * Envia uma mensagem de chat e consome o stream SSE.
 * @param {object} body
 * @param {object} handlers { onMeta, onStatus, onPlan, onEvent, onDelta, onDone, onError }
 */
export async function sendChat(body, handlers = {}) {
  const res = await fetch(BASE + '/chat/send', {
    method: 'POST',
    headers: headers(),
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let message = 'Falha ao enviar mensagem.';
    try { const j = await res.json(); message = j?.error?.message || message; } catch {}
    handlers.onError?.({ message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed; try { parsed = JSON.parse(data); } catch { continue; }
      switch (event) {
        case 'meta': handlers.onMeta?.(parsed); break;
        case 'status': handlers.onStatus?.(parsed); break;
        case 'plan': handlers.onPlan?.(parsed); break;
        case 'event': handlers.onEvent?.(parsed); break;
        case 'delta': handlers.onDelta?.(parsed.text); break;
        case 'done': handlers.onDone?.(parsed); break;
        case 'error': handlers.onError?.(parsed); break;
      }
    }
  }
}

/**
 * #15 Ações rápidas — refina um conteúdo via SSE.
 * handlers: { onStatus, onDelta, onDone, onError }
 */
export async function refineContent(body, handlers = {}) {
  const res = await fetch(BASE + '/chat/refine', {
    method: 'POST',
    headers: headers(),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let message = 'Falha ao processar a ação.';
    try { const j = await res.json(); message = j?.error?.message || message; } catch {}
    handlers.onError?.({ message });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      let event = 'message'; let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed; try { parsed = JSON.parse(data); } catch { continue; }
      if (event === 'status') handlers.onStatus?.(parsed);
      else if (event === 'delta') handlers.onDelta?.(parsed.text);
      else if (event === 'done') handlers.onDone?.(parsed);
      else if (event === 'error') handlers.onError?.(parsed);
    }
  }
}

// Catálogo de ações rápidas (seguro; sem instruções internas).
export function getQuickActions() {
  return api.get('/chat/quick-actions');
}
