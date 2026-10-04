// Ferramenta de geração de imagem — REAL (OpenAI Images).
import { z } from 'zod';
import { config } from '../../config/index.js';
import { generateImage } from '../providers/openai.js';
import { saveBuffer } from '../../modules/files/storage.js';

const inputSchema = z.object({
  prompt: z.string().min(3).max(4000),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1024'),
  n: z.number().int().min(1).max(4).default(1),
});

export const imageGenTool = {
  name: 'generate_image',
  description:
    'Gera imagens a partir de uma descrição (criativos, banners, conceitos). Retorna arquivos de imagem.',
  permissions: ['image'],
  external: false,
  inputSchema,
  async execute({ prompt, size, n }, ctx) {
    const images = await generateImage({ model: config.models.image, prompt, size, n });
    const saved = [];
    for (const img of images) {
      if (img.b64) {
        const buffer = Buffer.from(img.b64, 'base64');
        const asset = await saveBuffer({
          buffer,
          filename: `generated-${Date.now()}.png`,
          mimeType: 'image/png',
          kind: 'image',
          userId: ctx.userId,
          projectId: ctx.projectId || null,
        });
        saved.push({ fileId: asset.id, filename: asset.filename });
      } else if (img.url) {
        saved.push({ url: img.url });
      }
    }
    return { prompt, size, images: saved };
  },
};
