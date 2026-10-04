// Perfil de Marca (#21) — "o jeito do negócio".
// Persiste de verdade; a IA usa automaticamente. Nunca inventa que memorizou.
import { prisma } from '../../db/client.js';

// Campos editáveis do perfil (rótulos para montar o contexto da IA).
export const BRAND_FIELDS = [
  ['name', 'Nome da marca'],
  ['products', 'Produtos/serviços'],
  ['pricing', 'Preços'],
  ['audience', 'Público-alvo'],
  ['positioning', 'Posicionamento'],
  ['differentials', 'Diferenciais'],
  ['toneOfVoice', 'Tom de voz'],
  ['visualStyle', 'Estilo visual'],
  ['objectives', 'Objetivos'],
  ['competitors', 'Concorrentes'],
  ['rules', 'Regras da marca'],
  ['approvedExamples', 'Exemplos aprovados'],
  ['avoidExamples', 'Exemplos a evitar'],
];

const EDITABLE = BRAND_FIELDS.map(([k]) => k);

export async function getBrand(userId, projectId = null) {
  return prisma.brandProfile.findFirst({
    where: { userId, projectId: projectId || null },
  });
}

export async function upsertBrand(userId, projectId, data) {
  // Sanitiza: só campos permitidos, strings.
  const clean = {};
  for (const k of EDITABLE) {
    if (k in data) clean[k] = data[k] === '' ? null : String(data[k]).slice(0, 4000);
  }
  const existing = await getBrand(userId, projectId);
  if (existing) {
    return prisma.brandProfile.update({ where: { id: existing.id }, data: clean });
  }
  return prisma.brandProfile.create({
    data: { userId, projectId: projectId || null, ...clean },
  });
}

export async function clearBrand(userId, projectId = null) {
  const existing = await getBrand(userId, projectId);
  if (existing) await prisma.brandProfile.delete({ where: { id: existing.id } });
  return true;
}

/**
 * Monta um bloco de contexto textual com os campos preenchidos da marca.
 * Retorna null se não houver nada relevante. Usado pelo orquestrador.
 */
export function renderBrandContext(brand) {
  if (!brand) return null;
  const lines = [];
  for (const [key, label] of BRAND_FIELDS) {
    const v = brand[key];
    if (v && String(v).trim()) lines.push(`- ${label}: ${String(v).trim()}`);
  }
  if (!lines.length) return null;
  return `Perfil da marca/negócio (use para alinhar tom, ofertas e exemplos; não invente além disto):\n${lines.join('\n')}`;
}

// Busca o perfil relevante: tenta o do projeto; se vazio, cai para o global do usuário.
export async function getEffectiveBrand(userId, projectId) {
  if (projectId) {
    const p = await getBrand(userId, projectId);
    if (p) return p;
  }
  return getBrand(userId, null);
}
