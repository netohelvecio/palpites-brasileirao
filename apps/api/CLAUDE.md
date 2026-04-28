# apps/api — Context for Claude

API Adonis 7 responsável por todo o backend: HTTP REST (admin), integração WhatsApp (Baileys) e scheduler (node-cron).

> **Contexto global:** ver `../../CLAUDE.md` na raiz do monorepo.

## Organização

```
app/
  controllers/     # HTTP controllers finos: validam input, delegam ao repository/service
  models/          # Lucid models (extendem UserSchema/MatchSchema/... de database/schema.ts)
  repositories/    # Acesso a dados via DI — encapsulam queries Lucid, evitam duplicação
  presenters/      # Funções puras que formatam models em response shapes HTTP (one per view)
  services/        # Regras de domínio puras e orquestração (score parser, scoring, ranking, betting policy)
  validators/      # VineJS validators (createUserValidator, etc.)
  middleware/      # admin_auth_middleware (Bearer admin), container_bindings_middleware, force_json_response_middleware
  integrations/    # football_data/ (client + mappers + types); whatsapp/ virá via Baileys no plano 4
  jobs/            # open_round_job, close_round_job, sync_scores_job — orchestrators chamados pelo scheduler e pelos ace commands
  exceptions/      # handler global
commands/
  jobs/            # ace commands p/ disparar jobs manualmente em dev (jobs:run-open-round, run-close-round, run-sync-scores, run-finalize-round)
config/
  database.ts      # conexão pg — DB_* vars obrigatórias
  app.ts, cors.ts, bodyparser.ts, hash.ts, logger.ts, encryption.ts
database/
  migrations/      # 0001_..0006_ — numeradas manualmente para ordem explícita
  factories/       # factories Lucid para testes (UserFactory, SeasonFactory, ...) via @adonisjs/lucid/factories + @faker-js/faker
  seeders/         # seeders de desenvolvimento. Atualmente vazio — rounds são criadas sob demanda pelo `FixturesSyncService` quando o `currentMatchday` chega.
  schema.ts        # AUTO-GERADO pós migration:run — NÃO EDITAR À MÃO
start/
  env.ts           # validação de env vars
  routes.ts        # define rotas
  kernel.ts        # middleware global + named middlewares
tests/
  unit/            # testes de serviços puros (parser, scoring, ranking)
  functional/      # testes de endpoints HTTP com banco de teste
  bootstrap.ts     # plugins Japa + hook de migração do banco de teste
```

## Convenções locais

