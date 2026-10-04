# Arquitetura — Sempre com Você

## Camadas

```
FRONTEND (web/ — React+Vite)
      ↓ HTTP/SSE (/api)
API / BACKEND (server/ — Express)
      ↓
AUTHENTICATION (JWT httpOnly + bcrypt, sessões no banco)
      ↓
AI ORCHESTRATOR (server/src/ai/orchestrator)
      ↓
AGENTS (server/src/ai/agents) — 14 agentes especializados
      ↓
TOOLS (server/src/ai/tools) — registry extensível
      ↓
EXTERNAL SERVICES (OpenAI, pesquisa, URLs) + MODEL ROUTER
      ↓
DATABASE / STORAGE (PostgreSQL+pgvector / storage local|S3)
```

## Fluxo de uma mensagem

1. `POST /api/chat/send` (autenticado, verifica créditos).
2. Persiste a mensagem do usuário; carrega histórico + memória relevante + contexto do projeto.
3. **Orquestrador** classifica a intenção (JSON estruturado) e monta o plano: agentes + etapas.
4. Se `clarificationNeeded`, devolve a pergunta (não gasta execução de agentes).
5. Caminho **simples** (1 agente geral): resposta direta em streaming.
   Caminho **complexo**: executa cada agente especializado (com suas ferramentas via function calling) e depois **sintetiza** uma resposta única em streaming.
6. Persiste a resposta, **debita créditos** (após produzir resultado), registra uso/custo, grava memória (tarefas complexas).

Tudo é transmitido via **SSE**: eventos `meta`, `status`, `plan`, `event` (tool/agent), `delta`, `done`, `error`.

## Segurança

- **System prompt e prompts dos agentes nunca saem do backend** (`server/src/ai/prompts`). O endpoint admin de prompts expõe apenas chaves/versões, nunca o conteúdo cru.
- **Prompt injection**: todo conteúdo externo (URLs, arquivos, pesquisa) é marcado como DADO. O system prompt instrui a IA a tratar conteúdo externo como dado, nunca como instrução. A ferramenta `fetch_url` marca `externalData: true`.
- **SSRF**: `fetch_url` bloqueia localhost e redes privadas.
- **Isolamento por usuário/projeto**: toda query filtra por `userId`; arquivos e memórias idem.
- **Senhas**: bcrypt (puro JS, sem build nativo). **Sessões**: hash do token no banco (cada JWT tem `jti` único), revogáveis.
- **Rate limiting**, **helmet**, **CORS** restrito à origem do frontend.
- Erros nunca vazam stack trace ao cliente; logs com `redact` de segredos/PII.

## Model Router

`server/src/ai/model-router` escolhe o modelo por tipo de tarefa (fast/smart/vision/image/embedding) e complexidade. Trocar/adicionar modelos = editar config/env. Estima custo por evento (observabilidade, não cobrança).

## Ferramentas (extensível)

Cada tool: `{ name, description, inputSchema (zod), permissions, external, destructive, execute }`.
Adicionar nova tool = criar o arquivo e registrá-la em `server/src/ai/tools/index.js`. O orquestrador a descobre automaticamente via catálogo. Ferramentas `external`/`destructive` exigem confirmação (`ctx.confirmed`).

Tools reais incluídas: `web_search`, `fetch_url`, `generate_image`, `read_file`, `marketing_metrics`.

## Agentes

14 agentes (general, research, market, product, ads, competitor, marketing, copy, data, image, vision, site, campaign, files). Cada um tem prompt próprio e um conjunto mínimo de ferramentas (menor privilégio). O usuário nunca escolhe o agente — o orquestrador decide.

## Memória

`server/src/ai/memory` grava fatos com embedding (pgvector) nos escopos USER/PROJECT/CONVERSATION e recupera por similaridade (`<=>`), com fallback por recência. Isolada por usuário.

## Tarefas longas ("Faça por mim")

Modelo `Task` e arquitetura de fila (BullMQ/Redis via `ENABLE_QUEUE`) preparados para execução assíncrona com estado/retry. O caminho síncrono de chat já executa planos multiagente.

## Integrações futuras

`server/src/modules/integrations` reporta estado REAL: sem credencial → `PENDING`. Nenhum botão/resposta falsa. Meta/Google/TikTok ficam marcados como pendentes até receberem credenciais e implementação do cliente oficial.
