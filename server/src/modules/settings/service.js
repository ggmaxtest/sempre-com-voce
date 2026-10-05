// Configuração GLOBAL da plataforma — somente Admin edita.
// Inclui o PROMPT BASE GLOBAL da IA (chave 'ai.base_prompt').
// Começa VAZIO. O conteúdo é definido exclusivamente pela dona da plataforma.
import { prisma } from '../../db/client.js';

export const KEYS = {
  BASE_PROMPT: 'ai.base_prompt',
};

// Lê um valor global. Retorna fallback se não existir.
export async function getSetting(key, fallback = '') {
  const row = await prisma.globalSetting.findUnique({ where: { key } });
  return row ? row.value : fallback;
}

// Grava um valor global (upsert). Registra quem alterou.
export async function setSetting(key, value, updatedBy = null) {
  return prisma.globalSetting.upsert({
    where: { key },
    update: { value: value ?? '', updatedBy },
    create: { key, value: value ?? '', updatedBy },
  });
}

// Atalho: Prompt Base Global da IA (string; pode ser vazio).
export async function getBasePrompt() {
  return getSetting(KEYS.BASE_PROMPT, '');
}

export async function setBasePrompt(value, updatedBy = null) {
  return setSetting(KEYS.BASE_PROMPT, value, updatedBy);
}
