# Palpites do Brasileirão — Project Context for Claude

## Quick start (copy-paste)

```bash
nvm use                           # Node 24.14.0 (obrigatório, via .nvmrc)
pnpm install
docker compose up -d              # Postgres dev:5432 e test:5433
pnpm --filter @palpites/api dev   # API em http://localhost:3333
```

Primeira vez, rode também `cd apps/api && node ace migration:run`.

> **Gotcha**: sem `nvm use`, qualquer `node ace ...` quebra com `ERR_UNKNOWN_FILE_EXTENSION ".ts"` — Adonis 7 usa o type-stripping nativo do Node 22+.

## Propósito

API para automatizar um bolão anual do Brasileirão entre ~10 amigos, hoje operado manualmente num grupo de WhatsApp. O sistema escolhe automaticamente o jogo da rodada (confronto com maior soma de pontos dos dois times na tabela), recebe palpites via WhatsApp, calcula pontuação e publica ranking.

**Regras de pontuação:**
- Placar exato: 3 pts
- Acertar vencedor ou empate: 1 pt
- Qualquer outra situação: 0 pts
- **Rodada dobrada (1º × 2º):** quando o jogo da rodada coincide com o confronto direto entre 1º e 2º colocado da tabela, a pontuação é multiplicada por 2 (6/2/0). Detectado automaticamente no momento do pick e congelado em `matches.points_multiplier`.

## Estrutura do monorepo

Monorepo **pnpm workspaces + Turborepo**.

```
apps/
  api/              # Adonis 7 (Node + TS) — serviço único com 3 módulos lógicos:
                    #   HTTP API (REST admin), WhatsApp Gateway (Baileys), Scheduler (node-cron)
packages/
  shared/           # tipos/DTOs compartilhados (para futuro frontend)
docs/
  superpowers/
    specs/          # especificações do projeto (fonte da verdade da arquitetura)
    plans/          # planos de implementação numerados (1.1 → 1.8, depois 2.x, 3.x, 4.x)
```

`apps/web/` (frontend Next.js) será adicionado em iteração futura.

## Stack

- **Linguagem:** TypeScript (ESM, `#imports/*` subpath aliases do Adonis)
- **Runtime:** Node.js `24.14.0` (pinned via `.nvmrc`) — Adonis 7 exige Node 24+
- **Framework:** Adonis 7 (`@adonisjs/core`)
- **ORM:** Lucid (`@adonisjs/lucid`)
- **Banco:** PostgreSQL 16 via Docker Compose (dev em `5432`, test em `5433`)
- **Validação:** VineJS
- **Testes:** Japa (runner + assert + api-client)
- **Package manager:** pnpm 9
- **Build orquestrador:** Turborepo

### Integrações externas

- **football-data.org v4** (`api.football-data.org/v4`) — jogos, rodadas, tabela (`competition code=BSA`). Auth via header `X-Auth-Token`. Free tier ~10 req/min. Implementado na Fase 2.
- **Baileys** (`@whiskeysockets/baileys`) — integração WhatsApp com **chip secundário dedicado** (não número pessoal). Implementado nas Fases 4 (outbound) e 5 (inbound).
- **node-cron** — jobs recorrentes; BullMQ/Redis foi **descartado** por YAGNI (10 usuários). Implementado na Fase 3.

## Decisões arquiteturais importantes

1. **UUID em todas as PKs** — geradas via `@beforeCreate` hook com `randomUUID()` do `node:crypto`; DB também tem default `gen_random_uuid()` (extensão `pgcrypto`).
2. **Soft delete global** — toda tabela tem `is_deleted`; models aplicam scope `@beforeFind`/`@beforeFetch` filtrando `is_deleted=false`.
3. **Um jogo por rodada** — `matches` tem `UNIQUE(round_id)`; admin sobrescreve o jogo da rodada via `PUT /rounds/:id/match` se precisar.
4. **Auth admin por token fixo** — `ADMIN_API_TOKEN` no `.env` + middleware Bearer. **NÃO usar** `@adonisjs/auth` (scaffolding oficial foi removido).
5. **Sem sessão/cookies/CSRF** — API é puramente stateless JSON. `@adonisjs/session` e `@adonisjs/shield` foram removidos do scaffolding.
6. **Tipos de domínio no shared** — `RoundStatus`, `MatchStatus` etc. moram em `@palpites/shared` e são importados tanto pela API quanto (futuramente) pelo web.
7. **Models estendem base schemas auto-geradas** — após `migration:run`, Adonis 7 gera `database/schema.ts` com classes base; models em `app/models/` estendem essas e só adicionam hooks, scopes, relações.

## Preferências do usuário no projeto

- **Sem commits automáticos** — planos e agentes não devem rodar `git commit`/`git push`. Usuário revisa e commita manualmente.
- **Planos pequenos** — implementation plans têm 3–6 tarefas, quebrados em subplanos numerados (1.1, 1.2, ...).
- **Inline execution** é o modo preferido para executar planos.

## Comandos úteis

