# Sempre com Você

> **Uma IA. Todas as ferramentas. Um só lugar.**

Plataforma de inteligência artificial multimodal e multiagente. O usuário conversa com **uma única IA**; um **Orquestrador** interno decide quais agentes e ferramentas usar.

Stack: **Node.js + JavaScript (ESM)** · Express · Prisma · **SQLite (zero config; Postgres opcional)** · React + Vite · OpenAI.

---

## Estrutura do projeto

```
sempre-com-voce/
├── server/                     # Backend (Node.js + Express) — o CÉREBRO da IA
│   ├── src/
│   │   ├── index.js            # Bootstrap do servidor
│   │   ├── app.js              # Montagem do Express (middlewares, rotas)
│   │   ├── config/             # Configuração e variáveis de ambiente
│   │   ├── db/                 # Cliente Prisma
│   │   ├── middleware/         # Auth, erros, rate limit, segurança
│   │   ├── modules/            # Rotas HTTP por domínio (auth, chat, projects, files, admin)
│   │   ├── ai/                 # Núcleo da IA (NUNCA exposto ao frontend)
│   │   │   ├── orchestrator/   # Orquestrador central
│   │   │   ├── agents/         # Agentes especializados
│   │   │   ├── tools/          # Ferramentas (registry extensível)
│   │   │   ├── prompts/        # Prompts internos (system + agentes)
│   │   │   ├── model-router/   # Seleção de modelo
│   │   │   ├── memory/         # Memória (usuário/projeto/conversa)
│   │   │   └── providers/      # Provedores de modelo (OpenAI, ...)
│   │   └── utils/              # Logger, erros, helpers
│   └── prisma/
│       └── schema.prisma       # Modelo de dados completo
├── web/                        # Frontend (React + Vite) — SEM lógica de IA
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── themes/             # Temas Lunar e Solar
│       ├── pages/              # Telas (chat, login, projetos, admin)
│       ├── components/
│       └── lib/                # Cliente de API, store
├── .env.example
└── package.json                # Workspace raiz (scripts)
```

## Princípio de segurança central

- **System prompt e prompts dos agentes vivem SOMENTE no servidor** (`server/src/ai/prompts`). Nunca enviados ao frontend.
- Isolamento por usuário/projeto em todas as queries.
- Conteúdo externo (sites, arquivos, pesquisa) é tratado como **DADO**, nunca como instrução → proteção contra prompt injection.

## Rodando localmente (ZERO CONFIG)

Só precisa de **Node 20+**. O banco (SQLite) e o `JWT_SECRET` são criados automaticamente.

```bash
# 1. Instalar
npm install

# 2. Rodar — o banco é criado e populado sozinho no primeiro arranque
npm run dev            # sobe server (3001) e web (5173)
```

A IA só **responde de verdade** com uma chave da OpenAI. Para habilitar:

```bash
cp .env.example .env   # e preencha OPENAI_API_KEY
```

> Sem a chave, a aplicação roda normalmente (login, projetos, histórico), mas o chat
> responde honestamente que a IA está indisponível — nunca com respostas falsas.

**Login admin padrão:** `admin@semprecomvoce.ai` / `mude-esta-senha` (configurável no `.env`).

## Estado das integrações

| Integração | Estado |
|---|---|
| Chat + Orquestrador + Agentes + Tools | ✅ Real |
| Pesquisa na web | ✅ Real (via tool) |
| Geração de imagem (OpenAI) | ✅ Real |
| Visão (análise de imagem) | ✅ Real |
| Análise de arquivos (CSV/XLSX/PDF) | ✅ Real |
| Meta Ads / Ad Library | ⏳ PENDENTE — interface pronta, sem credenciais |
| Google Ads / Analytics / Trends | ⏳ PENDENTE — interface pronta |
| TikTok Creative Center | ⏳ PENDENTE — interface pronta |
| Pagamento / cobrança real | ⏳ PENDENTE — arquitetura de planos/créditos pronta |

Integrações pendentes **não têm botões falsos**: ficam marcadas como indisponíveis até receberem credenciais reais.
