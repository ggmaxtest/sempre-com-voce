// CENTRAL DE TAREFAS (#13) — tarefas e eventos REAIS.
// O progresso reflete etapas de fato executadas pelo backend. Nunca fictício.
import { prisma } from '../../db/client.js';
import { parseJSON } from '../../utils/json.js';

export const TASK_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING_CONFIRMATION',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

export async function createTask({ userId, projectId, conversationId, goal, plan = [] }) {
  const task = await prisma.task.create({
    data: {
      userId,
      projectId: projectId || null,
      conversationId: conversationId || null,
      goal,
      status: TASK_STATUS.PENDING,
      plan: JSON.stringify(plan),
      state: JSON.stringify({ currentStep: 0, totalSteps: plan.length }),
    },
  });
  await addEvent(task.id, { type: 'TASK_CREATED', label: 'Tarefa criada', status: 'done', data: { goal } });
  return task;
}

export async function setStatus(taskId, status, extra = {}) {
  const data = { status, updatedAt: new Date() };
  if (extra.result !== undefined) data.result = JSON.stringify(extra.result);
  if (extra.error !== undefined) data.error = extra.error ? String(extra.error).slice(0, 1000) : null;
  if (extra.state !== undefined) data.state = JSON.stringify(extra.state);
  await prisma.task.update({ where: { id: taskId }, data });
}

export async function addEvent(taskId, { type, label, status = 'done', data = {} }) {
  return prisma.taskEvent.create({
    data: { taskId, type, label, status, data: JSON.stringify(data) },
  });
}

export async function getTask(taskId, userId) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!task) return null;
  return serialize(task);
}

export async function listTasks(userId, { limit = 50 } = {}) {
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  return tasks.map(serialize);
}

export async function cancelTask(taskId, userId) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return null;
  if ([TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED].includes(task.status)) {
    return serialize({ ...task, events: [] });
  }
  await setStatus(taskId, TASK_STATUS.CANCELLED);
  await addEvent(taskId, { type: 'CANCELLED', label: 'Tarefa cancelada pelo usuário', status: 'done' });
  return getTask(taskId, userId);
}

function serialize(task) {
  return {
    ...task,
    plan: parseJSON(task.plan, []),
    state: parseJSON(task.state, {}),
    result: task.result ? parseJSON(task.result, null) : null,
    events: (task.events || []).map((e) => ({ ...e, data: parseJSON(e.data, {}) })),
  };
}
