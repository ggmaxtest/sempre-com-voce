import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound, AppError } from '../../utils/errors.js';
import { plan as buildPlan, execute as runPlan } from '../../ai/orchestrator/index.js';
import { recall, remember } from '../../ai/memory/index.js';
import { recordUsage } from '../usage/service.js';
import * as credits from '../credits/service.js';
import { estimateCostMicroUsd, selectModel } from '../../ai/model-router/index.js';
import { hasOpenAI } from '../../config/index.js';
import { parseJSON } from '../../utils/json.js';
import { chatStream } from '../../ai/providers/openai.js';
import {
  buildQuickActionMessages,
  QUICK_ACTION_KEYS,
  QUICK_ACTION_CATALOG,
} from '../../ai/prompts/quick-actions.js';
import * as taskService from '../tasks/service.js';

export const chatRouter = Router();

// --- Conversas (histórico) ---
chatRouter.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.conversation.findMany({
      where: { userId: req.user.id, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, projectId: true, createdAt: true, updatedAt: true },
    });
    res.json({ conversations: items });
  } catch (e) { next(e); }
});

chatRouter.get('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const convo = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo) throw NotFound('Conversa não encontrada.');
    convo.messages = convo.messages.map((m) => ({
      ...m,
      meta: parseJSON(m.meta, {}),
      attachments: parseJSON(m.attachments, []),
    }));
    res.json({ conversation: convo });
  } catch (e) { next(e); }
});

