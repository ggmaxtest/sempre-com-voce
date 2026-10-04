// Ferramenta de leitura/análise de arquivos — REAL (CSV, XLSX, PDF, texto).
// Respeita isolamento: só lê arquivos do usuário/projeto corrente.
import { z } from 'zod';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { prisma } from '../../db/client.js';
import { readFileBuffer } from '../../modules/files/storage.js';

const inputSchema = z.object({
  fileId: z.string().min(1),
  maxRows: z.number().int().min(1).max(5000).default(1000),
});

export const fileAnalyzeTool = {
  name: 'read_file',
  description:
    'Lê e extrai o conteúdo de um arquivo enviado (CSV, XLSX, PDF, texto) para análise. Recebe fileId.',
  permissions: ['files'],
  external: false,
  inputSchema,
  async execute({ fileId, maxRows }, ctx) {
    // Isolamento por usuário.
    const asset = await prisma.fileAsset.findFirst({
      where: { id: fileId, userId: ctx.userId },
    });
    if (!asset) throw new Error('Arquivo não encontrado ou sem permissão.');

    const buffer = await readFileBuffer(asset.storageKey);
    const mime = asset.mimeType || '';

    if (mime.includes('csv') || asset.filename.toLowerCase().endsWith('.csv')) {
      const records = parseCsv(buffer, { columns: true, skip_empty_lines: true });
      return {
        kind: 'csv',
        rowCount: records.length,
        columns: records.length ? Object.keys(records[0]) : [],
        rows: records.slice(0, maxRows),
        truncated: records.length > maxRows,
      };
    }

    if (
      mime.includes('spreadsheet') ||
      /\.xlsx?$/.test(asset.filename.toLowerCase())
    ) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const sheets = {};
      const sheetNames = [];
      wb.eachSheet((ws) => {
        sheetNames.push(ws.name);
        const header = [];
        const rows = [];
        ws.eachRow((row, rowNumber) => {
          const values = Array.isArray(row.values) ? row.values.slice(1) : [];
          if (rowNumber === 1) {
            header.push(...values.map((v) => (v == null ? '' : String(v))));
          } else if (rows.length < maxRows) {
            const obj = {};
            header.forEach((h, i) => { obj[h || `col${i + 1}`] = values[i] ?? null; });
            rows.push(obj);
          }
        });
        sheets[ws.name] = { rowCount: ws.rowCount - 1, columns: header, rows };
      });
      return { kind: 'xlsx', sheetNames, sheets };
    }

    if (mime.includes('pdf') || asset.filename.toLowerCase().endsWith('.pdf')) {
      const { default: pdfParse } = await import('pdf-parse');
      const parsed = await pdfParse(buffer);
      return {
        kind: 'pdf',
        pages: parsed.numpages,
        text: parsed.text.slice(0, 200000),
      };
    }

    // Fallback: texto bruto.
    return { kind: 'text', text: buffer.toString('utf8').slice(0, 200000) };
  },
};
