# WhatsApp Dual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar telefone e JID `@lid` em colunas próprias, buscar o usuário por qualquer uma das duas, e deixar o handler preencher sozinho o campo que faltar.

**Architecture:** Uma migration move o valor `@lid` de `whatsapp_number` para `whatsapp_lid` e troca os uniques comuns por índices parciais (`WHERE is_deleted = false`). A porta `IncomingMessage` passa a carregar `fromNumber` (telefone ou `null`) e `fromJid` (JID cru, sempre presente), com a resolução extraída para uma função pura. O handler resolve o usuário por um `OR` nas duas colunas e preenche buracos na primeira DM.

**Tech Stack:** Adonis 7, Lucid, PostgreSQL 16, Japa (assert + api-client), Baileys 6.7.x.

**Spec:** `docs/superpowers/specs/2026-07-29-whatsapp-dual-identity-design.md`

## Global Constraints

- **Commit ao final de cada task, apenas na branch `feat/whatsapp-dual-identity`.** Exceção autorizada pelo usuário em 2026-07-29 para viabilizar o review por task. **Nunca `git push`**, nunca commitar em `main`, nunca `git reset` em trabalho alheio. O usuário revisa a branch inteira no fim e é dono do histórico (squash/reword à vontade). Mensagens de commit em inglês.
- **Sem comentários em código.** Nomes e funções pequenas no lugar.
- **Migration com prefixo numérico manual** (`0013_`), nunca `node ace make:migration`.
- **Após `migration:run`, rodar `pnpm format`** — o codegen regenera `database/schema.ts` em linha única e o prettier precisa reformatar, senão o lint do CI quebra.
- **Não editar `database/schema.ts` à mão** — é auto-gerado.
- **Enums de status via `@palpites/shared`** em código de produção; literais são aceitos em testes.
- **`nvm use` antes de qualquer `node ace`** — sem Node 24 o Adonis 7 quebra com `ERR_UNKNOWN_FILE_EXTENSION ".ts"`.
- **Postgres de teste na 5433** — `docker compose up -d` na raiz se der `ECONNREFUSED`.

---

### Task 1: Migration 0013 — coluna `whatsapp_lid` e índices únicos parciais

**Files:**
- Create: `apps/api/database/migrations/0013_add_whatsapp_lid_to_users.ts`
- Create: `apps/api/tests/functional/user_identity_constraints.spec.ts`
- Modify: `apps/api/tests/functional/users.spec.ts`
- Modify (auto-gerado): `apps/api/database/schema.ts`

**Interfaces:**
- Consumes: nada.
- Produces: coluna `users.whatsapp_lid` (`varchar(40)`, nullable), `users.whatsapp_number` nullable, índices `users_whatsapp_number_active_unique` e `users_whatsapp_lid_active_unique`. No model, `whatsappLid: string | null` e `whatsappNumber: string | null`.

- [ ] **Step 1: Confirmar o nome real da constraint atual**

```bash
ssh deploy@147.15.112.59 'cd /opt/palpites && docker compose -f docker-compose.prod.yml exec -T postgres psql -U palpites -d palpites_prod -c "\d users"'
```

Procure a linha de índice único em `whatsapp_number`. O esperado é `users_whatsapp_number_unique` (padrão do Knex para `.unique()` em `0001_create_users_table.ts:12`). **Se o nome divergir, use o real no Step 4** — errar aqui faz a migration falhar depois de `DROP NOT NULL` e do `UPDATE` já terem rodado, deixando a tabela pela metade.

Em dev o mesmo comando local: `docker compose exec postgres psql -U palpites -d palpites_dev -c "\d users"`.

- [ ] **Step 2: Escrever o teste que falha**

Criar `apps/api/tests/functional/user_identity_constraints.spec.ts`:

```ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#factories/user_factory'

test.group('users — índices únicos parciais de identidade', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('dois usuários vivos não podem compartilhar whatsapp_number', async ({ assert }) => {
    await UserFactory.merge({ whatsappNumber: '5511999990001' }).create()

    await assert.rejects(() => UserFactory.merge({ whatsappNumber: '5511999990001' }).create())
  })

  test('usuário soft-deletado libera o whatsapp_number para um novo', async ({ assert }) => {
    const removed = await UserFactory.merge({ whatsappNumber: '5511999990002' }).create()
    removed.isDeleted = true
    await removed.save()

    const fresh = await UserFactory.merge({ whatsappNumber: '5511999990002' }).create()

    assert.notEqual(fresh.id, removed.id)
  })

  test('dois usuários vivos não podem compartilhar whatsapp_lid', async ({ assert }) => {
    await UserFactory.merge({ whatsappLid: '1111111111111@lid' }).create()

    await assert.rejects(() => UserFactory.merge({ whatsappLid: '1111111111111@lid' }).create())
  })

  test('whatsapp_number aceita NULL em múltiplas linhas', async ({ assert }) => {
    const a = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '2222222222222@lid',
    }).create()
    const b = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '3333333333333@lid',
    }).create()

    assert.notEqual(a.id, b.id)
  })
})
```

Cada teste roda em transação própria. A violação de constraint aborta a transação no Postgres, então ela é sempre a **última** operação de cada caso — não acrescente asserções depois dela.

No mesmo passo, adicionar a `apps/api/tests/functional/users.spec.ts`, logo após o teste `POST /users rejeita whatsappNumber duplicado`, o caso que o índice parcial conserta:

```ts
test('POST /users aceita número de usuário soft-deletado', async ({ client }) => {
  const removed = await UserFactory.merge({ whatsappNumber: '5511999997777' }).create()
  removed.isDeleted = true
  await removed.save()

  const res = await client
    .post('/api/v1/users')
    .headers(HEADERS)
    .json({ name: 'Novo', whatsappNumber: '5511999997777', emoji: '⚽' })

  res.assertStatus(201)
})
```

Hoje isso retorna 500: o `existsByWhatsappNumber` não enxerga a linha deletada (escopo de soft delete), o `INSERT` segue e o unique comum recusa.

- [ ] **Step 3: Rodar os testes e confirmar que falham**

```bash
cd apps/api && node ace test functional \
  --files='tests/functional/user_identity_constraints.spec.ts' \
  --files='tests/functional/users.spec.ts'
```

Esperado: falha de tipo/compilação em `whatsappLid` (a propriedade não existe no model), `insert ... violates unique constraint` nos casos de soft delete, e 500 no `POST /users`.

- [ ] **Step 4: Escrever a migration**

Criar `apps/api/database/migrations/0013_add_whatsapp_lid_to_users.ts`:

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('whatsapp_lid', 40).nullable()
    })

    this.schema.raw('ALTER TABLE users ALTER COLUMN whatsapp_number DROP NOT NULL')

    this.schema.raw(
      "UPDATE users SET whatsapp_lid = whatsapp_number, whatsapp_number = NULL WHERE whatsapp_number LIKE '%@lid'"
    )

    this.schema.raw('ALTER TABLE users DROP CONSTRAINT users_whatsapp_number_unique')

    this.schema.raw(
      'CREATE UNIQUE INDEX users_whatsapp_number_active_unique ON users (whatsapp_number) WHERE is_deleted = false'
    )

    this.schema.raw(
      'CREATE UNIQUE INDEX users_whatsapp_lid_active_unique ON users (whatsapp_lid) WHERE is_deleted = false'
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS users_whatsapp_lid_active_unique')
    this.schema.raw('DROP INDEX IF EXISTS users_whatsapp_number_active_unique')

    this.schema.raw(
      'UPDATE users SET whatsapp_number = whatsapp_lid WHERE whatsapp_number IS NULL AND whatsapp_lid IS NOT NULL'
    )

    this.schema.raw(
      'ALTER TABLE users ADD CONSTRAINT users_whatsapp_number_unique UNIQUE (whatsapp_number)'
    )
    this.schema.raw('ALTER TABLE users ALTER COLUMN whatsapp_number SET NOT NULL')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('whatsapp_lid')
    })
  }
}
```

A ordem importa: `DROP NOT NULL` antes do `UPDATE`, e o `UPDATE` antes de trocar os uniques.

- [ ] **Step 5: Rodar a migration e regenerar o schema**

```bash
cd apps/api && node ace migration:run && pnpm format
```

Confirme que `database/schema.ts` ganhou `whatsappLid` em `UserSchema.$columns` e que `whatsappNumber` virou `string | null`.

- [ ] **Step 6: Rodar os testes e confirmar que passam**

```bash
cd apps/api && node ace test functional \
  --files='tests/functional/user_identity_constraints.spec.ts' \
  --files='tests/functional/users.spec.ts'
