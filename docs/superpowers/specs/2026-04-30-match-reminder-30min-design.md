# Match Reminder T-30min — Design

**Data:** 2026-04-30
**Status:** Aprovado, pronto pra implementação (Fase 1)
**Branch:** `feat/match-reminder-30min`

## Contexto

Hoje, quando o jogo da rodada começa, ninguém é avisado em tempo real — os palpiteiros só sabem que o palpite "fechou" quando o `CloseRoundJob` posta no grupo no kickoff (ou logo depois). Falta um aviso de proximidade pra dar a "última chance".

Esta feature adiciona um lembrete automático no grupo do WhatsApp **30 minutos antes do kickoff** do jogo da rodada. Escalações foram avaliadas e ficam pra **Fase 2** (ver "Future Work").

## Goals

- Postar uma mensagem no grupo do WhatsApp ~30min antes do kickoff do jogo da rodada
- Idempotência durável: mesmo com restart do processo ou múltiplos ticks de cron, cada jogo recebe no máximo um lembrete
- Degradação graciosa: WhatsApp offline ou erro de envio → retry automático no próximo tick (até o kickoff)

## Non-goals (Fase 1)

- Escalações dos times no lembrete (Fase 2 — ver "Future Work")
- DM individual pros usuários (lembrete é só no grupo)
- Lembretes em janelas adicionais (ex.: T-2h, T-10min)
- Configuração runtime do offset (30min é hardcoded; mudar exige deploy)

## Constraints / decisões herdadas

- **Stack atual** (pré-existente, não muda): Adonis 7 + node-cron + Baileys + football-data.org free tier
- **football-data.org free tier não expõe escalações** — o endpoint `/matches/{id}` retorna só id/status/kickoff/times/placar. Lineups exigem TIER_ONE+ (€20-50/mês). Por isso a Fase 2 (escalações) precisa de fonte alternativa.
- **Um jogo por rodada** (`matches.round_id UNIQUE`) — cada round tem no máximo um jogo a lembrar
- **Scheduler em memória** — cron jobs em `start/scheduler.ts` rodam no processo da API (sem Redis/BullMQ por YAGNI). Idempotência precisa ser durável no DB, não in-memory.
- **TZ `America/Sao_Paulo`** já é o default dos crons existentes

## Architecture

### Componentes novos (Fase 1)

```
apps/api/
  database/migrations/
    0008_add_reminder_30_min_sent_at_to_matches.ts  ← migration nova

  app/
    integrations/whatsapp/templates/
      match_reminder.ts                              ← template novo
    services/
      whatsapp_notifier.ts                           ← +1 método: notifyMatchReminder
    repositories/
      round_repository.ts                            ← +1 método: listOpenWithKickoffWithin
    jobs/
      match_reminder_job.ts                          ← job novo

  start/
    scheduler.ts                                     ← +1 cron: */5 * * * * → MatchReminderJob

  commands/jobs/
    run_match_reminder.ts                            ← ace command pra disparo manual em dev
```

### Data flow

```
node-cron tick (every 5min)
  ↓
MatchReminderJob.run(now = DateTime.now())
  ↓
roundRepository.listOpenWithKickoffWithin(now, 30min)
  ↓ retorna rounds OPEN com match.kickoff_at ∈ (now, now + 30min] AND match.reminder_30_min_sent_at IS NULL
loop por round:
  ↓
  if !notifier.isReady(): skip + log warn (flag fica null → retry no próximo tick)
  ↓
  notifier.notifyMatchReminder({ homeTeam, awayTeam, kickoffAt })
  ↓
  matchRepository.update(match, { reminder30MinSentAt: DateTime.now() })
  ↓
log report
```

### Mensagem (template)

```
⏰ Faltam 30 min!
⚽ {homeTeam} x {awayTeam}
🕘 Início: {HH:mm}
```

Format do `kickoffAt`: `setZone('America/Sao_Paulo').toFormat('HH:mm')`. Sem data — proximidade temporal já tá implícita no "faltam 30 min".