- **ESM obrigatório**: arquivos em TS, imports com `.js` nos caminhos relativos (`import Foo from './foo.js'`).
- **Subpath aliases**: `#controllers/*`, `#models/*`, `#repositories/*`, `#presenters/*`, `#services/*`, `#validators/*`, `#middleware/*`, `#database/*`, `#factories/*`, `#start/*`, `#config/*`, `#tests/*`, `#integrations/*`, `#jobs/*` — configurados em `package.json → imports`.
- **Controllers finos**: só lidam com HTTP (validação + resposta). Delegam dados ao repository e lógica pura ao service.
- **Repositories com DI**: toda query Lucid fica em `app/repositories/`. Controllers recebem via `@inject()` no construtor. Nada de `User.query()` direto no controller.
- **`BaseRepository<Model>`** fornece `findById`, `findByIdOrFail`, `create`, `update`. Cada repo específico só adiciona métodos próprios (`list()` com ordenação da entidade, `findByXYZ`, etc.).
- **Presenters** em `app/presenters/` são funções puras `present<ViewName>(model[s]) => shape`. Um arquivo por view. Helpers compartilhados (`presentUserSummary`, `presentMatch`) são reusados por outras views. Nunca retorne Lucid models direto do controller — sempre passe pelo presenter apropriado.
- **Services puros** (sem DB) são preferidos sempre que possível; testes unitários são rápidos.
- **Prefira `@beforeCreate`/`@beforeFind`/`@beforeFetch` hooks** em vez de lógica espalhada.
- **Migrations são imutáveis após aplicadas**: para mudar schema, crie uma nova migration.
- **Scheduler de jobs**: cron jobs em `start/scheduler.ts`, registrado em `adonisrc.ts → preloads` com `environment: ['web']` (não carrega em test/console/repl). Cada job em `app/jobs/` é resolvido via `app.container.make(...)`. Para disparo manual em dev, use os ace commands `node ace jobs:run-*` (em `commands/jobs/`, sempre com `static options = { startApp: true }`). Os `run-*` que enviam WhatsApp usam `withWhatsAppConnection` para conectar Baileys (preload web-only não dispara em ace) — **pare o `pnpm dev` antes** (auth multi-file não suporta duas sessões simultâneas).
- **WhatsApp**: integração via Baileys em `app/integrations/whatsapp/` (port `WhatsAppClient` com `sendToGroup`/`sendToUser`/`onMessage`; impls `BaileysClient`/`StubClient`/`DisabledClient` escolhidas no `whatsapp_provider` por `WHATSAPP_MODE`). Outbound: `WhatsAppNotifier` em `app/services/`; jobs chamam `notifier.isReady()` antes de mudar status (offline → cron retenta). Inbound: `WhatsAppInboundHandler` em `app/services/` é registrado como callback no `start/whatsapp.ts` e processa DMs (`/cadastro <nome> <emoji>` é stateless; texto livre vira palpite via `score_parser`). Handler não tem gate — só roda quando socket está aberto; falhas pós-upsert são logadas, sem rollback (próxima edição vence). `WHATSAPP_GROUP_JID` é validado em `sendToGroup`, não em `connect` (chicken-and-egg com `whatsapp:list-groups`).
- **Transações Lucid**: `BaseRepository.create(payload, trx?)` e `update(row, payload, trx?)` aceitam um `TransactionClientContract` opcional. Use `db.transaction(async (trx) => {...})` (de `@adonisjs/lucid/services/db`) e propague `trx` em **todas** as operações dentro do bloco — incluindo queries de leitura: `Model.query({ client: trx })` ou repo helpers que aceitem `trx`. Sem isso, a query vai pra outra conexão e não vê writes uncommitted.
- **Status enums em produção**: use as constantes de `@palpites/shared` (`RoundStatus.OPEN`, `MatchStatus.FINISHED`) — não strings hardcoded — em services, jobs, controllers, repositories e factories. **Tests** podem manter literais (`'open'`, `'finished'`): funcionam como contrato/documentação do shape e quebram explicitamente se alguém renomear o enum value.

## Padrões de model

```ts
// app/models/user.ts (exemplo)
import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind } from '@adonisjs/lucid/orm'
import { UserSchema } from '#database/schema'

export default class User extends UserSchema {
  public static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignUuid(user: User) {
    if (!user.id) user.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query) {
    query.where('is_deleted', false)
  }
}
```

Motivos:

- `extends UserSchema` evita duplicar decorators de colunas (o schema é auto-gerado do DB).
- `selfAssignPrimaryKey = true` + hook com `randomUUID()` garante que Lucid sempre tem o ID após insert, sem depender do default do DB.
- Soft delete é global via `beforeFind`/`beforeFetch`.

Para status (enum), **redefina o tipo** no model importando de `@palpites/shared`:

```ts
import type { RoundStatus } from '@palpites/shared'
// ...
@column()
declare status: RoundStatus
```

## Env vars

