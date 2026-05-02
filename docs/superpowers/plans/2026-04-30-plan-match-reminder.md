# Plano — Match Reminder T-30min (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postar mensagem no grupo WhatsApp ~30min antes do kickoff do jogo da rodada, com idempotência durável (flag em `matches`).

**Architecture:**
- Novo cron `*/5 * * * *` em `start/scheduler.ts` dispara `MatchReminderJob`.
- Job consulta `RoundRepository.listOpenWithKickoffWithin(now, 30)` (filtra `status=OPEN` + janela de kickoff + flag null), envia template via `WhatsAppNotifier.notifyMatchReminder`, depois stampa `matches.reminder_30_min_sent_at`.
- Migration `0008_` adiciona a coluna nullable. Schema TS regenera via `node ace migration:run`.

**Tech Stack:** Adonis 7, Lucid ORM, node-cron, Baileys (via port `WhatsAppClient` swap em testes), Japa (test runner), Luxon (DateTime).

**Spec:** `docs/superpowers/specs/2026-04-30-match-reminder-30min-design.md`

> ⚠️ **Commits manuais.** Cada Task termina com sugestão de mensagem; o usuário commita à mão (preferência do projeto). NÃO rodar `git commit`/`git push` automaticamente.

> ⚠️ **Branch:** `feat/match-reminder-30min` (já criada e checked out). Trabalhar nela.

---

## Task 1: Migration + regenerar schema

**Files:**
- Create: `apps/api/database/migrations/0008_add_reminder_30_min_sent_at_to_matches.ts`
- Auto-regen: `apps/api/database/schema.ts` (NÃO editar à mão; é regenerado pelo `migration:run`)

- [ ] **Step 1: Garantir que `nvm use` está ativo no shell**

```bash
nvm use
```

Esperado: Node `v24.14.0`. Sem isso, comandos `node ace ...` quebram com `ERR_UNKNOWN_FILE_EXTENSION`.

- [ ] **Step 2: Criar a migration**

Conteúdo de `apps/api/database/migrations/0008_add_reminder_30_min_sent_at_to_matches.ts`:

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('reminder_30_min_sent_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('reminder_30_min_sent_at')
    })
  }
}
```

- [ ] **Step 3: Rodar a migration no banco de dev**

```bash
cd apps/api && node ace migration:run
```

Esperado: log `migrated 0008_add_reminder_30_min_sent_at_to_matches` e nenhum erro.

- [ ] **Step 4: Verificar regen do schema TS**

`apps/api/database/schema.ts` deve ter ganho `reminder30MinSentAt` (camelCase de `reminder_30_min_sent_at` — Adonis usa lodash camelCase) na lista `$columns` da `MatchSchema` e a declaração `@column.dateTime() declare reminder30MinSentAt: DateTime | null`.

> ⚠️ **Confirme o nome regenerado.** O esperado é `reminder30MinSentAt`. Se o regen produzir outro (`reminder_30_min_sent_at` quoted, etc.), use o nome real em todos os passos seguintes deste plano e nos asserts dos testes.

- [ ] **Step 5: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Esperado: zero erros.

- [ ] **Step 6: Sugestão de commit (manual)**

Mensagem:
```
feat(db): add matches.reminder_30_min_sent_at flag for T-30 reminder
```

Arquivos: `apps/api/database/migrations/0008_*.ts`, `apps/api/database/schema.ts`.

---

## Task 2: Template + Notifier method + Repository method

**Files:**
- Create: `apps/api/app/integrations/whatsapp/templates/match_reminder.ts`
- Create: `apps/api/tests/unit/match_reminder_template.spec.ts`
- Modify: `apps/api/app/services/whatsapp_notifier.ts`
- Modify: `apps/api/app/repositories/round_repository.ts`

- [ ] **Step 1: Escrever o teste do template (failing)**

Conteúdo de `apps/api/tests/unit/match_reminder_template.spec.ts`:

```ts
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { matchReminderMessage } from '#integrations/whatsapp/templates/match_reminder'