```

Esperado: os 4 casos novos de constraint verdes, e o `POST /users` de soft-deletado retornando 201.

- [ ] **Step 7: Verificar a suíte e registrar o typecheck vermelho esperado**

```bash
cd apps/api && node ace test
```

Esperado: **toda a suíte verde**. Os testes rodam sob type-stripping do Node, que ignora tipos.

```bash
cd apps/api && pnpm typecheck
```

Esperado: **vermelho, com exatamente 5 erros `TS2322`** — `app/jobs/open_round_job.ts:80` e quatro pontos em `tests/functional/whatsapp_inbound_handler.spec.ts` (503, 542, 566, 594). Todos são a mesma causa: `whatsappNumber` passou a ser `string | null` e esses chamadores ainda esperam `string`.

Isso é **esperado e correto nesta task**. Os quatro pontos do spec são consertados na Task 2 (quando `IncomingMessage.fromNumber` também vira nullable) e o `open_round_job.ts` na Task 4 (quando entra o `whatsappTarget`). O typecheck volta ao verde no Step 8 da Task 4, que roda a bateria completa do CI.

**Não conserte esses arquivos aqui** — eles são reescritos nas tasks seguintes e o conserto seria desfeito. Se aparecer um sexto erro, ou um erro fora desses arquivos, pare e reporte: aí sim é regressão.

- [ ] **Step 8: Commitar**

```bash
git add apps/api/database/migrations/0013_add_whatsapp_lid_to_users.ts \
        apps/api/database/schema.ts \
        apps/api/tests/functional/user_identity_constraints.spec.ts \
        apps/api/tests/functional/users.spec.ts
git commit
```

Mensagem:

```
feat(db): split whatsapp identity into number and lid columns

Adds users.whatsapp_lid, makes whatsapp_number nullable, moves existing
@lid values across, and replaces the plain unique constraints with partial
ones scoped to live rows.
```

---

### Task 2: Porta `IncomingMessage` e resolução de identidade no Baileys

**Files:**
- Create: `apps/api/app/integrations/whatsapp/incoming_identity.ts`
- Create: `apps/api/tests/unit/whatsapp/incoming_identity.spec.ts`
- Modify: `apps/api/app/integrations/whatsapp/whatsapp_client.ts:3-7`
- Modify: `apps/api/app/integrations/whatsapp/baileys_client.ts:198-242`
- Modify: `apps/api/app/services/whatsapp_inbound_handler.ts`
- Modify: `apps/api/tests/functional/whatsapp_inbound_handler.spec.ts`

**Interfaces:**
- Consumes: nada da Task 1.
- Produces: `resolveIncomingIdentity(key: RawMessageKey): ResolvedIdentity`, e `IncomingMessage` com `fromNumber: string | null` e `fromJid: string`.

Esta task **não muda a resolução de usuário** — o handler continua achando exatamente quem achava antes. Duas coisas mudam de propósito: a forma da `IncomingMessage`, e o destino da resposta, que passa a ser o `fromJid` (entrega equivalente para DM comum, thread correta para DM `@lid`). A busca por duas identidades entra na Task 3.

- [ ] **Step 1: Escrever o teste unitário da função pura**

Criar `apps/api/tests/unit/whatsapp/incoming_identity.spec.ts`:

```ts
import { test } from '@japa/runner'
import { resolveIncomingIdentity } from '#integrations/whatsapp/incoming_identity'