Todas validadas em `start/env.ts`. Nunca acesse `process.env` direto.

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`
- `ADMIN_API_TOKEN` — bearer token único usado pelo `admin_auth_middleware`
- `APP_KEY`, `APP_URL`, `PORT`, `HOST`, `NODE_ENV`, `LOG_LEVEL`, `TZ`
- `FOOTBALL_DATA_BASE_URL`, `FOOTBALL_DATA_TOKEN` — integração football-data.org (token opcional; tests usam mock via `container.swap`)
- `WHATSAPP_MODE` (`real|stub|disabled`, default `disabled`), `WHATSAPP_GROUP_JID` (`*@g.us`, obrigatório só em modo real), `WHATSAPP_AUTH_PATH` (default `./storage/whatsapp-auth`, gitignored)
- **Não usar** `SESSION_*` (sessões foram removidas)

`.env.test` aponta pra Postgres de teste (porta 5433, DB `palpites_test`).

## Scripts do package.json

```bash
pnpm dev              # node ace serve --hmr
pnpm test             # todos os testes (unit + functional)
pnpm test:unit        # apenas unit
pnpm test:functional  # apenas functional
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint .
pnpm format           # prettier --write .
pnpm build            # node ace build (produção)
```

Migrations e seeds são via `node ace migration:*` — não têm atalho no package.json.

## Testes

```bash
node ace test              # tudo
node ace test unit         # só unit
node ace test functional   # só funcionais
node ace test unit --files='tests/unit/score_parser.spec.ts'
```

Bootstrap roda `testUtils.db().migrate()` só em suites `functional`/`e2e` (unit tests não tocam DB). Cada test group usa `group.each.setup(() => testUtils.db().wrapInGlobalTransaction())` pra rollback automático (**não** `withGlobalTransaction`, que está deprecado).

**Mockar clients de integração externa:** `app.container.swap(Client, () => fake as any)` no setup + `app.container.restore(Client)` em `finally`. Template: `tests/helpers/football_data_mock.ts` (`FakeFootballDataClient`). Uso típico em `tests/functional/seasons.spec.ts` e `matches.spec.ts`.

**Gotcha:** se testes falharem com `ECONNREFUSED 127.0.0.1:5433`, o container `palpites_postgres_test` caiu. `docker compose up -d` da raiz sobe de novo.

**Gotcha de transaction nos tests:** `wrapInGlobalTransaction` força todas as queries (mesmo sem `client: trx` explícito) a passarem pela mesma conexão da trx global. Isso **esconde** bugs de query dentro de `db.transaction(...)` que esquecem de propagar `trx` — em produção essas queries vão pra conexão separada e não enxergam writes uncommitted. Quando refactor mexer com transação, valide manualmente fora do test (REPL ou ace command com banco real).

**REPL via stdin gotcha:** `node ace repl` alimentado por pipe fecha stdin rápido demais pro `await` top-level completar em scripts multiline. Use um IIFE async em uma única linha: `printf '(async () => { const m = await import("..."); ... })()\n' | node ace repl`.

**Factories** em `database/factories/` geram dados de teste. Padrão: `await UserFactory.create()`, `await UserFactory.createMany(3)`, `await UserFactory.merge({ isAdmin: true }).create()`. Evitam duplicar setup e dão dados realistas via Faker. IDs continuam gerados pelo `@beforeCreate` hook do model.

## Coisas a evitar

- **Não usar `vine.compile(vine.object(...))`** — API deprecada. O padrão atual é `vine.create({...})` direto com o shape do objeto.
- **`vine.date()` sem `formats` rejeita strings** — para receber ISO do JSON use `vine.date({ formats: ['iso8601'] })`. Default do VineJS 4 só aceita instância `Date`.
- **Não reintroduzir** `@adonisjs/auth`, `@adonisjs/session`, `@adonisjs/shield` — foram removidos de propósito.
- **Não escrever CRUD genérico** ou BaseController — prefira controllers explícitos por recurso.
- **Não gerar migrations com timestamp automático** (`node ace make:migration`) — convenção **nossa** é usar prefixo numérico manual (`0007_`, `0008_`...) pra manter ordem estável e legível. O Adonis aceita os dois formatos.
- **Não consultar `process.env` fora de `start/env.ts`** — sempre via `env.get('VAR')`.
- **Não editar `database/schema.ts`** — é auto-gerado.
- **Baileys gotchas**: usar versão estável `6.7.x` (não `7.0.0-rc.*`); `makeWASocket` precisa de `browser: Browsers.macOS('Desktop')` + `version: await fetchLatestBaileysVersion()` para evitar handshake 405; logger precisa de método `child()` (interface pino — usar logger silent inline).