test.group('matchReminderMessage', () => {
  test('formata mensagem com kickoff em America/Sao_Paulo', ({ assert }) => {
    // 19:00 UTC = 16:00 America/Sao_Paulo (UTC-3)
    const kickoffAt = DateTime.fromISO('2026-05-04T19:00:00.000Z')
    const text = matchReminderMessage({
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt,
    })

    assert.equal(
      text,
      [
        '⏰ Faltam 30 min!',
        '⚽ Palmeiras x Flamengo',
        '🕘 Início: 16:00',
      ].join('\n')
    )
  })

  test('respeita timezone independente da TZ do input', ({ assert }) => {
    // mesmo instante, mas DateTime construído em UTC vs SP — output deve ser igual
    const utc = DateTime.fromISO('2026-05-04T22:30:00.000Z', { zone: 'utc' })
    const text = matchReminderMessage({
      homeTeam: 'A',
      awayTeam: 'B',
      kickoffAt: utc,
    })

    assert.match(text, /🕘 Início: 19:30/)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
cd apps/api && node ace test unit --files='tests/unit/match_reminder_template.spec.ts'
```

Esperado: FAIL com algo como `Cannot find module '#integrations/whatsapp/templates/match_reminder'`.

- [ ] **Step 3: Implementar o template**

Conteúdo de `apps/api/app/integrations/whatsapp/templates/match_reminder.ts`:

```ts
import type { DateTime } from 'luxon'

export interface MatchReminderInput {
  homeTeam: string
  awayTeam: string
  kickoffAt: DateTime
}

export function matchReminderMessage(input: MatchReminderInput): string {
  const kickoff = input.kickoffAt.setZone('America/Sao_Paulo').toFormat('HH:mm')
  return [
    `⏰ Faltam 30 min!`,
    `⚽ ${input.homeTeam} x ${input.awayTeam}`,
    `🕘 Início: ${kickoff}`,
  ].join('\n')
}
```

- [ ] **Step 4: Rodar teste para confirmar passa**

```bash
cd apps/api && node ace test unit --files='tests/unit/match_reminder_template.spec.ts'
```

Esperado: 2 PASS.

- [ ] **Step 5: Adicionar método no `WhatsAppNotifier`**

Em `apps/api/app/services/whatsapp_notifier.ts`:

Adicionar import no topo (perto dos outros template imports):

```ts
import {
  matchReminderMessage,
  type MatchReminderInput,
} from '#integrations/whatsapp/templates/match_reminder'
```

Adicionar método dentro da classe (depois de `notifyGuessRegistered`, antes do `}` que fecha a classe):

```ts
async notifyMatchReminder(input: MatchReminderInput): Promise<void> {
  await this.client.sendToGroup(matchReminderMessage(input))
}
```

- [ ] **Step 6: Adicionar método no `RoundRepository`**

Em `apps/api/app/repositories/round_repository.ts`, adicionar método dentro da classe (depois de `findOpenInActiveSeason`):

```ts
listOpenWithKickoffWithin(now: DateTime, windowMinutes: number) {
  const upper = now.plus({ minutes: windowMinutes })
  return Round.query()
    .where('status', RoundStatus.OPEN)
    .whereHas('match', (m) => {
      m.where('kickoff_at', '>', now.toJSDate())
        .andWhere('kickoff_at', '<=', upper.toJSDate())
        .whereNull('reminder_30_min_sent_at')
    })
    .preload('match')
}
```

`DateTime` já está importado de `luxon`; `RoundStatus` já está importado de `@palpites/shared`. Sem novos imports.

- [ ] **Step 7: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Esperado: zero erros.

- [ ] **Step 8: Rodar suíte unit completa**

```bash
cd apps/api && node ace test unit
```

Esperado: tudo passa, sem regressões.

- [ ] **Step 9: Sugestão de commit (manual)**

Mensagem:
```
feat(whatsapp): add match reminder template + notifier + repo query
```

Arquivos:
- `apps/api/app/integrations/whatsapp/templates/match_reminder.ts`
- `apps/api/tests/unit/match_reminder_template.spec.ts`
- `apps/api/app/services/whatsapp_notifier.ts`
- `apps/api/app/repositories/round_repository.ts`

---

## Task 3: `MatchReminderJob` + functional tests

**Files:**
- Create: `apps/api/app/jobs/match_reminder_job.ts`
- Create: `apps/api/tests/functional/match_reminder_job.spec.ts`

- [ ] **Step 1: Escrever os testes funcionais (failing)**

Conteúdo completo de `apps/api/tests/functional/match_reminder_job.spec.ts`:

```ts
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import MatchReminderJob from '#jobs/match_reminder_job'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { SeasonFactory } from '#factories/season_factory'
import { RoundFactory } from '#factories/round_factory'
import { MatchFactory } from '#factories/match_factory'
import { FakeWhatsAppClient } from '#tests/helpers/whatsapp_mock'

test.group('MatchReminderJob', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('envia reminder e stampa flag quando kickoff está em ~28min e flag null', async ({
    assert,
  }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      homeTeam: 'Palmeiras',
      awayTeam: 'Flamengo',
      kickoffAt: DateTime.now().plus({ minutes: 28 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 1)
      assert.deepEqual(report.sentRoundIds, [round.id])
      assert.equal(report.errorCount, 0)

      assert.lengthOf(whatsapp.sentMessages, 1)
      assert.match(whatsapp.sentMessages[0], /Faltam 30 min/)
      assert.match(whatsapp.sentMessages[0], /Palmeiras x Flamengo/)

      const fresh = await match.refresh()
      assert.isNotNull(fresh.reminder30MinSentAt)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('não envia se flag já está stampada (idempotência)', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 15 }),
      reminder30MinSentAt: DateTime.now().minus({ minutes: 5 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora kickoff fora da janela (>30min)', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 60 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora kickoff já passado', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().minus({ minutes: 5 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('ignora rounds em status pending / closed / finished', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const statuses = ['pending', 'closed', 'finished'] as const
    for (const [i, status] of statuses.entries()) {
      const r = await RoundFactory.merge({
        seasonId: season.id,
        number: i + 1,
        status,
      }).create()
      await MatchFactory.merge({
        roundId: r.id,
        kickoffAt: DateTime.now().plus({ minutes: 20 }),
      }).create()
    }

    const whatsapp = new FakeWhatsAppClient()
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('WhatsApp offline: não envia, flag continua null, errorCount=0', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 20 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    whatsapp.setConnected(false)
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.equal(report.errorCount, 0)
      assert.lengthOf(whatsapp.sentMessages, 0)

      const fresh = await match.refresh()
      assert.isNull(fresh.reminder30MinSentAt)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })

  test('send falha: não stampa flag, errorCount=1', async ({ assert }) => {
    const season = await SeasonFactory.create()
    const round = await RoundFactory.merge({ seasonId: season.id, status: 'open' }).create()
    const match = await MatchFactory.merge({
      roundId: round.id,
      kickoffAt: DateTime.now().plus({ minutes: 20 }),
    }).create()

    const whatsapp = new FakeWhatsAppClient()
    whatsapp.throwOnSend = new Error('baileys timeout')
    app.container.swap(WhatsAppClient, () => whatsapp)
    try {
      const job = await app.container.make(MatchReminderJob)
      const report = await job.run()

      assert.equal(report.sentCount, 0)
      assert.equal(report.errorCount, 1)

      const fresh = await match.refresh()
      assert.isNull(fresh.reminder30MinSentAt)
    } finally {
      app.container.restore(WhatsAppClient)
    }
  })
})
```

> **Nota:** `reminder30MinSentAt` no merge do factory pressupõe que o nome camelCase regenerado é esse. Se o schema regenerou com nome diferente (ex.: `reminder30MinSentAt`), substituir nos asserts e merges.

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
cd apps/api && node ace test functional --files='tests/functional/match_reminder_job.spec.ts'
```

Esperado: FAIL com `Cannot find module '#jobs/match_reminder_job'`.

- [ ] **Step 3: Implementar o job**

Conteúdo de `apps/api/app/jobs/match_reminder_job.ts`:

```ts
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import RoundRepository from '#repositories/round_repository'
import MatchRepository from '#repositories/match_repository'
import WhatsAppNotifier from '#services/whatsapp_notifier'

export interface MatchReminderReport {
  sentCount: number
  sentRoundIds: string[]
  errorCount: number
}

@inject()
export default class MatchReminderJob {
  constructor(
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private notifier: WhatsAppNotifier
  ) {}

  async run(now: DateTime = DateTime.now()): Promise<MatchReminderReport> {
    const rounds = await this.roundRepository.listOpenWithKickoffWithin(now, 30)
    const sentRoundIds: string[] = []
    let errorCount = 0

    for (const round of rounds) {
      if (!this.notifier.isReady()) {
        logger.warn({ roundId: round.id }, 'MatchReminderJob: WhatsApp offline — skipping')
        continue
      }

      try {
        await this.notifier.notifyMatchReminder({
          homeTeam: round.match.homeTeam,
          awayTeam: round.match.awayTeam,
          kickoffAt: round.match.kickoffAt,
        })
        await this.matchRepository.update(round.match, {
          reminder30MinSentAt: DateTime.now(),
        })
        sentRoundIds.push(round.id)
      } catch (err) {
        errorCount++
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ roundId: round.id, err: msg }, 'MatchReminderJob: falha em round')
      }
    }

    const report = { sentCount: sentRoundIds.length, sentRoundIds, errorCount }
    logger.info(report, 'MatchReminderJob: finished')
    return report
  }
}
```

> **Nota:** se o schema regenerou o nome da coluna como `reminder30MinSentAt` (ou outro), substituir `reminder30MinSentAt` no payload do `update`.

- [ ] **Step 4: Rodar testes para confirmar passa**

```bash
cd apps/api && node ace test functional --files='tests/functional/match_reminder_job.spec.ts'
```

Esperado: 7 PASS, 0 FAIL.

- [ ] **Step 5: Rodar suíte completa**

```bash
cd apps/api && node ace test
```

Esperado: tudo passa, sem regressões.

- [ ] **Step 6: Typecheck + lint**

```bash
cd apps/api && pnpm typecheck && pnpm lint
```

Esperado: zero erros.

- [ ] **Step 7: Sugestão de commit (manual)**

Mensagem:
```
feat(jobs): add MatchReminderJob with idempotent T-30 send
```

Arquivos:
- `apps/api/app/jobs/match_reminder_job.ts`
- `apps/api/tests/functional/match_reminder_job.spec.ts`

---

## Task 4: Wire scheduler + ace command + smoke manual

**Files:**
- Modify: `apps/api/start/scheduler.ts`
- Create: `apps/api/commands/jobs/run_match_reminder.ts`

- [ ] **Step 1: Adicionar import e cron no scheduler**

Em `apps/api/start/scheduler.ts`:

Adicionar import junto dos outros (após `import SyncScoresJob from '#jobs/sync_scores_job'`):

```ts
import MatchReminderJob from '#jobs/match_reminder_job'
```

Adicionar bloco de cron (após o bloco do `SyncScoresJob`, antes do `logger.info`):

```ts
// MatchReminderJob: a cada 5 min
cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const job = await app.container.make(MatchReminderJob)
      await job.run()
    } catch (err) {
      logger.error({ err }, 'scheduler: MatchReminderJob crashed')
    }
  },
  { timezone: TZ }
)
```

- [ ] **Step 2: Criar ace command pra disparo manual em dev**

Conteúdo de `apps/api/commands/jobs/run_match_reminder.ts`:

```ts
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import MatchReminderJob from '#jobs/match_reminder_job'
import WhatsAppClient from '#integrations/whatsapp/whatsapp_client'
import { withWhatsAppConnection } from '#integrations/whatsapp/with_command_connection'

export default class RunMatchReminder extends BaseCommand {
  static commandName = 'jobs:run-match-reminder'
  static description = 'Dispara o MatchReminderJob manualmente (útil em dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const client = await this.app.container.make(WhatsAppClient)

    try {
      await withWhatsAppConnection(client, async () => {
        const job = await this.app.container.make(MatchReminderJob)
        const report = await job.run()
        this.logger.info(JSON.stringify(report, null, 2))
      })
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err))
      this.exitCode = 1
    }
  }
}
```

- [ ] **Step 3: Verificar que o ace registra o command**

```bash
cd apps/api && node ace list | grep run-match-reminder
```

Esperado: linha com `jobs:run-match-reminder ...`.

> Se não aparecer, Adonis 7 auto-discover commands em `commands/**/*.ts` ao subir. Confirme nome do arquivo e da classe.

- [ ] **Step 4: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Esperado: zero erros.

- [ ] **Step 5: Smoke manual em dev (opcional, recomendado antes do merge)**

> ⚠️ **Pré-requisitos:**
> 1. Parar `pnpm dev` se estiver rodando (auth multi-file do Baileys não suporta duas sessões simultâneas)
> 2. Ter pelo menos uma `season` ativa, uma `round` em status `open`, e um `match` com `kickoff_at` em ~25-30min no futuro **e** `reminder_30_min_sent_at` null no banco de dev
> 3. `WHATSAPP_MODE=real` configurado e Baileys autenticado

Disparar:
```bash
cd apps/api && node ace jobs:run-match-reminder
```

Esperado:
- Mensagem chega no grupo de teste do WhatsApp
- Log final do command imprime `{ "sentCount": 1, "sentRoundIds": ["..."], "errorCount": 0 }`
- Re-rodar imediatamente: `sentCount: 0` (idempotência via flag)

> Se quiser testar sem afetar o WhatsApp real, use `WHATSAPP_MODE=stub` e verifique nos logs que `StubClient.sendToGroup` foi chamado.

- [ ] **Step 6: Lint final**

```bash
cd apps/api && pnpm lint
```

Esperado: zero erros.

- [ ] **Step 7: Sugestão de commit (manual)**

Mensagem:
```
feat(scheduler): wire MatchReminderJob cron + ace command
```

Arquivos:
- `apps/api/start/scheduler.ts`
- `apps/api/commands/jobs/run_match_reminder.ts`

---

## Pós-implementação (atualização do CLAUDE.md raiz)

- [ ] **Atualizar tabela de roadmap em `CLAUDE.md`** (raiz do monorepo)

Adicionar linha após Plano 6:

```
| Plano 7 (7.1) | ✅ concluído | Match Reminder T-30min — cron `*/5min` + flag `reminder_30_min_sent_at` em matches; mensagem simples sem escalações (Fase 2 deferida). Spec/plano em `docs/superpowers/specs/2026-04-30-match-reminder-30min-design.md` e `docs/superpowers/plans/2026-04-30-plan-match-reminder.md` |
```

(Numeração "Plano 7" é proposta — usuário decide se mantém ou se chama de outra coisa).

Sugestão de commit (manual):
```
docs: mark match reminder phase 1 complete in roadmap
```

---

## Self-review — coverage check vs spec

| Spec section | Coberto em |
|---|---|
| Migration `0008_*` reminder_30_min_sent_at | Task 1 |
| Template `match_reminder.ts` | Task 2 step 3 (+ test step 1) |
| `WhatsAppNotifier.notifyMatchReminder` | Task 2 step 5 |
| `RoundRepository.listOpenWithKickoffWithin` | Task 2 step 6 |
| `MatchReminderJob` orquestrador | Task 3 step 3 |
| Cron `*/5 * * * *` no scheduler | Task 4 step 1 |
| Ace command `jobs:run-match-reminder` | Task 4 step 2 |
| Tests: janela in/out, status filter, offline, send falha, idempotência, kickoff passado | Task 3 step 1 (7 cenários) |
| Tests do template (timezone) | Task 2 step 1 (2 cenários) |
| Future work (Fase 2 escalações) | Não aplicável a este plano (deferido por design) |
| Smoke manual antes do deploy | Task 4 step 5 |

Sem gaps.
