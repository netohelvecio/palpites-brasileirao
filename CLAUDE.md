# Palpites do Brasileirão — Project Context for Claude

## Quick start (copy-paste)

```bash
nvm use                           # Node 24.14.0 (obrigatório, via .nvmrc)
pnpm install
docker compose up -d              # Postgres dev:5432 e test:5433
pnpm --filter @palpites/api dev   # API em http://localhost:3333
```

Primeira vez, rode também `cd apps/api && node ace migration:run`.

## Propósito

API para automatizar um bolão anual do Brasileirão entre ~10 amigos, hoje operado manualmente num grupo de WhatsApp. O sistema escolhe automaticamente o jogo da rodada (confronto com maior soma de pontos dos dois times na tabela), recebe palpites via WhatsApp, calcula pontuação e publica ranking.

**Regras de pontuação:**
- Placar exato: 3 pts
- Acertar vencedor ou empate: 1 pt
- Qualquer outra situação: 0 pts

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

### Integrações externas planejadas (ainda não implementadas)

- **API-Football** (`api-football.com`) — jogos, rodadas, tabela do Brasileirão (`league=71`)
- **Baileys** (`@whiskeysockets/baileys`) — integração WhatsApp com **chip secundário dedicado** (não número pessoal)
- **node-cron** — jobs recorrentes; BullMQ/Redis foi **descartado** por YAGNI (10 usuários)

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
| Plano 1 (1.1–1.8) | ✅ concluído | Foundation + Core Domain — monorepo, schema, models, serviços (betting_policy, score_parser, scoring, ranking), endpoints admin completos, 68 tests passando |
| Plano 2 (2.1–2.4) | 📝 escrito, pronto p/ executar | API-Football integration — client axios, featured match picker, sync service, refresh scores. Planos em `docs/superpowers/plans/2026-04-23-plan-2.*.md` |
| Plano 3 | pendente | Scheduler + jobs (open/close/sync) — ainda sem WhatsApp |
| Plano 4 | pendente | Baileys + message handler/sender — substitui logs por mensagens reais |

## Fontes de verdade

- **Spec oficial**: `docs/superpowers/specs/2026-04-20-palpites-brasileirao-design.md`
- **Planos**: `docs/superpowers/plans/2026-04-20-plan-1.*.md`
- Sempre cheque a spec antes de tomar decisões arquiteturais; se divergir, atualize a spec primeiro.
