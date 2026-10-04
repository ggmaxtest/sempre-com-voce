// Ferramenta de cálculo de métricas de marketing — REAL (determinística).
// Evita que a IA "chute" cálculos: números vêm daqui.
import { z } from 'zod';

const inputSchema = z.object({
  impressions: z.number().nonnegative().optional(),
  reach: z.number().nonnegative().optional(),
  clicks: z.number().nonnegative().optional(),
  spend: z.number().nonnegative().optional(),
  addToCart: z.number().nonnegative().optional(),
  checkouts: z.number().nonnegative().optional(),
  purchases: z.number().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
});

const round = (n, d = 2) =>
  n === null || n === undefined || !isFinite(n) ? null : Number(n.toFixed(d));

export const marketingCalcTool = {
  name: 'marketing_metrics',
  description:
    'Calcula métricas de marketing (CPM, CPC, CTR, CPA, ROAS, ROI, conversão) a partir de números fornecidos. Determinístico.',
  permissions: [],
  external: false,
  inputSchema,
  async execute(m) {
    const { impressions, clicks, spend, purchases, revenue } = m;
    const out = {
      inputs: m,
      metrics: {
        CPM: impressions ? round((spend / impressions) * 1000) : null,
        CPC: clicks ? round(spend / clicks) : null,
        CTR: impressions && clicks ? round((clicks / impressions) * 100) : null,
        CPA: purchases ? round(spend / purchases) : null,
        ROAS: spend ? round((revenue || 0) / spend) : null,
        ROI: spend ? round((((revenue || 0) - spend) / spend) * 100) : null,
        conversionRate:
          clicks && purchases ? round((purchases / clicks) * 100) : null,
      },
      notes: [],
    };
    for (const [k, v] of Object.entries(out.metrics)) {
      if (v === null) out.notes.push(`${k} não pôde ser calculado (dados insuficientes).`);
    }
    return out;
  },
};