test.group('resolveIncomingIdentity', () => {
  test('DM comum devolve telefone e jid', ({ assert }) => {
    const result = resolveIncomingIdentity({ remoteJid: '5511999990001@s.whatsapp.net' })

    assert.deepEqual(result, {
      fromNumber: '5511999990001',
      fromJid: '5511999990001@s.whatsapp.net',
    })
  })

  test('DM @lid com senderPn resolve o telefone', ({ assert }) => {
    const result = resolveIncomingIdentity({
      remoteJid: '1348703617067@lid',
      senderPn: '557196916296@s.whatsapp.net',
    })

    assert.deepEqual(result, {
      fromNumber: '557196916296',
      fromJid: '1348703617067@lid',
    })
  })

  test('DM @lid sem senderPn devolve fromNumber nulo', ({ assert }) => {
    const result = resolveIncomingIdentity({ remoteJid: '1348703617067@lid' })

    assert.deepEqual(result, {
      fromNumber: null,
      fromJid: '1348703617067@lid',
    })
  })

  test('senderPn não-string é tratado como ausente', ({ assert }) => {
    const result = resolveIncomingIdentity({
      remoteJid: '1348703617067@lid',
      senderPn: null,
    })

    assert.isNull(result.fromNumber)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/api && node ace test unit --files='tests/unit/whatsapp/incoming_identity.spec.ts'
```

Esperado: `Cannot find module '#integrations/whatsapp/incoming_identity'`.

- [ ] **Step 3: Escrever a função pura**

Criar `apps/api/app/integrations/whatsapp/incoming_identity.ts`:

```ts
export interface RawMessageKey {
  remoteJid: string
  senderPn?: string | null
}

export interface ResolvedIdentity {
  fromNumber: string | null
  fromJid: string
}

export function resolveIncomingIdentity(key: RawMessageKey): ResolvedIdentity {
  const fromJid = key.remoteJid

  if (fromJid.endsWith('@s.whatsapp.net')) {
    return { fromNumber: fromJid.replace(/@s\.whatsapp\.net$/, ''), fromJid }
  }

  const senderPn = typeof key.senderPn === 'string' ? key.senderPn : null

  return {
    fromNumber: senderPn ? senderPn.replace(/@s\.whatsapp\.net$/, '') : null,
    fromJid,
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd apps/api && node ace test unit --files='tests/unit/whatsapp/incoming_identity.spec.ts'
```

Esperado: 4 verdes.

- [ ] **Step 5: Ampliar a porta**

Em `apps/api/app/integrations/whatsapp/whatsapp_client.ts`, trocar a interface:

```ts
export interface IncomingMessage {
  fromNumber: string | null
  fromJid: string
  text: string
  messageId: string
}
```

- [ ] **Step 6: Usar a função pura no `BaileysClient`**

Em `apps/api/app/integrations/whatsapp/baileys_client.ts`, importar `resolveIncomingIdentity` e substituir o bloco de resolução manual (linhas ~211-222) por:

```ts
const { fromNumber, fromJid } = resolveIncomingIdentity({
  remoteJid: m.key.remoteJid!,
  senderPn: (m.key as any).senderPn,
})
```

O log `BaileysClient: DM inbound` passa a incluir `fromJid` junto de `remoteJid` e `fromNumber`. A chamada ao handler vira:

```ts
await this.messageHandler({ fromNumber, fromJid, text, messageId: m.key.id ?? 'unknown' })
```

- [ ] **Step 7: Manter o handler compilando sem mudar comportamento**

Em `apps/api/app/services/whatsapp_inbound_handler.ts`:

- As três chamadas `findByWhatsappNumber(msg.fromNumber)` viram `findByWhatsappNumber(msg.fromNumber ?? msg.fromJid)` — que reproduz exatamente o fallback que o `BaileysClient` fazia antes.
- Em `handleRegister`, `whatsappNumber: msg.fromNumber` vira `whatsappNumber: msg.fromNumber ?? msg.fromJid`.
- **Todos** os `this.client.sendToUser(msg.fromNumber, ...)` viram `this.client.sendToUser(msg.fromJid, ...)`.

Responder para o `remoteJid` garante que a resposta cai na mesma conversa de onde a mensagem veio — para DM `@lid` com `senderPn` resolvido, o JID do telefone pode ser outra thread.

- [ ] **Step 8: Atualizar os literais dos testes existentes**

Em `apps/api/tests/functional/whatsapp_inbound_handler.spec.ts`, cada objeto passado a `handler.handle({...})` ganha `fromJid`. Para os casos de telefone puro, o valor é `'<numero>@s.whatsapp.net'`:

```ts
await handler.handle({
  fromNumber: '5511999990001',
  fromJid: '5511999990001@s.whatsapp.net',
  text: '/cadastro Helvécio ⚽',
  messageId: 'msg-1',
})
```

As asserções de destino de DM mudam junto, porque a resposta agora sai pelo JID:

```ts
assert.equal(fake.sentDms[0].number, '5511999990001@s.whatsapp.net')
```

Nos casos que usam `fromNumber: admin.whatsappNumber`, o `fromJid` correspondente é `` `${admin.whatsappNumber}@s.whatsapp.net` ``.

- [ ] **Step 9: Rodar a suíte inteira**

```bash
cd apps/api && pnpm typecheck && node ace test
```

Esperado: verde. Nenhum comportamento novo — se algum teste falhar por motivo que não seja o formato do destino da DM, pare e investigue antes de seguir.

- [ ] **Step 10: Commitar**

```bash
git add apps/api/app/integrations/whatsapp apps/api/app/services/whatsapp_inbound_handler.ts \
        apps/api/tests/unit/whatsapp/incoming_identity.spec.ts \
        apps/api/tests/functional/whatsapp_inbound_handler.spec.ts
git commit
```

Mensagem:

```
refactor(whatsapp): carry phone and jid separately on inbound messages

Extracts identity resolution into a pure function and splits IncomingMessage
into fromNumber (phone or null) and fromJid (raw remoteJid). Replies now go
to the originating jid. No behavior change in user lookup.
```

---

### Task 3: Busca por duas identidades e auto-cura

**Files:**
- Modify: `apps/api/app/repositories/user_repository.ts:13-15`
- Modify: `apps/api/app/services/whatsapp_inbound_handler.ts`
- Modify: `apps/api/tests/functional/whatsapp_inbound_handler.spec.ts`
- Create: `apps/api/tests/functional/user_repository_identity.spec.ts`

**Interfaces:**
- Consumes: `whatsappLid` do model (Task 1), `IncomingMessage.fromJid` (Task 2).
- Produces: `UserRepository.findByWhatsappIdentity(phone: string | null, jid: string): Promise<User | null>`.

- [ ] **Step 1: Escrever o teste do repositório**

Criar `apps/api/tests/functional/user_repository_identity.spec.ts`:

```ts
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import UserRepository from '#repositories/user_repository'
import { UserFactory } from '#factories/user_factory'

test.group('UserRepository.findByWhatsappIdentity', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('acha pelo telefone', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990001',
      whatsappLid: null,
    }).create()

    const found = await repo.findByWhatsappIdentity('5511999990001', '999@lid')

    assert.equal(found!.id, user.id)
  })

  test('acha pelo lid quando o telefone é nulo', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    const user = await UserFactory.merge({
      whatsappNumber: null,
      whatsappLid: '1348703617067@lid',
    }).create()

    const found = await repo.findByWhatsappIdentity(null, '1348703617067@lid')

    assert.equal(found!.id, user.id)
  })

  test('phone nulo não casa linha de número nulo', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    await UserFactory.merge({ whatsappNumber: null, whatsappLid: '111@lid' }).create()

    const found = await repo.findByWhatsappIdentity(null, '222@lid')

    assert.isNull(found)
  })

  test('não acha usuário soft-deletado', async ({ assert }) => {
    const repo = await app.container.make(UserRepository)
    const user = await UserFactory.merge({
      whatsappNumber: '5511999990002',
      whatsappLid: '333@lid',
    }).create()
    user.isDeleted = true
    await user.save()

    const found = await repo.findByWhatsappIdentity('5511999990002', '333@lid')

    assert.isNull(found)
  })
})
```

O último caso é o que protege o agrupamento do `where` — sem ele o `orWhere` escapa do escopo de soft delete.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/api && node ace test functional --files='tests/functional/user_repository_identity.spec.ts'
```

