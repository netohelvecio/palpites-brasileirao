# tests/ — Context for Claude

Convenções de organização, alocação e escrita de testes.

> **Contexto pai:** `apps/api/CLAUDE.md` cobre comandos de execução, gotchas de DB/transação e setup de factories. Este arquivo foca em **onde colocar cada teste** e **como escrevê-lo**.

## Estrutura

```
tests/
  bootstrap.ts            # plugins Japa + hook de migração do banco de teste
  unit/                   # funções puras — sem Adonis app, sem DB, sem HTTP
    whatsapp/             # subfolder para templates WhatsApp (todos os *_template)
  functional/             # qualquer coisa que precisa do container, DB ou HTTP
  helpers/                # fakes/mocks compartilhados
```

## Decision tree — qual pasta usar?

```
O teste...
├── instancia o que testa via `new Foo()` direto, sem container?
│   ├── ...e a função/classe é PURA (sem side effects, sem DB, sem container)?
│   │   └── → tests/unit/
│   │       └── É um template WhatsApp? → tests/unit/whatsapp/
│   └── ...e usa side effects?
│       └── não deveria ser puro → ver branch funcional
└── instancia via `app.container.make(Foo)` OU usa DB OU usa HTTP client?
    └── → tests/functional/
```

**Regra prática:** se aparecer `app.container.make`, `app.container.swap`, `testUtils.db()`, ou `client.get/post/put/...` → é functional. Caso contrário → unit.

## tests/unit/ — funções puras

Testes de funções/classes sem dependências externas. Rápidos (~5ms cada), não bootam Adonis app, não tocam DB.

**Cabe aqui:**
- Pure services (`betting_policy`, `featured_match_picker`, `score_parser`, `ranking_service`, `guess_scoring_service`, `match_status_mapper`)
- Pure mappers (`football_data_mappers`)
- Templates WhatsApp em `unit/whatsapp/` (são funções `Input → string`)

**NÃO cabe aqui:**
- Tests que precisam de `app.container.make(...)` — vão pra functional/
- Tests que precisam de DB — vão pra functional/
- Tests de HTTP endpoint — vão pra functional/

**Padrão:**

```ts
import { test } from '@japa/runner'
import { meuServiceFn } from '#services/meu_service'

test.group('meuServiceFn', () => {
  test('caso descrito em pt-BR', ({ assert }) => {
    const r = meuServiceFn(input)
    assert.equal(r.foo, 'bar')
  })
})
```

### tests/unit/whatsapp/

Subfolder dedicado a **templates de mensagem WhatsApp** — funções puras `Input → string` (ou `Input → { question, options }` para polls).

Convenção de nome: `<template_name>_template.spec.ts` (ex: `round_opened_template.spec.ts`, `tie_poll_template.spec.ts`, `admin_picked_template.spec.ts`).

> O `WhatsAppNotifier` em si **não** mora aqui — ele é um service que coordena o client, então seus testes vão pra `functional/whatsapp_notifier.spec.ts`.

## tests/functional/ — container/DB/HTTP

Testes que precisam do Adonis app booted. Bootstrap roda migration + cada group usa `group.each.setup(() => testUtils.db().wrapInGlobalTransaction())` pra rollback automático.

**Cabe aqui:**

| Categoria | Exemplos |
|---|---|
| HTTP endpoints | `seasons.spec.ts`, `rounds.spec.ts`, `matches.spec.ts`, `pick_candidate_endpoint.spec.ts` |
| Services que precisam do container | `whatsapp_notifier.spec.ts`, `whatsapp_inbound_handler.spec.ts`, `round_finalizer_service.spec.ts`, `fixtures_sync_service.spec.ts` |
| Jobs | `open_round_job.spec.ts`, `close_round_job.spec.ts`, `sync_scores_job.spec.ts`, `match_reminder_job.spec.ts` |
| Repositories (queries reais) | `guess_repository.spec.ts`, `round_repository.spec.ts` |
| Health/status | `health.spec.ts`, `whatsapp_status.spec.ts` |

**Naming:**
- Endpoints REST: `<recurso>.spec.ts` (ex: `seasons.spec.ts`) ou `<endpoint>_endpoint.spec.ts` quando a ação é específica (ex: `pick_candidate_endpoint.spec.ts`).
- Services/jobs/repos: `<nome_em_snake>.spec.ts` matching o nome do arquivo testado.

**Padrão:**

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import MeuService from '#services/meu_service'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

const HEADERS = { authorization: 'Bearer test-admin-token' }

