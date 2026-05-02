# Palpites do Brasileirão

API para automatizar um bolão anual do Campeonato Brasileiro entre amigos. O sistema escolhe automaticamente o jogo da rodada, recebe palpites via WhatsApp, calcula pontuação e publica o ranking — substituindo o processo manual feito hoje em grupo de WhatsApp.

## Como funciona

A cada rodada, o jogo "oficial do bolão" é o confronto com maior soma de pontos dos dois times na tabela. Os participantes enviam o palpite de placar via WhatsApp e o sistema pontua automaticamente assim que o resultado sai.

### Regras de pontuação

| Acerto | Pontos |
|---|---|
| Placar exato | 3 |
| Vencedor (ou empate) correto | 1 |
| Nenhum dos anteriores | 0 |

## Stack

- **TypeScript** (ESM) em **Node.js 24**
- **AdonisJS 7** + **Lucid ORM**
- **PostgreSQL 16** (via Docker Compose)
- **VineJS** para validação
- **Japa** para testes
- **pnpm workspaces** + **Turborepo**

### Integrações

- [football-data.org](https://www.football-data.org/) — dados de jogos, rodadas e tabela (competition `BSA`) — **integrado**
- [node-cron](https://github.com/node-cron/node-cron) — scheduler de jobs (abertura, fechamento, sync de placares) — **integrado**
- [Baileys](https://github.com/WhiskeySockets/Baileys) — integração com WhatsApp (chip dedicado) — **integrado** (outbound: anúncios no grupo + DM personalizada na abertura da rodada; inbound: handler de DMs com auto-cadastro `/cadastro` e parser de palpites)
- **Hospedagem:** Oracle Cloud Always Free (VM x86_64, Sao Paulo) com [Caddy](https://caddyserver.com/) (TLS automático via Let's Encrypt), [DuckDNS](https://www.duckdns.org/) (DNS dinâmico) e backup diário `pg_dump → Object Storage` — **integrado**

## Estrutura do monorepo

```
apps/
  api/              # AdonisJS 7 — HTTP REST (admin), WhatsApp Gateway, Scheduler
packages/
  shared/           # Tipos e DTOs compartilhados (ex.: RoundStatus, MatchStatus)
docs/
  superpowers/
    specs/          # Especificação da arquitetura (fonte da verdade)
    plans/          # Planos de implementação numerados
```

## Começando

### Pré-requisitos

- Node.js **24.14.0** (use `nvm` — há `.nvmrc` no repo)
- pnpm 9
- Docker + Docker Compose

### Setup

```bash
nvm use                           # Node 24.14.0
pnpm install
docker compose up -d              # Postgres dev (5432) + test (5433)

cp apps/api/.env.example apps/api/.env
# edite o .env e defina APP_KEY, DB_* e ADMIN_API_TOKEN
# opcional: FOOTBALL_DATA_TOKEN pra chamadas reais ao provider (https://www.football-data.org/client/register)
# opcional: WHATSAPP_MODE (default `disabled`); use `stub` em dev pra ver as mensagens nos logs sem parear chip

cd apps/api && node ace migration:run
```

### Rodando

```bash
pnpm --filter @palpites/api dev   # http://localhost:3333
```

## Comandos úteis

```bash
# API — dev com HMR
pnpm --filter @palpites/api dev

# Testes
cd apps/api && node ace test              # todos
cd apps/api && node ace test unit         # apenas unit
cd apps/api && node ace test functional   # apenas functional

# Migrations
cd apps/api && node ace migration:run
cd apps/api && node ace migration:rollback

# Qualidade
pnpm --filter @palpites/api typecheck
pnpm --filter @palpites/api lint
pnpm --filter @palpites/api format

# Shared
pnpm --filter @palpites/shared lint
```

## Autenticação

A API administrativa é stateless e protegida por **Bearer token fixo** (`ADMIN_API_TOKEN` no `.env`). Não há sessões, cookies ou CSRF — é uma API puramente JSON.

```http
GET /api/v1/seasons
Authorization: Bearer <ADMIN_API_TOKEN>
```

## Banco de dados

Todas as tabelas seguem as mesmas convenções:

- **PK em UUID** (gerada via hook `@beforeCreate` do Lucid e default `gen_random_uuid()` no DB)
- **Soft delete global** via coluna `is_deleted` (scope automático nos models)
- **Migrations numeradas manualmente** (`0001_`, `0002_`, ...) para ordem estável

Entidades principais: `users`, `seasons`, `rounds`, `matches`, `guesses`, `scores`.

## Roadmap

| Fase | Status | Escopo |
|---|---|---|
| 1 — Foundation + Core Domain | ✅ concluída | Monorepo, schema, models, serviços, endpoints admin |
| 2 — football-data.org | ✅ concluída | Sync da rodada atual, picker do jogo em destaque, refresh de placares |
| 3 — Scheduler | ✅ concluída | Jobs recorrentes via node-cron: abertura (30min), fechamento (5min), sync de placares + finalização (10min) |
| 4 — WhatsApp outbound | ✅ concluída | Baileys client + notifier + wire nos jobs: anúncio de rodada aberta/fechada e mensagem final com pontuação + ranking, no grupo |
| 5 — WhatsApp inbound | ✅ concluída | Handler de DMs com auto-cadastro stateless via `/cadastro`, parser de placar (`2x1 Time`, `1x1`), upsert + reply privado + post no grupo a cada palpite. DMs personalizadas no abertura da rodada |
| 6 — Deploy | ✅ concluída | App rodando 24/7 em VM Oracle Always Free com Caddy/Let's Encrypt, DuckDNS e backup diário do Postgres pra Object Storage. CI/CD via GitHub Actions: `ci.yml` (PRs/branches) e `deploy.yml` (push em `main` → quality → build amd64 → push GHCR → SSH deploy + migrations) compartilham `quality.yml` reusable |
| 7 — Match Reminder T-30min | ✅ concluída | Aviso automático no grupo do WhatsApp ~30min antes do kickoff do jogo da rodada, com idempotência via flag em `matches`. Fase 1 sem escalações (Fase 2 deferida) |

## Licença

MIT
