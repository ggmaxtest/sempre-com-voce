import { describe, it, expect } from 'vitest';
import { normalizePlan } from '../src/ai/orchestrator/index.js';
import { getAgentDefinition, AGENT_NAMES } from '../src/ai/agents/index.js';

describe('Orquestrador — normalização de plano', () => {
  it('faz fallback para o agente geral quando o modelo não retorna agentes', () => {
    const p = normalizePlan({}, { userMessage: 'oi' });
    expect(p.agents).toEqual(['general']);
    expect(p.complexity).toBe('simple');
  });

  it('filtra agentes inválidos retornados pelo modelo', () => {
    const p = normalizePlan({ agents: ['copy', 'hacker', 'market'] }, {});
    expect(p.agents).toEqual(['copy', 'market']);
  });

  it('injeta o agente de visão quando há imagem anexada', () => {
    const p = normalizePlan({ agents: ['general'] }, { hasImages: true });
    expect(p.agents).toContain('vision');
  });

  it('injeta o agente de arquivos quando há arquivo anexado', () => {
    const p = normalizePlan({ agents: ['general'] }, { hasFiles: true });
    expect(p.agents.some((a) => a === 'files' || a === 'data')).toBe(true);
  });

  it('aceita plano complexo com múltiplos agentes', () => {
    const p = normalizePlan(
      { complexity: 'complex', agents: ['market', 'competitor', 'copy', 'image'], steps: ['a', 'b'] },
      {},
    );
    expect(p.complexity).toBe('complex');
    expect(p.agents.length).toBe(4);
    expect(p.steps.length).toBe(2);
  });
});

describe('Agentes — menor privilégio de ferramentas', () => {
  it('todo agente conhecido tem definição com prompt e tools', () => {
    for (const name of AGENT_NAMES) {
      const def = getAgentDefinition(name);
      expect(def.prompt).toBeTruthy();
      expect(Array.isArray(def.tools)).toBe(true);
    }
  });

  it('o agente de copy não tem acesso a ferramentas externas', () => {
    expect(getAgentDefinition('copy').tools).toEqual([]);
  });

  it('o agente de imagem só acessa a ferramenta de geração de imagem', () => {
    expect(getAgentDefinition('image').tools).toEqual(['generate_image']);
  });

  it('agente desconhecido cai para o geral com segurança', () => {
    expect(getAgentDefinition('xxx').name).toBe('general');
  });
});