chatRouter.patch('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ title: z.string().min(1).max(200) });
    const { title } = schema.parse(req.body);
    const result = await prisma.conversation.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { title },
    });
    if (!result.count) throw NotFound('Conversa não encontrada.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

chatRouter.delete('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await prisma.conversation.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!result.count) throw NotFound('Conversa não encontrada.');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// --- Envio de mensagem com streaming (SSE) ---
const sendSchema = z.object({
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
  message: z.string().min(1).max(20000),
  attachments: z.array(z.string()).optional(), // fileIds
  confirmed: z.boolean().optional(),
});

chatRouter.post('/send', requireAuth, async (req, res, next) => {
  let task = null; // escopo externo p/ o catch poder finalizar a tarefa
  try {
    if (!hasOpenAI()) {
      throw new AppError('IA indisponível: configure OPENAI_API_KEY.', 503, 'AI_UNAVAILABLE');
    }
    const body = sendSchema.parse(req.body);
    const userId = req.user.id;

    // Verifica créditos ANTES (sem debitar ainda).
    if (!(await credits.hasCredits(userId, credits.CREDIT_COSTS.CHAT))) {
      throw new AppError('Créditos insuficientes.', 402, 'INSUFFICIENT_CREDITS');
    }

    // Resolve/garante conversa (isolada por usuário).
    let conversation;
    if (body.conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: body.conversationId, userId },
      });
      if (!conversation) throw NotFound('Conversa não encontrada.');
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          projectId: body.projectId || null,
          title: body.message.slice(0, 60),
        },
      });
    }

    // Projeto (contexto automático).
    let project = null;
    if (conversation.projectId) {
      project = await prisma.project.findFirst({
        where: { id: conversation.projectId, userId },
      });
    }

    // Anexos: valida posse e separa imagens.
    let attachmentAssets = [];
    if (body.attachments?.length) {
      attachmentAssets = await prisma.fileAsset.findMany({
        where: { id: { in: body.attachments }, userId },
      });
    }
    const hasImages = attachmentAssets.some((a) => a.kind === 'image');
    const hasFiles = attachmentAssets.some((a) => a.kind !== 'image');

    // Persiste a mensagem do usuário.
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: body.message,
        attachments: JSON.stringify(attachmentAssets.map((a) => ({ id: a.id, filename: a.filename, kind: a.kind }))),
      },
    });

    // Histórico recente (limitado para controlar contexto/custo).
    const prior = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const history = prior
      .reverse()
      .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
      .slice(0, -1) // remove a mensagem atual (já será enviada separadamente)
      .map((m) => ({ role: m.role.toLowerCase(), content: m.content }));

    // Memória relevante.
    const memory = await recall({
      userId,
      projectId: conversation.projectId,
      query: body.message,
      limit: 6,
    }).catch(() => []);

    // --- Inicia SSE ---
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event, data) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    send('meta', { conversationId: conversation.id });

    const started = Date.now();

    // 1) Planejamento (orquestrador).
    send('status', { status: 'analisando' });
    const planObj = await buildPlan({
      userMessage: body.message,
      projectName: project?.name,
      hasFiles,
      hasImages,
    });
    send('plan', {
      intent: planObj.intent,
      agents: planObj.agents,
      complexity: planObj.complexity,
    });

    // #13 Central de Tarefas: tarefas complexas viram Task REAL com eventos reais.
    if (planObj.complexity === 'complex' && !planObj.clarificationNeeded) {
      const planSteps = (planObj.steps?.length ? planObj.steps : planObj.agents).map((s, i) => ({
        index: i, label: typeof s === 'string' ? s : `Etapa ${i + 1}`, status: 'pending',
      }));
      task = await taskService.createTask({
        userId,
        projectId: conversation.projectId,
        conversationId: conversation.id,
        goal: body.message.slice(0, 500),
        plan: planSteps,
      }).catch(() => null);
      if (task) {
        await taskService.setStatus(task.id, taskService.TASK_STATUS.RUNNING).catch(() => {});
        send('task', { id: task.id, goal: body.message.slice(0, 120), plan: planSteps });
      }
    }

    // Clarification: devolve pergunta sem executar.
    if (planObj.clarificationNeeded) {
      send('status', { status: 'aguardando' });
      const clarifyText = planObj.clarificationNeeded;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: clarifyText,
          meta: JSON.stringify({ clarification: true, plan: planObj }),
        },
      });
      send('delta', { text: clarifyText });
      send('done', { conversationId: conversation.id, clarification: true });
      return res.end();
    }

    // Permissões por plano (todas liberadas por padrão neste build).
    const allow = new Set(['search', 'image', 'files']);

    // 2) Execução + síntese em streaming.
    const collectedSources = [];
    const seenSrc = new Set();
    const ctx = {
      userId,
      projectId: conversation.projectId,
      allow,
      confirmed: Boolean(body.confirmed),
      project,
      memory,
      onEvent: (ev) => {
        send('event', ev);
        // Registra eventos REAIS na tarefa (nunca fictício).
        if (task) {
          if (ev.type === 'agent_start') {
            taskService.addEvent(task.id, { type: 'AGENT_RUN', label: `Agente ${ev.agent} em execução`, status: 'running' }).catch(() => {});
          } else if (ev.type === 'agent_end') {
            taskService.addEvent(task.id, { type: 'STEP_COMPLETED', label: `Agente ${ev.agent} concluído`, status: 'done' }).catch(() => {});
          } else if (ev.type === 'tool_end') {
            taskService.addEvent(task.id, { type: 'TOOL_EXECUTED', label: `Ferramenta ${ev.tool} ${ev.ok ? 'ok' : 'falhou'}`, status: ev.ok ? 'done' : 'failed', data: { tool: ev.tool } }).catch(() => {});
          } else if (ev.type === 'status' && ev.status === 'validando') {
            taskService.addEvent(task.id, { type: 'VALIDATION', label: 'Validando e sintetizando resultado', status: 'running' }).catch(() => {});
          }
        }
      },
      collectSources: (list) => {
        for (const s of list) {
          if (s?.url && !seenSrc.has(s.url)) { seenSrc.add(s.url); collectedSources.push(s); }
        }
      },
    };

    const result = await runPlan({
      history,
      userMessage: body.message,
      plan: planObj,
      ctx,
      onDelta: (text) => send('delta', { text }),
    });

    // 3) Persiste resposta.
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: result.text,
        meta: JSON.stringify({
          agents: planObj.agents,
          agentResults: result.agentResults?.map((a) => ({ agent: a.agent, ok: !a.error })),
          model: result.model,
          sources: collectedSources.slice(0, 8),
        }),
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // 4) Débito de créditos (após produzir resultado) + registro de uso.
    const latencyMs = Date.now() - started;
    try {
      await credits.debit(userId, 'CHAT', credits.CREDIT_COSTS.CHAT, {
        conversationId: conversation.id,
      });
    } catch { /* saldo mudou no meio; não bloqueia a resposta já entregue */ }

    await recordUsage({
      userId,
      projectId: conversation.projectId,
      kind: 'chat',
      model: result.model,
      agent: planObj.agents.join(','),
      usage: result.usage,
      costMicroUsd: estimateCostMicroUsd(result.model, result.usage),
      latencyMs,
    });

    // 5) Memória: guarda um resumo curto do turno (para contexto futuro).
    if (planObj.complexity === 'complex') {
      remember({
        userId,
        projectId: conversation.projectId,
        scope: conversation.projectId ? 'PROJECT' : 'USER',
        content: `Pedido: ${body.message.slice(0, 200)}`,
        importance: 1.5,
      }).catch(() => {});
    }

    // Finaliza a tarefa (se houver) com status real.
    if (task) {
      await taskService.addEvent(task.id, { type: 'COMPLETED', label: 'Resultado entregue', status: 'done' }).catch(() => {});
      await taskService.setStatus(task.id, taskService.TASK_STATUS.COMPLETED, {
        result: { messagePreview: result.text.slice(0, 300), agents: planObj.agents },
      }).catch(() => {});
      send('task_done', { id: task.id, status: 'COMPLETED' });
    }

    send('done', { conversationId: conversation.id, creditsLeft: await credits.getBalance(userId) });
    res.end();
  } catch (e) {
    // Marca a tarefa como falha, se já criada.
    if (task) {
      await taskService.addEvent(task.id, { type: 'FAILED', label: 'Falha na execução', status: 'failed', data: { error: e.message } }).catch(() => {});
      await taskService.setStatus(task.id, taskService.TASK_STATUS.FAILED, { error: e.message }).catch(() => {});
    }
    // Se o SSE já começou, envia erro pelo stream; senão, delega ao handler.
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`);
      return res.end();
    }
    next(e);
  }
});

// --- #15 AÇÕES RÁPIDAS ---------------------------------------------------
// Catálogo (seguro para o frontend; sem instruções internas).
chatRouter.get('/quick-actions', requireAuth, (req, res) => {
  res.json({ actions: QUICK_ACTION_CATALOG });
});

const refineSchema = z.object({
  conversationId: z.string().optional(),
  messageId: z.string().optional(),        // id da mensagem original (quando persistida)
  content: z.string().min(1).max(30000),   // conteúdo original (preservado)
  action: z.enum(QUICK_ACTION_KEYS),
  context: z.string().max(4000).optional(),
});

// Refina um conteúdo existente com uma ação rápida. Streaming (SSE).
// Preserva o original: cria uma NOVA mensagem assistant com o resultado.
chatRouter.post('/refine', requireAuth, async (req, res, next) => {
  try {
    if (!hasOpenAI()) {
      throw new AppError('IA indisponível: configure OPENAI_API_KEY.', 503, 'AI_UNAVAILABLE');
    }
    const body = refineSchema.parse(req.body);
    const userId = req.user.id;

    if (!(await credits.hasCredits(userId, credits.CREDIT_COSTS.CHAT))) {
      throw new AppError('Créditos insuficientes.', 402, 'INSUFFICIENT_CREDITS');
    }

    // Conversa é opcional: ações rápidas funcionam mesmo em conteúdo avulso.
    let conversation = null;
    if (body.conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: body.conversationId, userId },
      });
      if (!conversation) throw NotFound('Conversa não encontrada.');
    }

    const messages = buildQuickActionMessages(body.action, body.content, body.context);
    if (!messages) throw new AppError('Ação inválida.', 400, 'BAD_REQUEST');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event, data) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    send('status', { status: 'processando', action: body.action });

    const model = selectModel({ kind: 'chat', complexity: 'simple' });
    const started = Date.now();
    let fullText = '';
    let usage = null;
    try {
      for await (const chunk of chatStream({ model, messages, temperature: 0.7 })) {
        if (chunk.type === 'delta') { fullText += chunk.text; send('delta', { text: chunk.text }); }
        else if (chunk.type === 'usage') usage = chunk.usage;
      }
    } catch (e) {
      send('error', { message: 'Falha ao processar a ação: ' + e.message });
      return res.end();
    }

    // Persiste como NOVA mensagem (não destrói o original) quando há conversa.
    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: fullText,
          meta: JSON.stringify({ quickAction: body.action, refinedFrom: body.messageId || null }),
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    }

    try {
      await credits.debit(userId, 'CHAT', credits.CREDIT_COSTS.CHAT, { quickAction: body.action });
    } catch { /* saldo mudou; não bloqueia resultado já entregue */ }

    await recordUsage({
      userId,
      projectId: conversation?.projectId,
      kind: 'chat',
      model,
      agent: `quick:${body.action}`,
      usage,
      costMicroUsd: estimateCostMicroUsd(model, usage),
      latencyMs: Date.now() - started,
    });

    send('done', { creditsLeft: await credits.getBalance(userId) });
    res.end();
  } catch (e) {
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`);
      return res.end();
    }
    next(e);
  }
});

export default chatRouter;