test.group('MeuService', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('caso em pt-BR', async ({ assert }) => {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    try {
      const svc = await app.container.make(MeuService)
      // ... act + assert
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })
})
```

## Múltiplos groups por arquivo (sub-features)

Quando um service/handler tem várias responsabilidades, **um arquivo só com múltiplos groups** é preferível a fragmentar em vários specs. Convenção do nome do group: `<Classe> — <feature>`.

Exemplo (`whatsapp_inbound_handler.spec.ts`):

```ts
test.group('WhatsAppInboundHandler — cadastro', (group) => { ... })
test.group('WhatsAppInboundHandler — roteamento', (group) => { ... })
test.group('WhatsAppInboundHandler — palpite', (group) => { ... })
test.group('WhatsAppInboundHandler — escolher', (group) => { ... })
```

Mesma ideia em `whatsapp_notifier.spec.ts` quando faz sentido — métodos novos do notifier (ex: `notifyTieCandidatesPoll`) entram como tests no group existente, não como arquivo separado.

**Antipattern:** criar `whatsapp_inbound_escolher.spec.ts` paralelo. Toda lógica do handler mora em **um** spec, organizada por groups.

## Helpers (`tests/helpers/`)

Fakes/mocks compartilhados de integrações externas. **Reuse antes de criar inline.**

| Helper | Quando usar |
|---|---|
| `FakeWhatsAppClient` (`whatsapp_mock.ts`) | Qualquer teste que precisa simular `WhatsAppClient`. Tem `sentMessages`, `sentDms`, `sentPolls`, `throwOnSend`, `throwOnSendToUser`, `throwOnSendPoll`, `pollMessageId`, `simulateIncoming`. |
| `FakeFootballDataClient` (`football_data_mock.ts`) | Mock do `FootballDataClient`. Use com `fakeStandings(...)` e `fakeMatch(...)`. |

### Estender helper > criar fake inline

Se o helper não cobre um caso novo, **adicione uma capability ao helper** (campo público, flag de erro, contador) — não duplique uma classe inline no spec.

❌ **Errado:**
```ts
class FakeClient extends WhatsAppClient {
  pollCalls = []
  async sendPollToGroup(q, o) { this.pollCalls.push({ q, o }); return { messageId: 'x' } }
  // ...rest of abstract methods
}
```

✅ **Certo:** já existe `FakeWhatsAppClient` com `sentPolls` + `throwOnSendPoll`. Use ele.

### Mockar integração externa via container.swap

```ts
const fake = new FakeFootballDataClient()
fake.standings = fakeStandings(...)
app.container.swap(FootballDataClient, () => fake as any)
try {
  // ... test
} finally {
  app.container.restore(FootballDataClient)
}
```

## Auth em endpoints admin

`.env.test` define `ADMIN_API_TOKEN=test-admin-token`. Use o literal direto:

```ts
const HEADERS = { authorization: 'Bearer test-admin-token' }
```

Evite `env.get('ADMIN_API_TOKEN')` em tests — o literal funciona como documentação do contrato.

## Status enums em tests

**Tests podem (e devem) usar literais** de status: `'pending'`, `'open'`, `'finished'`, `'awaiting_pick'`, `'scheduled'`. Eles servem como contrato/documentação do shape do response e quebram explicitamente se alguém renomear o enum.

**Código de produção** (services, jobs, controllers, repositories, factories) **deve** usar as constantes de `@palpites/shared`:

```ts
// produção
import { RoundStatus } from '@palpites/shared'
if (round.status === RoundStatus.AWAITING_PICK) { ... }

// teste — literal OK
const round = await RoundFactory.merge({ status: 'awaiting_pick' }).create()
assert.equal(round.status, 'awaiting_pick')
```

## Factories (`database/factories/`)

Padrão pra setup de dados:

```ts
await UserFactory.create()                                    // 1 user com defaults
await UserFactory.createMany(3)                               // 3 users
await UserFactory.merge({ isAdmin: true }).create()           // override de campos
await RoundFactory.with('season').create()                    // cria a relação também
await RoundFactory.merge({ seasonId: s.id, status: 'open' }).create()
```

IDs vêm do `@beforeCreate` hook nos models — não passe `id` manualmente.

**Quando criar uma factory nova:** sempre que adicionar um model novo. Padrão em `database/factories/<nome>_factory.ts`.

## Gotchas comuns

1. **`wrapInGlobalTransaction` esconde bugs de trx propagation.** Em prod, `db.transaction(async (trx) => {...})` exige `trx` propagado em **toda** query/repo dentro do bloco. No teste, a trx global cobre os "esquecimentos". Pra validar de verdade, rode REPL ou ace command com banco real (sem wrap).

2. **Nunca rode unit test contra DB.** Se um teste em `unit/` precisar de Postgres, ele tá no lugar errado — mova pra `functional/`.

3. **Mock client externo no `before` do teste, restaure no `finally`.** Sempre. Mesmo que o teste falhe, o `restore` precisa rodar pra não vazar o swap pro próximo teste do mesmo arquivo.

4. **`.timeout(15000)` nos jobs com DM em loop.** Quando o `OpenRoundJob` itera users com `await new Promise(r => setTimeout(r, 1000))` entre DMs, o teste estoura o default de 2s. Adicione `.timeout(15000)` na declaração.

## Quando consolidar/separar specs

| Cenário | Ação |
|---|---|
| Service ganhou método novo | Adicione test no spec existente desse service. |
| Service tem várias responsabilidades distintas (cadastro, palpite, comando) | Mantenha tudo em **um** spec, organize com `test.group('X — feature', ...)`. |
| Endpoint novo num resource já testado | Adicione no spec do resource (`matches.spec.ts`, `rounds.spec.ts`). |
| Endpoint novo standalone (sem resource óbvio) | Crie `<nome>_endpoint.spec.ts` (ex: `pick_candidate_endpoint.spec.ts`). |
| Template WhatsApp novo | Sempre `<nome>_template.spec.ts` em `unit/whatsapp/`. |

## Checklist antes de submeter spec novo

- [ ] Está na pasta certa (decision tree acima)?
- [ ] Reusa helpers (`FakeWhatsAppClient`, `FakeFootballDataClient`) em vez de inline?
- [ ] `group.each.setup(testUtils.db().wrapInGlobalTransaction())` se toca DB?
- [ ] `container.swap` + `container.restore` em try/finally se mocka integração?
- [ ] Group name no padrão `<Classe>` ou `<Classe> — <feature>`?
- [ ] Casos cobertos: happy path + edge cases (auth, validação, erro de integração, idempotência)?