```bash
# Ativar Node 24 (obrigatório antes de qualquer pnpm)
nvm use

# Instalar deps
pnpm install

# Subir Postgres (dev + test)
docker compose up -d

# API — dev
pnpm --filter @palpites/api dev

# API — migrations
cd apps/api && node ace migration:run

# API — testes
cd apps/api && node ace test

# Shared — typecheck
pnpm --filter @palpites/shared lint
```

## Roadmap (alto nível)

| Fase | Status | Escopo |
|---|---|---|
| Plano 1 (1.1–1.8) | ✅ concluído | Foundation + Core Domain — monorepo, schema, models, serviços (betting_policy, score_parser, scoring, ranking), endpoints admin completos |
| Plano 2 (2.0–2.4) | ✅ concluído | football-data.org integration — cleanup + client axios, featured match picker (puro), current-matchday sync (lazy round creation), refresh score. Planos em `docs/superpowers/plans/2026-04-24-plan-2.*.md` (+ `2026-04-23-plan-2.2-featured-match-picker.md`) |
| Plano 3 (3.1–3.3) | ✅ concluído | Scheduler (node-cron) + 3 jobs: OpenRoundJob (30min), CloseRoundJob (5min), SyncScoresJob (10min) com `RoundFinalizerService` transacional. Planos em `docs/superpowers/plans/2026-04-24-plan-3.*.md` |
| Plano 4 (4.1–4.5) | ✅ concluído | WhatsApp **outbound** via Baileys — client foundation (stub/disabled/real), templates, notifier, wire em todos os jobs (open/close/sync_scores). Mensagens só no grupo; DMs e inbound ficam para Fase 5. Planos em `docs/superpowers/plans/2026-04-25-plan-4.*.md` |
| Plano 5 (5.1–5.5) | ✅ concluído | WhatsApp **inbound** — port estendida com `sendToUser`/`onMessage`, `WhatsAppInboundHandler` (auto-cadastro stateless via `/cadastro`, parser, upsert, reply privado + post no grupo); DMs personalizadas no abertura de rodada via laço no `OpenRoundJob`. Planos em `docs/superpowers/plans/2026-04-25-plan-5.*.md` |
| Plano 6 (6.1–6.5) | ✅ concluído | Deploy — VM Oracle Always Free (x86_64, Sao Paulo) com Docker Compose (`api` + `caddy` + `postgres`), Caddy/Let's Encrypt em `palpites-brasileirao.duckdns.org`, GitHub Actions CI/CD (`quality.yml` reusable + `ci.yml` em PRs + `deploy.yml` em push na `main` → quality → build amd64 → push GHCR → SSH + migrations) e backup diário `pg_dump → Oracle Object Storage` via cron + OCI CLI. Planos em `docs/superpowers/plans/2026-04-27-plan-6.*.md` |
| Plano 7 (7.1) | ✅ concluído | Match Reminder T-30min — `MatchReminderJob` (cron `*/5min`) posta aviso no grupo quando o jogo da rodada está em ≤30min do kickoff. Idempotência via flag `matches.reminder_30_min_sent_at`. Fase 1 sem escalações (Fase 2 deferida — fontes avaliadas no spec). Spec/plano em `docs/superpowers/specs/2026-04-30-match-reminder-30min-design.md` e `docs/superpowers/plans/2026-04-30-plan-match-reminder.md` |
| Plano 8 (8.1–8.4) | ✅ concluído | Rodada Dobrada (1º × 2º) — picker detecta 1×2 e persiste `points_multiplier` em `matches`; `calculatePoints` aceita multiplier e retorna `{ points, isExact }`; finalizer aplica e agrega via `is_exact` (coluna nova em `guesses`). Anúncio no WhatsApp em 3 momentos: abertura, T-30min, resultado final. Admin override aceita `pointsMultiplier?` opcional no validator. Spec/planos em `docs/superpowers/specs/2026-05-02-double-points-round-design.md` e `docs/superpowers/plans/2026-05-02-plan-8.*.md` |

## Produção

Deploy em **Oracle Cloud Always Free** (VM x86_64, Sao Paulo) acessível em `https://palpites-brasileirao.duckdns.org`. Stack via Docker Compose (api + caddy + postgres) em `/opt/palpites` na VM, SSH via `deploy@147.15.112.59`. Backups diários `pg_dump → Object Storage` (bucket `palpites-backups`, prefixo `pg/`). CI/CD: `quality.yml` (reusable) + `ci.yml` (PRs/branches) + `deploy.yml` (push em `main` → quality → build amd64 → push GHCR → SSH + migrations). Atualizar app em prod = `git push origin main`. Runbooks em `docs/runbooks/` (`backup-setup.md`, `duckdns-setup.md`, `github-secrets.md`).

## Fontes de verdade

- **Spec oficial**: `docs/superpowers/specs/2026-04-20-palpites-brasileirao-design.md`
- **Planos**: `docs/superpowers/plans/2026-04-20-plan-1.*.md`
- Sempre cheque a spec antes de tomar decisões arquiteturais; se divergir, atualize a spec primeiro.