## Componentes — detalhamento

### 1. Migration `0008_add_reminder_30_min_sent_at_to_matches.ts`

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

Coluna nullable, timestamp com timezone (consistente com `kickoff_at`). Após `migration:run`, `database/schema.ts` é regenerado automaticamente pelo Adonis 7 — não editar à mão.

### 2. Template `match_reminder.ts`

Padrão idêntico aos outros templates em `app/integrations/whatsapp/templates/`:

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

### 3. `WhatsAppNotifier.notifyMatchReminder`

Espelha os outros métodos `notify*`:

```ts
async notifyMatchReminder(input: MatchReminderInput): Promise<void> {
  await this.client.sendToGroup(matchReminderMessage(input))
}
```

### 4. `RoundRepository.listOpenWithKickoffWithin`

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

Observações:
- Filtro `kickoff_at > now` exclui jogos que já começaram (esses são CloseRoundJob / SyncScoresJob)
- `whereNull('reminder_30_min_sent_at')` garante idempotência
- `preload('match')` evita N+1 no job

### 5. `MatchReminderJob`

```ts
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

Padrão de error handling segue `CloseRoundJob` (logger.error + errorCount + continua loop, não joga).

### 6. Scheduler (`start/scheduler.ts`)

Adicionar mais um bloco `cron.schedule`, mesmo padrão dos existentes:

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

### 7. Ace command `run_match_reminder.ts`

Convenção do repo é ter um `ace command` por job pra disparo manual em dev (`commands/jobs/run-*`). Espelha `run_close_round.ts`, com `static options = { startApp: true }` e `withWhatsAppConnection`.

## Critério de envio — janela e timing

| Cenário | Comportamento |
|---|---|
| Cron tick em T-30 (jogo às 16:00, tick às 15:30) | `kickoff_at ∈ (15:30, 16:00]` → match incluído → envia |
| Cron tick em T-25 (tick às 15:35) | `kickoff_at ∈ (15:35, 16:05]` → match incluído (mas flag já tá set) → não envia |
| Cron tick em T-31 (tick às 15:29) | `kickoff_at = 16:00 ∉ (15:29, 15:59]` → match NÃO incluído ainda |
| Cron tick após kickoff | `kickoff_at <= now` → exclui |
| WhatsApp offline em T-30, recupera em T-15 | Tick T-30: skip. Tick T-15: `kickoff_at ∈ (15:45, 16:15]` → match ainda incluído → envia (atrasado mas válido) |
| Round PENDING em T-30 (OpenRoundJob lagou) | Filtro `status = OPEN` exclui. Lembrete é perdido nessa edição. Aceitável: caso raro (OpenRoundJob roda a cada 30min, kickoffs não caem em horário cheio em geral) |

**Janela efetiva de envio:** 25-30 min antes do kickoff, com tolerância de ~5min pra cima se WhatsApp ficar offline. Aceitável pro caso de uso.

## Error handling

| Falha | Resposta |
|---|---|
| `notifier.isReady() === false` (WhatsApp offline) | log warn, skip round, **flag fica null** → próximo tick retenta |
| Exception no `client.sendToGroup` (timeout, rate limit Baileys, etc.) | log error, errorCount++, **flag fica null** → próximo tick retenta. Continua loop pros próximos rounds |
| Exception no `matchRepository.update` (DB caiu entre send e stamp) | log error, errorCount++, **flag fica null** → próximo tick **vai duplicar a mensagem**. Trade-off aceitável: DB caindo entre send e stamp é cenário extremamente raro; duplicar reminder é menos pior do que falso "enviado" |
| `currentMatchday` mudou e o `match` da round foi sobrescrito | Não relevante — o `reminder_30_min_sent_at` continua persistido na linha de matches; se a row for recriada (rare), começa null novamente. Aceitável. |

## Testing

### Unit (sem DB, mocks)

- `match_reminder.spec.ts` (template): formata mensagem com kickoff em SP timezone
- (Job é orquestrador, sem lógica pura própria — testes ficam na functional)

### Functional (com DB de teste, fixtures)

- `match_reminder_job.spec.ts`:
  - cenário "jogo a 28min, OPEN, flag null" → envia + stampa flag
  - cenário "jogo a 28min, OPEN, flag já set" → não envia
  - cenário "jogo a 60min, OPEN, flag null" → não envia (fora da janela)
  - cenário "jogo a 28min, PENDING, flag null" → não envia (status filter)
  - cenário "jogo a 28min, OPEN, WhatsApp offline" → não envia, flag continua null, errorCount=0
  - cenário "jogo a 28min, OPEN, send falha" → não stampa flag, errorCount=1
  - cenário "kickoff já passou, OPEN, flag null" → não envia (filtro `kickoff_at > now`)

- `RoundRepository.listOpenWithKickoffWithin` ganha cobertura via os tests do job (não precisa spec separado pro repo)

### Manual (sanity)

Antes de deploy:

```bash
# para o pnpm dev primeiro (chip Baileys não pode ter duas conexões)
node ace jobs:run-match-reminder
```

Verifica que mensagem chega no grupo de teste.

## Future work — Fase 2 (escalações)

**Decisão atual:** não implementar nesta branch. Investigar quando user priorizar.

**Alternativas avaliadas:**

| Fonte | Mecanismo | Cobertura | Custo | Risco |
|---|---|---|---|---|
| **GE (api.globoesporte.globo.com)** | API interna não-documentada, JSON | Alta | Grátis | Médio — pode quebrar; mapping `match.externalId (football-data) → eventId (GE)` exige layer (time + data) |
| **OGol** | HTML scraping | Média | Grátis | Baixo se layout estável |
| **API-Football v3 paid** | API REST oficial | Alta | ~$10/mo | Baixo — descartado no Plano 2 por free tier não cobrir BSA, paid resolve |
| **CBF / ESPN Brasil** | SPA pesado | Alta | Grátis | Alto — exige headless browser |
| **Sofascore / SoccerWay** | — | — | — | Bloqueiam scraping ativamente; descartado |

**Recomendação pra Fase 2:** spike de 1 dia em GE. Validar:
1. Existe endpoint estável `api.globoesporte.globo.com/.../escalacoes/...` que devolve titulares JSON?
2. Como mapear `home_team_name + kickoff_date` → `eventId` GE?
3. Latência: GE costuma postar lineups ~60-90min antes do kickoff. T-30 do nosso job é tarde demais? Talvez sim — pode exigir ajuste do offset (T-45?) ou job separado de scraping.

Se spike falhar, escalar pra avaliar API-Football paid.

**Abstração proposta pra Fase 2:** `LineupProvider` (port) com impls `stub`/`disabled`/`real`, espelhando o padrão do `WhatsAppClient`. `MatchReminderJob` chama `lineupProvider.fetch(match)` e enriquece mensagem se retornar dados; senão, manda template simples.

## Risks / open questions

- **WhatsApp offline durante toda a janela:** se Baileys ficar offline de T-30 até depois do kickoff, o lembrete é perdido permanentemente. Aceitável — outros jobs (close, sync_scores) sofrem da mesma limitação e o user não considerou crítico.
- **Cron drift no Oracle VM:** se a VM ficar sob load alto e ticks atrasarem >5min, a janela aperta. Não é problema observado hoje (CloseRoundJob roda no mesmo cron), mas vale monitorar via logs.
- **Quem stampa o flag se `matchRepository.update` falhar entre send e stamp?** Resposta: ninguém — duplica no próximo tick. Cenário raro o suficiente pra não justificar transação distribuída ou outbox.

## Implementation plan

Será detalhado em plano separado (`docs/superpowers/plans/2026-04-30-plan-match-reminder.md`) via skill `writing-plans`. Estimativa: **3-4 tarefas pequenas**:

1. Migration + regenerar schema
2. Template + notifier method + repo method (pure / unit-testable)
3. Job + ace command + functional tests
4. Wire no scheduler + smoke manual
