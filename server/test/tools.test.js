import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllTools, listTools, runTool, getTool } from '../src/ai/tools/index.js';

beforeAll(() => registerAllTools());

describe('Tool registry', () => {
  it('registra as ferramentas esperadas', () => {
    const names = listTools().map((t) => t.name);
    expect(names).toContain('web_search');
    expect(names).toContain('generate_image');
    expect(names).toContain('read_file');
    expect(names).toContain('fetch_url');
    expect(names).toContain('marketing_metrics');
  });

  it('cada ferramenta tem contrato completo', () => {
    for (const t of listTools()) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(typeof t.execute).toBe('function');
    }
  });
});

describe('marketing_metrics (determinística)', () => {
  it('calcula métricas corretamente', async () => {
    const r = await runTool('marketing_metrics', {
      impressions: 10000, clicks: 200, spend: 100, purchases: 10, revenue: 500,
    });
    expect(r.ok).toBe(true);
    expect(r.data.metrics.CPM).toBe(10); // 100/10000*1000
    expect(r.data.metrics.CPC).toBe(0.5); // 100/200
    expect(r.data.metrics.CTR).toBe(2); // 200/10000*100
    expect(r.data.metrics.CPA).toBe(10); // 100/10
    expect(r.data.metrics.ROAS).toBe(5); // 500/100
    expect(r.data.metrics.ROI).toBe(400); // (500-100)/100*100
    expect(r.data.metrics.conversionRate).toBe(5); // 10/200*100
  });

  it('reporta dados insuficientes sem inventar', async () => {
    const r = await runTool('marketing_metrics', { impressions: 1000 });
    expect(r.ok).toBe(true);
    expect(r.data.metrics.CPC).toBeNull();
    expect(r.data.notes.length).toBeGreaterThan(0);
  });
});

describe('web_search (honestidade quando desabilitada)', () => {
  it('retorna available=false sem inventar resultados', async () => {
    const r = await runTool('web_search', { query: 'teste', maxResults: 3 });
    expect(r.ok).toBe(true);
    // Com SEARCH_DRIVER=none (default), não deve inventar.
    if (!r.data.available) {
      expect(r.data.results).toEqual([]);
      expect(r.data.note).toContain('indisponível');
    }
  });
});

describe('fetch_url (SSRF guard)', () => {
  it('bloqueia hosts internos', async () => {
    const r = await runTool('fetch_url', { url: 'http://localhost:3001/secret' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/bloqueado/i);
  });
});
