import OpenAI from 'openai';
import { config, hasOpenAI } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

let client = null;

export function getOpenAI() {
  if (!hasOpenAI()) {
    throw new AppError(
      'OPENAI_API_KEY não configurada. Preencha no .env para habilitar a IA.',
      503,
      'AI_UNAVAILABLE',
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseUrl,
    });
  }
  return client;
}

// Chat completion simples (não-streaming) — retorna texto.
export async function chat({ model, messages, temperature = 0.7, responseFormat }) {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  });
  return {
    text: res.choices?.[0]?.message?.content ?? '',
    usage: res.usage ?? null,
  };
}

// Chat completion em streaming — retorna um async iterator de chunks de texto.
export async function* chatStream({ model, messages, temperature = 0.7 }) {
  const openai = getOpenAI();
  const stream = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    stream: true,
    stream_options: { include_usage: true },
  });
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) yield { type: 'delta', text: delta };
    if (part.usage) yield { type: 'usage', usage: part.usage };
  }
}

export async function embed({ model, input }) {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({ model, input });
  return res.data.map((d) => d.embedding);
}

export async function generateImage({ model, prompt, size = '1024x1024', n = 1 }) {
  const openai = getOpenAI();
  const res = await openai.images.generate({ model, prompt, size, n });
  // Retorna base64 ou url conforme o modelo.
  return res.data.map((d) => ({ b64: d.b64_json || null, url: d.url || null }));
}