Esperado: `repo.findByWhatsappIdentity is not a function`.

- [ ] **Step 3: Implementar a busca**

Em `apps/api/app/repositories/user_repository.ts`, remover `findByWhatsappNumber` e adicionar:

```ts
findByWhatsappIdentity(phone: string | null, jid: string) {
  return User.query()
    .where((q) => {
      if (phone) q.orWhere('whatsapp_number', phone)
      q.orWhere('whatsapp_lid', jid)
    })
    .first()
}
```

`existsByWhatsappNumber` permanece — serve o `POST /users`, que só lida com telefone.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd apps/api && node ace test functional --files='tests/functional/user_repository_identity.spec.ts'
```

Esperado: 4 verdes.

- [ ] **Step 5: Escrever os testes do handler**

Em `apps/api/tests/functional/whatsapp_inbound_handler.spec.ts`, novo grupo:

```ts
test.group('WhatsAppInboundHandler — identidade dupla', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  function setupFake() {
    const fake = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => fake)
    return fake
  }

  function teardownFake() {
    app.container.restore(WhatsAppClient)
  }

  test('acha o usuário pelo lid quando whatsapp_number é nulo', async ({ assert }) => {
    const fake = setupFake()
    try {
      const user = await UserFactory.merge({
        whatsappNumber: null,
        whatsappLid: '1348703617067@lid',
      }).create()
      const handler = await app.container.make(WhatsAppInboundHandler)

      await handler.handle({
        fromNumber: '557196916296',
        fromJid: '1348703617067@lid',
        text: 'oi',
        messageId: 'msg-lid-1',
      })

      assert.notMatch(fake.sentDms[0].text, /não está cadastrado/)
      await user.refresh()
      assert.equal(user.whatsappNumber, '557196916296')
    } finally {
      teardownFake()
    }
  })

  test('auto-cura preenche whatsapp_lid que estava nulo', async ({ assert }) => {
    const fake = setupFake()
    try {
      const user = await UserFactory.merge({
        whatsappNumber: '5511999990201',
        whatsappLid: null,
      }).create()
      const handler = await app.container.make(WhatsAppInboundHandler)

      await handler.handle({
        fromNumber: '5511999990201',
        fromJid: '4444444444444@lid',
        text: 'oi',
        messageId: 'msg-lid-2',
      })

      await user.refresh()
      assert.equal(user.whatsappLid, '4444444444444@lid')
    } finally {
      teardownFake()
    }
  })

  test('divergência não sobrescreve o valor gravado', async ({ assert }) => {
    const fake = setupFake()
    try {
      const user = await UserFactory.merge({
        whatsappNumber: '5511999990202',
        whatsappLid: '5555555555555@lid',
      }).create()
      const handler = await app.container.make(WhatsAppInboundHandler)

      await handler.handle({
        fromNumber: '5511999990202',
        fromJid: '6666666666666@lid',
        text: 'oi',
        messageId: 'msg-lid-3',
      })

      await user.refresh()
      assert.equal(user.whatsappLid, '5555555555555@lid')
    } finally {
      teardownFake()
    }
  })

  test('/cadastro por @lid grava as duas identidades', async ({ assert }) => {
    const fake = setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)

      await handler.handle({
        fromNumber: '5511999990203',
        fromJid: '7777777777777@lid',
        text: '/cadastro Ana 🦅',
        messageId: 'msg-lid-4',
      })

      const user = await User.query().where('whatsapp_lid', '7777777777777@lid').first()
      assert.isNotNull(user)
      assert.equal(user!.whatsappNumber, '5511999990203')
      assert.equal(fake.sentDms[0].number, '7777777777777@lid')
    } finally {
      teardownFake()
    }
  })

  test('/cadastro por DM comum grava lid nulo', async ({ assert }) => {
    setupFake()
    try {
      const handler = await app.container.make(WhatsAppInboundHandler)

      await handler.handle({
        fromNumber: '5511999990204',
        fromJid: '5511999990204@s.whatsapp.net',
        text: '/cadastro Bruno 🐯',
        messageId: 'msg-lid-5',
      })

      const user = await User.query().where('whatsapp_number', '5511999990204').first()
      assert.isNull(user!.whatsappLid)
    } finally {
      teardownFake()
    }
  })
})
```

O primeiro caso é o que reproduz o incidente de 2026-07-29: usuário gravado só com lid, mensagem chegando com telefone resolvido.

- [ ] **Step 6: Rodar e confirmar que falha**

```bash
cd apps/api && node ace test functional --files='tests/functional/whatsapp_inbound_handler.spec.ts'
```

Esperado: o grupo novo falha; os grupos antigos continuam verdes.

- [ ] **Step 7: Implementar `resolveUser` e `healIdentity` no handler**

Em `apps/api/app/services/whatsapp_inbound_handler.ts`, adicionar os dois métodos privados:

```ts
private async resolveUser(msg: IncomingMessage): Promise<User | null> {
  const user = await this.userRepository.findByWhatsappIdentity(msg.fromNumber, msg.fromJid)
  if (user) await this.healIdentity(user, msg)
  return user
}

