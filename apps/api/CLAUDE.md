# apps/api — Context for Claude

API Adonis 7 responsável por todo o backend: HTTP REST (admin), integração WhatsApp (Baileys) e scheduler (node-cron).

> **Contexto global:** ver `../../CLAUDE.md` na raiz do monorepo.

## Organização

```
app/
  controllers/     # HTTP controllers finos: validam input, delegam ao service
  models/          # Lucid models (extendem UserSchema/MatchSchema/... de database/schema.ts)
  services/        # Regras de domínio puras e orquestração (score parser, scoring, ranking)
  validators/      # VineJS validators (createUserValidator, etc.)
  middleware/      # admin_auth_middleware (Bearer), cors, bodyparser
  integrations/    # [futuro] api_football/, whatsapp/ (Baileys)
  jobs/            # [futuro] open_round_job, close_round_job, sync_scores_job
  exceptions/      # handler global
config/
  database.ts      # conexão pg — DB_* vars obrigatórias
  app.ts, cors.ts, bodyparser.ts, hash.ts, logger.ts, encryption.ts
database/
  migrations/      # 0001_..0006_ — numeradas manualmente para ordem explícita
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
- **Subpath aliases**: `#controllers/*`, `#models/*`, `#services/*`, `#validators/*`, `#middleware/*`, `#database/*`, `#start/*`, `#config/*`, `#tests/*` — configurados em `package.json → imports`.
- **Controllers finos**: só lidam com HTTP (validação + resposta). Lógica vai em services.
- **Services puros** (sem DB) são preferidos sempre que possível; testes unitários são rápidos.
- **Prefira `@beforeCreate`/`@beforeFind`/`@beforeFetch` hooks** em vez de lógica espalhada.
- **Migrations são imutáveis após aplicadas**: para mudar schema, crie uma nova migration.

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
- **Não usar** `SESSION_*` (sessões foram removidas)

`.env.test` aponta pra Postgres de teste (porta 5433, DB `palpites_test`).

## Scripts do package.json

```bash
pnpm dev         # node ace serve --hmr
pnpm test        # node ace test
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint .
pnpm format      # prettier --write .
pnpm build       # node ace build (produção)
```

Migrations e seeds são via `node ace migration:*` — não têm atalho no package.json.

## Testes

```bash
node ace test              # tudo
node ace test unit         # só unit
node ace test functional   # só funcionais
node ace test unit --files='tests/unit/score_parser.spec.ts'
```

Bootstrap roda `testUtils.db().migrate()` no início. Cada test group usa `group.each.setup(() => testUtils.db().withGlobalTransaction())` pra rollback automático.

## Coisas a evitar

- **Não reintroduzir** `@adonisjs/auth`, `@adonisjs/session`, `@adonisjs/shield` — foram removidos de propósito.
- **Não escrever CRUD genérico** ou BaseController — prefira controllers explícitos por recurso.
- **Não gerar migrations com timestamp automático** (`node ace make:migration`) — convenção **nossa** é usar prefixo numérico manual (`0007_`, `0008_`...) pra manter ordem estável e legível. O Adonis aceita os dois formatos.
- **Não consultar `process.env` fora de `start/env.ts`** — sempre via `env.get('VAR')`.
- **Não editar `database/schema.ts`** — é auto-gerado.
