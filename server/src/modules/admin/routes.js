import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { PROMPT_KEYS } from '../../ai/prompts/index.js';
import { listTools } from '../../ai/tools/registry.js';
import { AGENT_NAMES } from '../../ai/agents/index.js';
import { getIntegrationsStatus } from '../integrations/service.js';
import { hasOpenAI } from '../../config/index.js';
import * as credits from '../credits/service.js';
import * as settings from '../settings/service.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// --- PROMPT BASE GLOBAL (somente Admin) ---
// GET: lê o prompt base atual (começa vazio).
adminRouter.get('/base-prompt', async (req, res, next) => {
  try {
    const value = await settings.getBasePrompt();
    res.json({ basePrompt: value });
  } catch (e) { next(e); }
});

// PUT: define/edita o prompt base global. Vale para TODOS os clientes.
adminRouter.put('/base-prompt', async (req, res, next) => {
  try {
    const schema = z.object({ basePrompt: z.string().max(20000) });
    const { basePrompt } = schema.parse(req.body);
    await settings.setBasePrompt(basePrompt, req.user.id);
    res.json({ ok: true, length: basePrompt.length });
  } catch (e) { next(e); }
});

// --- Usuários ---
adminRouter.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, email: true, name: true, role: true, planTier: true,
        creditBalance: true, isActive: true, createdAt: true,
        _count: { select: { conversations: true, projects: true } },
      },
    });
    res.json({ users });
  } catch (e) { next(e); }
});

adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      role: z.enum(['USER', 'ADMIN']).optional(),
      planTier: z.enum(['FREE', 'PRO', 'PREMIUM']).optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ user: { id: user.id, role: user.role, planTier: user.planTier, isActive: user.isActive } });
  } catch (e) { next(e); }
});

adminRouter.post('/users/:id/credits', async (req, res, next) => {
  try {
    const schema = z.object({ amount: z.number().int() });
    const { amount } = schema.parse(req.body);
    const balance = await credits.grant(req.params.id, amount, 'ADMIN_ADJUST', { by: req.user.id });
    res.json({ balance });
  } catch (e) { next(e); }
});

// --- Projetos (visão agregada) ---
adminRouter.get('/projects', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, name: true, userId: true, createdAt: true },
    });
    res.json({ projects });
  } catch (e) { next(e); }
});

// --- Planos ---
adminRouter.get('/plans', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
    res.json({ plans });
  } catch (e) { next(e); }
});

adminRouter.patch('/plans/:tier', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      monthlyCredits: z.number().int().optional(),
      limits: z.record(z.any()).optional(),
      priceCents: z.number().int().optional(),
      active: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    if (data.limits) data.limits = JSON.stringify(data.limits);
    const plan = await prisma.plan.update({ where: { tier: req.params.tier }, data });
    res.json({ plan });
  } catch (e) { next(e); }
});

// --- Consumo / custos / uso de IA ---
adminRouter.get('/usage', async (req, res, next) => {
  try {
    const [byKind, recent, totals] = await Promise.all([
      prisma.usageEvent.groupBy({
        by: ['kind'],
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, costMicroUsd: true },
      }),
      prisma.usageEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.usageEvent.aggregate({ _sum: { costMicroUsd: true }, _count: { _all: true } }),
    ]);
    res.json({
      byKind,
      recent,
      totalCostUsd: (totals._sum.costMicroUsd || 0) / 1e6,
      totalEvents: totals._count._all,
    });
  } catch (e) { next(e); }
});

adminRouter.get('/errors', async (req, res, next) => {
  try {
    const errors = await prisma.usageEvent.findMany({
      where: { status: 'error' }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json({ errors });
  } catch (e) { next(e); }
});

// --- Agentes e ferramentas (metadados; nunca o conteúdo dos prompts) ---
adminRouter.get('/agents', (req, res) => res.json({ agents: AGENT_NAMES }));
adminRouter.get('/tools', (req, res) => {
  res.json({
    tools: listTools().map((t) => ({
      name: t.name, description: t.description,
      permissions: t.permissions || [], external: Boolean(t.external),
    })),
  });
});

// --- Prompts internos: lista chaves/versões (conteúdo NUNCA é exposto cru) ---
adminRouter.get('/prompts', async (req, res, next) => {
  try {
    const dbPrompts = await prisma.promptTemplate.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      select: { id: true, key: true, version: true, active: true, notes: true, createdAt: true },
    });
    res.json({ builtinKeys: PROMPT_KEYS, versions: dbPrompts });
  } catch (e) { next(e); }
});

// --- Integrações (estado real) ---
adminRouter.get('/integrations', async (req, res, next) => {
  try {
    res.json({ integrations: await getIntegrationsStatus() });
  } catch (e) { next(e); }
});

// --- Health / status dos serviços ---
adminRouter.get('/health', async (req, res) => {
  const checks = { database: 'unknown', openai: hasOpenAI() ? 'configured' : 'missing_key' };
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'ok';
  } catch { checks.database = 'error'; }
  res.json({ checks, time: new Date().toISOString() });
});

// --- Métricas da plataforma ---
adminRouter.get('/metrics', async (req, res, next) => {
  try {
    const [users, projects, conversations, messages, files] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.fileAsset.count(),
    ]);
    res.json({ users, projects, conversations, messages, files });
  } catch (e) { next(e); }
});

export default adminRouter;
