import { describe, it, expect } from 'vitest';
import { TASK_STATUS } from '../src/modules/tasks/service.js';

describe('Central de Tarefas — contrato de status', () => {
  it('expõe os estados esperados', () => {
    expect(TASK_STATUS.PENDING).toBe('PENDING');
    expect(TASK_STATUS.RUNNING).toBe('RUNNING');
    expect(TASK_STATUS.COMPLETED).toBe('COMPLETED');
    expect(TASK_STATUS.FAILED).toBe('FAILED');
    expect(TASK_STATUS.CANCELLED).toBe('CANCELLED');
    expect(TASK_STATUS.WAITING).toBe('WAITING_CONFIRMATION');
  });
});
