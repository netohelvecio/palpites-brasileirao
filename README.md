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

Quando o jogo da rodada é o confronto direto entre **1º e 2º colocado** da tabela, a rodada vale **em dobro** (6/2/0).

### Empate na escolha do jogo da rodada

Quando dois ou mais confrontos empatam no topo (mesma soma de pontos) e nenhum deles é o 1º × 2º, o sistema:

1. Persiste os candidatos e marca a rodada como `awaiting_pick`.
2. Manda enquete no grupo do WhatsApp (poll nativo, com fallback pra texto com emojis 1️⃣ 2️⃣ se o cliente não suportar).
3. Aguarda o admin homologar a escolha via `/escolher <posição>` no DM **ou** via `POST /api/v1/rounds/:id/pick-candidate`.
4. Após homologação, o próximo tick do scheduler abre a rodada normalmente.

### Comandos WhatsApp

| Comando | Quem | O que faz |
|---|---|---|
| `/cadastro <nome> <emoji>` | Qualquer um | Auto-cadastro stateless. Ex: `/cadastro Helvécio ⚽` |
| `2x1 Palmeiras` (texto livre) | Cadastrado | Registra/edita palpite na rodada aberta |
| `/escolher <n>` | Admin | Homologa candidato em rodada com empate. Ex: `/escolher 2` |

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

# Jobs manuais (dev)
cd apps/api && node ace jobs:run-open-round
cd apps/api && node ace jobs:run-close-round
cd apps/api && node ace jobs:run-sync-scores
cd apps/api && node ace jobs:run-finalize-round
cd apps/api && node ace jobs:run-match-reminder

# WhatsApp utils
cd apps/api && node ace whatsapp:list-groups        # descobrir GROUP_JID
cd apps/api && node ace whatsapp:lookup-lid <E.164> # resolver lid de um telefone
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

Entidades principais: `users`, `seasons`, `rounds`, `matches`, `guesses`, `scores`, `round_match_candidates`.

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
| 8 — Rodada Dobrada (1º × 2º) | ✅ concluída | Quando o pick coincide com 1º × 2º na tabela, a pontuação da rodada é multiplicada por 2 (6/2/0). Picker detecta automaticamente, jobs anunciam no WhatsApp em 3 momentos (abertura, T-30min, resultado final) |
| 9 — Empate na escolha do jogo da rodada | ✅ concluída | Quando o picker tem empate no topo sem que algum confronto seja 1º × 2º, persiste candidatos em `round_match_candidates` e marca a rodada como `awaiting_pick`. Job manda enquete no grupo (poll nativo + fallback emoji). Admin homologa via `/escolher <pos>` no DM ou `POST /rounds/:id/pick-candidate`. Service transacional com `forUpdate` evita race entre picks concorrentes |

## Documentação adicional

Os arquivos `CLAUDE.md` espalhados pelo repo guiam contribuidores (e agentes IA) sobre convenções:

- [`CLAUDE.md`](CLAUDE.md) — visão geral, decisões arquiteturais
- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) — convenções da API (controllers finos, repos com DI, hooks, status enums)
- [`apps/api/tests/CLAUDE.md`](apps/api/tests/CLAUDE.md) — alocação de tests, helpers compartilhados, naming
- [`packages/shared/CLAUDE.md`](packages/shared/CLAUDE.md) — restrições do pacote shared (browser-safe)

Specs e planos em `docs/superpowers/` são a fonte de verdade da arquitetura — sempre atualize a spec antes de mudar código.

Runbooks de operação em [`docs/runbooks/`](docs/runbooks/) (backup, DuckDNS, GitHub secrets).

## Licença

MIT