private async healIdentity(user: User, msg: IncomingMessage): Promise<void> {
  const incomingLid = msg.fromJid.endsWith('@lid') ? msg.fromJid : null
  const patch: { whatsappNumber?: string; whatsappLid?: string } = {}

  if (!user.whatsappNumber && msg.fromNumber) patch.whatsappNumber = msg.fromNumber
  if (!user.whatsappLid && incomingLid) patch.whatsappLid = incomingLid

  if (user.whatsappNumber && msg.fromNumber && user.whatsappNumber !== msg.fromNumber) {
    logger.warn(
      { userId: user.id, stored: user.whatsappNumber, incoming: msg.fromNumber },
      'WhatsAppInboundHandler: whatsapp_number divergente'
    )
  }
  if (user.whatsappLid && incomingLid && user.whatsappLid !== incomingLid) {
    logger.warn(
      { userId: user.id, stored: user.whatsappLid, incoming: incomingLid },
      'WhatsAppInboundHandler: whatsapp_lid divergente'
    )
  }

  if (Object.keys(patch).length === 0) return
  await this.userRepository.update(user, patch)
}
```

Trocar as três chamadas `findByWhatsappNumber(msg.fromNumber ?? msg.fromJid)` por `this.resolveUser(msg)`.

Em `handleRegister`, a criação passa a gravar as duas identidades:

```ts
await this.userRepository.create({
  name,
  emoji,
  whatsappNumber: msg.fromNumber,
  whatsappLid: msg.fromJid.endsWith('@lid') ? msg.fromJid : null,
  isAdmin: false,
})
```

`User` precisa ser importado como type no arquivo.

- [ ] **Step 8: Rodar e confirmar que passa**

```bash
cd apps/api && pnpm typecheck && node ace test functional --files='tests/functional/whatsapp_inbound_handler.spec.ts'
```

Esperado: todos os grupos verdes.

- [ ] **Step 9: Commitar**

```bash
git add apps/api/app/repositories/user_repository.ts \
        apps/api/app/services/whatsapp_inbound_handler.ts \
        apps/api/tests/functional/user_repository_identity.spec.ts \
        apps/api/tests/functional/whatsapp_inbound_handler.spec.ts
