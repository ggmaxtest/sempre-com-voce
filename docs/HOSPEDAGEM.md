# Guia de Hospedagem — Sempre com Você

## Pré-requisitos
- **Node.js 20+** — e só.
- O banco de dados é **SQLite embutido** (criado automaticamente). **Não precisa instalar Postgres.**
- Uma **chave da OpenAI** (só para a IA responder de verdade).

## Rodar (zero config)
```bash
npm install
npm run dev        # dev: server :3001 + web :5173
# ou produção:
npm run build
npm start
```
No primeiro arranque, o script `ensure-db` cria o arquivo SQLite em `server/data/`, aplica o schema e popula admin + planos. O `JWT_SECRET` é gerado e salvo em `server/data/.jwt-secret` se você não definir um.

## Habilitar a IA
```bash
cp .env.example .env     # preencha OPENAI_API_KEY
```
Verifique em `GET /api/health` → `ai: "ready"`.

## Opcional: usar Postgres em vez de SQLite
1. Em `server/prisma/schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"`.
2. Defina `DATABASE_URL` no `.env` com a string do Postgres.
3. `npm run db:push && npm run db:seed`.
> SQLite guarda os embeddings de memória como JSON e calcula similaridade em memória — ótimo para começar. Para escala maior, migre para Postgres (+ pgvector, se quiser busca vetorial nativa).

## Produção
- Sirva `web/dist` (estático) por CDN/Nginx/Vercel e aponte `/api` para o processo do backend (`npm start`).
- Defina `WEB_ORIGIN` com o domínio do frontend (CORS + cookies). Cookies são `Secure` em produção (requer HTTPS).
- O arquivo SQLite e os uploads ficam em `server/data/` — garanta que essa pasta seja persistente (volume) no seu host.

## Segurança
- Nunca versione `.env` nem `server/data/`.
- Integrações Meta/Google/TikTok aparecem como **PENDENTE** até você fornecer credenciais — nada é simulado.

## Deploy na Square Cloud (um único serviço)
O backend **serve o próprio frontend** em produção: acessar o domínio raiz (`/`) abre a
interface React, e `/api/*` atende a API — tudo no mesmo processo e porta. Ideal para a Square Cloud.

O projeto já inclui `squarecloud.app` e é resiliente ao bloqueio de install scripts:
- O `prestart` roda `scripts/ensure-db.js`, que **gera o Prisma Client**, **compila o frontend**
  (`web/dist` se ausente), cria o banco SQLite e popula os dados iniciais — tudo automático,
  mesmo com o `postinstall` do `@prisma/client` bloqueado.
- As senhas usam **bcrypt (puro JS)** — sem build nativo (`node-gyp`) para a Square Cloud bloquear.

Passos:
1. Faça upload do projeto (sem `node_modules`).
2. Em *Variáveis de ambiente*, defina ao menos `OPENAI_API_KEY` (e, se quiser, `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
3. A Square Cloud roda `npm install` e depois `npm start` — o `prestart` cuida de Prisma, build do frontend e banco.
> Garanta que `server/data/` fique em armazenamento persistente para não perder o banco a cada restart.
> O primeiro arranque é mais lento (compila o frontend uma vez); os seguintes reutilizam `web/dist`.

## Avisos de dependências (dev)
Advisories de `vite`/`esbuild` afetam só o servidor de desenvolvimento local, não o build de produção.
