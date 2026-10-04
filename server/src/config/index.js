import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Carrega .env a partir da raiz do projeto (um nível acima de /server)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // também tenta .env local, sem sobrescrever

// Diretório de dados da aplicação (SQLite + segredos auto-gerados).
const SERVER_ROOT = path.resolve(__dirname, '../..'); // .../server
const DATA_DIR = path.join(SERVER_ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- ZERO CONFIG: banco SQLite embutido por padrão (nenhuma config necessária) ---
if (!process.env.DATABASE_URL) {
  const dbFile = path.join(DATA_DIR, 'sempre-com-voce.db');
  process.env.DATABASE_URL = `file:${dbFile}`;
}

// --- JWT_SECRET: usa o fornecido; se ausente, gera e persiste automaticamente ---
if (!process.env.JWT_SECRET) {
  const secretFile = path.join(DATA_DIR, '.jwt-secret');
  try {
    if (fs.existsSync(secretFile)) {
      process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
    } else {
      const generated = crypto.randomBytes(48).toString('hex');
      fs.writeFileSync(secretFile, generated, { mode: 0o600 });
      process.env.JWT_SECRET = generated;
    }
  } catch {
    // Fallback em memória (não persiste entre reinícios, mas funciona).
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  }
}

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
  }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3001', 10),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL'),

  jwt: {
    secret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  },

  models: {
    fast: process.env.MODEL_FAST || 'gpt-4o-mini',
    smart: process.env.MODEL_SMART || 'gpt-4o',
    vision: process.env.MODEL_VISION || 'gpt-4o',
    image: process.env.MODEL_IMAGE || 'gpt-image-1',
    embedding: process.env.MODEL_EMBEDDING || 'text-embedding-3-small',
    // Modelo usado na pesquisa web nativa da OpenAI (Responses API).
    search: process.env.MODEL_SEARCH || 'gpt-4o',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enableQueue: process.env.ENABLE_QUEUE === 'true',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: process.env.STORAGE_LOCAL_DIR || path.join(DATA_DIR, 'storage'),
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || '',
      bucket: process.env.S3_BUCKET || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  },

  search: {
    // Padrão: pesquisa nativa da OpenAI (só precisa da OPENAI_API_KEY).
    driver: process.env.SEARCH_DRIVER || 'openai',
    tavilyApiKey: process.env.TAVILY_API_KEY || '',
    serpApiKey: process.env.SERPAPI_API_KEY || '',
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@semprecomvoce.ai',
    password: process.env.ADMIN_PASSWORD || 'change-me',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  },

  integrations: {
    metaAccessToken: process.env.META_ACCESS_TOKEN || '',
    googleAdsDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    tiktokAccessToken: process.env.TIKTOK_ACCESS_TOKEN || '',
  },
};

export function hasOpenAI() {
  return Boolean(config.openai.apiKey);
}