git commit
```

Mensagem:

```
fix(whatsapp): match users by phone or lid and backfill the missing one

Inbound lookup now ORs both identity columns, so a re-paired session that
starts resolving senderPn no longer orphans users registered by lid. The
handler fills whichever column is null on the first DM and warns instead of
overwriting on divergence.
```

---

### Task 4: DM proativa com identidade opcional e fechamento

**Files:**
- Modify: `apps/api/app/models/user.ts`
- Modify: `apps/api/app/services/whatsapp_notifier.ts:52-70`
- Modify: `apps/api/app/jobs/open_round_job.ts:75-100`
- Modify: `apps/api/commands/whatsapp/lookup_lid.ts:10`
- Modify: `apps/api/tests/functional/open_round_job.spec.ts`
- Modify: `apps/api/tests/functional/whatsapp_notifier.spec.ts:126`

**Interfaces:**
- Consumes: `whatsappLid` (Task 1).
- Produces: getter `User.whatsappTarget: string | null`; `WhatsAppNotifier.notifyRoundOpenedToUser` recebe `user.whatsappTarget: string` no lugar de `user.whatsappNumber`.

- [ ] **Step 1: Escrever o teste do job**

Em `apps/api/tests/functional/open_round_job.spec.ts`, adicionar ao grupo existente:

```ts
test('manda DM pelo lid quando o usuário não tem telefone', async ({ assert }) => {
  await SeasonFactory.merge({
    isActive: true,
    year: 2026,
    externalCompetitionCode: 'BSA',
  }).create()
  await UserFactory.merge({
    whatsappNumber: null,
    whatsappLid: '8888888888888@lid',
    name: 'Sem Telefone',
    emoji: '🐢',
  }).create()

  const { football, whatsapp } = setupFakes()
  football.standings = fakeStandings(12, 2026, { 1: 30, 2: 25 })
  football.matchesByMatchday.set('2026:12', [fakeMatch(1001, 1, 2, 12)])

  try {
    const job = await app.container.make(OpenRoundJob)
    const report = await job.run()

    assert.equal(report.runs[0].roundOpened, true)
    assert.lengthOf(whatsapp.sentDms, 1)
    assert.equal(whatsapp.sentDms[0].number, '8888888888888@lid')
    assert.match(whatsapp.sentDms[0].text, /Oi Sem Telefone 🐢!/)
  } finally {
    teardownFakes()
  }
}).timeout(15000)
```

Mesmo shape do teste `DM personalizada pra cada user após flip pra open`, que fica logo acima no arquivo — `setupFakes`, `fakeStandings` e `fakeMatch` já existem no escopo do grupo.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/api && node ace test functional --files='tests/functional/open_round_job.spec.ts'
```

Esperado: falha de tipo em `whatsappNumber: null`, ou nenhuma DM enviada para o lid.

- [ ] **Step 3: Adicionar o getter no model**

Em `apps/api/app/models/user.ts`:

```ts
get whatsappTarget(): string | null {
  return this.whatsappNumber ?? this.whatsappLid
}
```

Getter simples, sem `@computed` — assim não entra na serialização e `tests/functional/guesses.spec.ts:140` (que assere ausência de `whatsappNumber` na resposta) continua válido.

- [ ] **Step 4: Ajustar o notifier**

Em `apps/api/app/services/whatsapp_notifier.ts`, a assinatura de `notifyRoundOpenedToUser` troca o campo:

```ts
user: { whatsappTarget: string; name: string; emoji: string }
```

e o envio final vira `await this.client.sendToUser(args.user.whatsappTarget, text)`.

- [ ] **Step 5: Ajustar o job**

Em `apps/api/app/jobs/open_round_job.ts`, dentro do laço de usuários, antes do envio:

```ts
const target = user.whatsappTarget
if (!target) {
  logger.warn({ userId: user.id }, 'OpenRoundJob: usuário sem identidade de WhatsApp')
  continue
}
```

e o objeto passado ao notifier usa `whatsappTarget: target` no lugar de `whatsappNumber: user.whatsappNumber`.

O `await new Promise((r) => setTimeout(r, 1000))` de throttle fica **depois** do `continue`, ou seja, usuário pulado não gasta o segundo de espera.

- [ ] **Step 6: Atualizar o spec do notifier**

Em `apps/api/tests/functional/whatsapp_notifier.spec.ts:126`, trocar `whatsappNumber: '5511987654321'` por `whatsappTarget: '5511987654321'`.

- [ ] **Step 7: Corrigir a descrição do comando**

Em `apps/api/commands/whatsapp/lookup_lid.ts:10`, a descrição passa a citar `users.whatsapp_lid` em vez de `users.whatsapp_number`.

- [ ] **Step 8: Rodar a bateria completa do CI**

```bash
cd /home/netohelvecio/projetos_pessoais/palpites-brasileirao && \
  pnpm --filter @palpites/api typecheck && \
  pnpm --filter @palpites/api lint && \
  pnpm --filter @palpites/api format:check && \
  pnpm --filter @palpites/api test
```

Esperado: tudo verde. Se `format:check` reclamar de `database/schema.ts`, rode `pnpm --filter @palpites/api format`.

- [ ] **Step 9: Atualizar o CLAUDE.md do `apps/api`**

A seção "Identidade do user no WhatsApp" descreve o modelo antigo (uma coluna aceitando os dois formatos). Reescrever para o modelo de duas colunas, citando a busca por `OR`, a auto-cura e os índices parciais.

- [ ] **Step 10: Commitar**

```bash
git add apps/api/app apps/api/commands apps/api/tests apps/api/CLAUDE.md
git commit
```

Mensagem:

```
feat(whatsapp): fall back to lid when sending proactive DMs

Adds User.whatsappTarget so round-opening DMs still reach users whose phone
number has not been learned yet, and skips users with no identity at all.
```

---

## Notas de deploy

Este plano **não** inclui o deploy. Quando for subir:

- O `deploy.yml` sobe o container novo (linha 77) e só roda `migration:run` depois do health check (linha 95). Existe uma janela de até ~60s com código novo contra schema velho — uma DM que chegue nela bate em `column "whatsapp_lid" does not exist`. Suba em horário morto.
- O restart **não** exige re-pareamento: o volume `whatsapp_auth` persiste.
- Depois da migration, sua linha fica com `whatsapp_lid` preenchido e `whatsapp_number` NULL. Se quiser adiantar a sua, o par já é conhecido:

```sql
UPDATE users SET whatsapp_number = '557196916296', updated_at = now()
WHERE whatsapp_lid = '1348703617067@lid';
```

Os demais convergem sozinhos na primeira DM de cada um.
