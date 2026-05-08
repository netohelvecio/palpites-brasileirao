# Tied Featured Match Poll — Design

**Data**: 2026-05-07
**Status**: aprovado para planejamento

## Problema

O `pickFeaturedMatch` escolhe o jogo da rodada por maior soma de pontos `(homePts + awayPts)`. Quando ≥2 fixtures empatam no maior valor, hoje vence silenciosamente o primeiro encontrado no array — comportamento arbitrário. Queremos delegar a escolha ao grupo via **enquete no WhatsApp**, com o admin homologando a escolha manualmente.

Exceção: se um dos empatados for **1×2 (top1 da tabela contra top2)**, ele vence o desempate automaticamente — é a "rodada dobrada" e prevalece sobre votação.

## Solução em uma frase

Quando o sync detecta empate sem 1×2, persiste os candidatos numa tabela auxiliar, marca a rodada como `awaiting_pick`, manda enquete (com fallback texto+emoji) no grupo, e expõe HTTP + comando WhatsApp `/escolher <n>` pro admin homologar; depois disso o ciclo de abertura existente segue intacto.

## Regras de domínio

1. **Empate**: ≥2 fixtures com a mesma soma máxima de pontos da tabela.
2. **Tie-break automático 1×2**: dentro do grupo empatado, se algum fixture for `top1 vs top2`, ele vence sem enquete (continua sendo `kind: 'unique'` no picker, com `pointsMultiplier: 2`).
3. **Empate sem 1×2** → enquete no grupo. Admin lê os votos manualmente e escolhe via API/WhatsApp.
4. **Idempotência**: a enquete é enviada **uma única vez** por rodada empatada. Cron rodando a cada 30min não re-envia.
5. **Pós-escolha**: rodada volta pra `pending` com `match` criado; próximo tick do `OpenRoundJob` (≤30min) abre normalmente — anúncio no grupo + DMs personalizadas — sem código novo de abertura.
6. **Multiplier do match escolhido**: sempre `1`. Por construção, qualquer candidato 1×2 vira `kind: 'unique'` no picker (tie-break) e nunca chega à enquete; logo nenhum candidato persistido representa 1×2.

## Arquitetura

### Fluxo

```
OpenRoundJob (cron */30m)
  └─→ FixturesSyncService.syncCurrentMatchday(seasonId)
        ├─ round.status === 'awaiting_pick' → return early skipped
        ├─ pick = pickFeaturedMatch(...)
        │   ├─ kind:'unique'  → cria round + match (fluxo atual, nada muda)
        │   └─ kind:'tie'     → cria round AWAITING_PICK + bulk insert candidatos
        └─ se status virou awaiting_pick e poll ainda não enviada
            → notifier.notifyTieCandidatesPoll(...)
              ├─ tenta sendPollToGroup → registra poll_message_id
              └─ falha → fallback sendToGroup(textWithEmojiList)

Admin escolhe (HTTP POST /rounds/:id/pick-candidate OU DM /escolher <n>)
  └─→ RoundCandidatePickService.pick(candidateId)
        em transaction:
          - cria match (multiplier do candidato)
          - round.status = 'pending'
          - soft-delete dos candidatos da round
        retorna MatchView

Próximo tick do OpenRoundJob
  └─ vê pending + match exists → fluxo de abertura atual (anúncio + DMs)
```

### State machine de `rounds.status`

```
                  cria match (sync único)
PENDING ──────────────────────────────────────┐
   │                                          ▼
   │  empate sem 1×2 (sync)                  PENDING (com match)
   ▼                                          │
AWAITING_PICK ──── admin escolhe ─────────────┘
                                               │
                                               ▼ (cron tick)
                                              OPEN
```

`closed`/`finished` mantém comportamento atual.

## Schema

### Migration `0011_add_awaiting_pick_to_round_status`

```sql
-- Postgres exige fora de transaction
ALTER TYPE round_status ADD VALUE IF NOT EXISTS 'awaiting_pick';
```

Migration usa `disableTransactions = true`. `down()` é no-op (Postgres não suporta drop em valor de enum sem recriar; documentar).

### Migration `0012_create_round_match_candidates_table`

```ts
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table.uuid('round_id').notNullable().references('id').inTable('rounds').onDelete('CASCADE')
table.integer('external_id').notNullable()      // football-data fixture id
table.text('home_team').notNullable()
table.text('away_team').notNullable()
table.timestamp('kickoff_at', { useTz: true }).notNullable()
table.integer('points_sum').notNullable()
table.integer('position').notNullable()          // 1..N (ordem na enquete)
table.text('poll_message_id').nullable()
table.boolean('is_deleted').notNullable().defaultTo(false)
table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

table.unique(['round_id', 'external_id'])         // idempotência por round
table.index(['round_id'])
```

**Sem coluna `is_top1_vs_top2`** — pelo tie-break do picker, candidatos 1×2 nunca chegam à persistência. Multiplier no pick é sempre `1`.

## Mudanças em `@palpites/shared`

```ts
// status.ts
export const RoundStatus = {
  PENDING: 'pending',
  AWAITING_PICK: 'awaiting_pick',
  OPEN: 'open',
  CLOSED: 'closed',
  FINISHED: 'finished',
} as const
```

```ts
// views.ts
export interface MatchCandidateView {
  id: string
  externalId: number
  homeTeam: string
  awayTeam: string
  kickoffAt: string         // ISO 8601
  pointsSum: number
  position: number
}
```

## Picker — `featured_match_picker.ts`

Novo retorno discriminado:

```ts
export type PickResult =
  | { ok: true; kind: 'unique'; match: FixtureCandidate; pointsMultiplier: number }
  | { ok: true; kind: 'tie'; candidates: TieCandidate[] }
  | { ok: false; reason: string }

export interface TieCandidate {
  match: FixtureCandidate
  pointsSum: number
  position: number  // 1..N, ordenado por kickoffAt ASC
}
```

Algoritmo:

1. Para cada fixture, computar `pointsSum = pointsOf(home) + pointsOf(away)`.
2. `topGroup = fixtures com pointsSum === max(pointsSum)`.
3. **Tie-break 1×2**: se algum item de `topGroup` for top1 vs top2 da tabela, retorna `{ ok: true, kind: 'unique', match: aquele, pointsMultiplier: 2 }` — sem enquete.
4. Se `topGroup.length === 1`, retorna `{ ok: true, kind: 'unique', match, pointsMultiplier: 1 }`.
5. Senão, ordena `topGroup` por `kickoffAt` ASC, atribui `position: 1..N`, retorna `{ ok: true, kind: 'tie', candidates: [...] }`.

Função pura, sem DB, sem WhatsApp. Cobertura unit completa.

## `FixturesSyncService` — sync ramo `tie`

Hoje (linhas 67-101) sempre cria match. Passa a ramificar:

```ts
const round = await this.roundRepository.findBySeasonAndNumber(seasonId, currentMatchday)

if (round?.status === RoundStatus.AWAITING_PICK) {
  return { seasonId, currentMatchday, created: false, skipped: true,
           reason: 'awaiting admin pick' }
}

// ... fetch matches + standings + pick (igual hoje) ...

if (pick.kind === 'unique') {
  // fluxo atual: cria round PENDING + match em transaction
}

if (pick.kind === 'tie') {
  await db.transaction(async (trx) => {
    const r = round ?? await this.roundRepository.create(
      { seasonId, number: currentMatchday, status: RoundStatus.AWAITING_PICK }, trx
    )
    if (round && round.status === RoundStatus.PENDING) {
      await this.roundRepository.update(r, { status: RoundStatus.AWAITING_PICK }, trx)
    }
    await this.roundCandidateRepository.bulkCreate(r.id, pick.candidates, trx)
  })
  return { seasonId, currentMatchday, created: false, skipped: false,
           reason: 'awaiting admin pick', candidates: presentCandidates(...) }
}
```

`SyncReport` ganha campo `candidates?: MatchCandidateView[]` opcional pro caso `tie`.

## `OpenRoundJob` — branch awaiting_pick

Estado atual (`apps/api/app/jobs/open_round_job.ts:46`): `if (round && round.status === RoundStatus.PENDING && syncReport.match)`.

Novo branch — antes do existente:

```ts
if (round && round.status === RoundStatus.AWAITING_PICK) {
  if (!this.notifier.isReady()) {
    logger.warn(..., 'OpenRoundJob: WhatsApp offline — skipping poll send')
  } else {
    const candidates = await this.roundCandidateRepository.list(round.id)
    const alreadySent = candidates.some(c => c.pollMessageId !== null)
    if (!alreadySent && candidates.length > 0) {
      const result = await this.notifier.notifyTieCandidatesPoll({
        roundNumber: round.number,
        candidates,
      })
      if (result.messageId) {
        await this.roundCandidateRepository.markPollSent(round.id, result.messageId)
      } else {
        // fallback emoji: marca message_id sentinela pra idempotência
        await this.roundCandidateRepository.markPollSent(round.id, 'fallback-emoji')
      }
    }
  }
  runs.push({ seasonId: season.id, syncReport, roundOpened: false })
  continue
}

// ... fluxo existente intacto ...
```

DMs e anúncios de abertura **não** disparam aqui — só depois que rodada vira `open`.

## WhatsApp — port + impls + notifier

### `whatsapp_client.ts`

```ts
export interface PollSendResult { messageId: string }

export default abstract class WhatsAppClient {
  // ... existentes ...
  abstract sendPollToGroup(question: string, options: string[]): Promise<PollSendResult>
}
```

### `BaileysClient.sendPollToGroup`

```ts
const result = await this.socket.sendMessage(jid, {
  poll: { name: question, values: options, selectableCount: 1 }
})
return { messageId: result?.key?.id ?? '' }
```

Throws se `socket` não estiver `open`, igual aos outros métodos.

### `StubClient` / `DisabledClient`

- `StubClient`: loga e retorna `{ messageId: 'stub-poll-<uuid>' }`.
- `DisabledClient`: throws `'WhatsApp disabled'`.

### `WhatsAppNotifier.notifyTieCandidatesPoll`

```ts
interface TiePollPayload {
  roundNumber: number
  candidates: { id: string; homeTeam: string; awayTeam: string; position: number }[]
}

interface TiePollResult { mode: 'poll' | 'emoji'; messageId: string | null }

async notifyTieCandidatesPoll(payload: TiePollPayload): Promise<TiePollResult> {
  const tpl = renderTiePollTemplate(payload)
  try {
    const r = await this.client.sendPollToGroup(tpl.question, tpl.options)
    return { mode: 'poll', messageId: r.messageId }
  } catch (err) {
    logger.warn({ err }, 'notifier: poll falhou, fallback emoji')
    const fallback = renderTieEmojiFallbackTemplate(payload)
    await this.client.sendToGroup(fallback)
    return { mode: 'emoji', messageId: null }
  }
}
```

### Templates

**`tie_poll.ts`** — produz `{ question, options }`:
- `question`: `🗳️ Empate na escolha do jogo da Rodada N — vote no jogo da rodada!`
- `options`: `Time A x Time B` por candidato, na ordem de `position`.

**`tie_emoji_fallback.ts`** — texto único:
```
🗳️ *Empate na escolha do jogo da Rodada N!*

Vote reagindo com o número correspondente:

1️⃣ Time A x Time B
2️⃣ Time C x Time D
3️⃣ Time E x Time F

(o admin homologa a escolha mais votada)
```

Sem menção a 1×2 (esses casos nunca chegam aqui — tie-break automático).

## Admin pick — HTTP

### Endpoint `POST /rounds/:id/pick-candidate`

- Auth: `admin_auth_middleware` (Bearer `ADMIN_API_TOKEN`)
- Body validator: `{ candidateId: string (uuid) }`
- Service: `RoundCandidatePickService.pick(roundId, candidateId)`
- Resposta: `MatchView` (o match recém-criado)

### Endpoint `GET /rounds/:id/match-candidates`

- Auth: admin
- Resposta: `MatchCandidateView[]` (vazio quando round não está awaiting)
- Útil pra debug e para futura UI.

### Service `RoundCandidatePickService`

```ts
async pick(roundId: string, candidateId: string): Promise<Match> {
  const round = await this.roundRepository.findByIdOrFail(roundId)
  if (round.status !== RoundStatus.AWAITING_PICK) {
    throw new InvalidStateException('round não está awaiting_pick')
  }
  const candidate = await this.roundCandidateRepository.findByIdOrFail(candidateId)
  if (candidate.roundId !== roundId) {
    throw new NotFoundException('candidato não pertence a esta round')
  }

  return db.transaction(async (trx) => {
    const match = await this.matchRepository.create({
      roundId,
      externalId: candidate.externalId,
      homeTeam: candidate.homeTeam,
      awayTeam: candidate.awayTeam,
      kickoffAt: candidate.kickoffAt,
      status: MatchStatus.SCHEDULED,
      pointsMultiplier: 1,
    }, trx)
    await this.roundRepository.update(round, { status: RoundStatus.PENDING }, trx)
    await this.roundCandidateRepository.softDeleteAllByRound(roundId, trx)
    return match
  })
}
```

## Admin pick — WhatsApp `/escolher <n>`

### Inbound handler

`WhatsAppInboundHandler` ganha branch antes do parser de palpite — ordem:

1. `/cadastro <nome> <emoji>` (existente)
2. `/escolher <n>` (novo) — *antes* do palpite porque o token `/` torna trivial detectar
3. Parser de palpite (existente)

```ts
const matchEscolher = text.match(/^\/escolher\s+(\d+)\s*$/i)
if (matchEscolher) {
  if (!user) {
    await client.sendToUser(fromNumber, 'cadastre-se primeiro com /cadastro <nome> <emoji>')
    return
  }
  if (!user.isAdmin) {
    await client.sendToUser(fromNumber, '⛔ comando restrito a administradores')
    return
  }
  const position = parseInt(matchEscolher[1], 10)
  const round = await roundRepository.findCurrentAwaitingPickAcrossSeasons()
  if (!round) {
    await client.sendToUser(fromNumber, 'nenhuma rodada aguardando escolha')
    return
  }
  const candidate = await roundCandidateRepository.findByRoundAndPosition(round.id, position)
  if (!candidate) {
    await client.sendToUser(fromNumber, `posição ${position} inválida pra rodada atual`)
    return
  }
  await roundCandidatePickService.pick(round.id, candidate.id)
  await client.sendToUser(fromNumber,
    `✅ jogo da rodada ${round.number} definido: ${candidate.homeTeam} x ${candidate.awayTeam}`)
  await client.sendToGroup(renderAdminPickedTemplate({
    roundNumber: round.number,
    homeTeam: candidate.homeTeam,
    awayTeam: candidate.awayTeam,
  }))
  return
}
```

`findCurrentAwaitingPickAcrossSeasons()` retorna a primeira round `awaiting_pick` (em produção é só uma de cada vez na prática). Sem season-scoping pra simplificar; futuro pode aceitar `/escolher <round> <pos>`.

### Template `admin_picked.ts`

```
🎯 *Rodada N — jogo definido pelo admin:*
Time A x Time B
```

## Repositórios novos

### `RoundCandidateRepository`

```ts
class RoundCandidateRepository extends BaseRepository<RoundMatchCandidate> {
  list(roundId: string): Promise<RoundMatchCandidate[]>
  findByRoundAndPosition(roundId: string, position: number): Promise<RoundMatchCandidate | null>
  bulkCreate(roundId: string, candidates: TieCandidate[], trx?: TransactionClientContract): Promise<void>
  markPollSent(roundId: string, messageId: string): Promise<void>
  softDeleteAllByRound(roundId: string, trx?: TransactionClientContract): Promise<void>
}
```

`bulkCreate` usa `Model.createMany` ou raw insert. Soft delete por convenção do projeto.

### `RoundRepository` — método novo

```ts
findCurrentAwaitingPickAcrossSeasons(): Promise<Round | null>
```

Query: `where status='awaiting_pick' order by created_at asc limit 1`.

## Modelo `RoundMatchCandidate`

```ts
// app/models/round_match_candidate.ts
import { randomUUID } from 'node:crypto'
import { beforeCreate, beforeFetch, beforeFind } from '@adonisjs/lucid/orm'
import { RoundMatchCandidateSchema } from '#database/schema'

export default class RoundMatchCandidate extends RoundMatchCandidateSchema {
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignUuid(row: RoundMatchCandidate) {
    if (!row.id) row.id = randomUUID()
  }

  @beforeFind()
  @beforeFetch()
  static softDeleteScope(query) {
    query.where('is_deleted', false)
  }
}
```

## Presenter

`apps/api/app/presenters/match_candidate_presenter.ts` — função pura:

```ts
export function presentMatchCandidate(c: RoundMatchCandidate): MatchCandidateView {
  return {
    id: c.id,
    externalId: c.externalId,
    homeTeam: c.homeTeam,
    awayTeam: c.awayTeam,
    kickoffAt: c.kickoffAt.toISO()!,
    pointsSum: c.pointsSum,
    position: c.position,
  }
}
```

## Testes

### Unit
- `featured_match_picker.spec.ts` — adicionar:
  - tie sem 1×2 → `kind: 'tie'` com candidatos ordenados por kickoff
  - tie com 1×2 → `kind: 'unique'` com multiplier 2 (tie-break)
  - sem empate, com 1×2 → `kind: 'unique'` multiplier 2 (cobertura preservada)
- `tie_poll_template.spec.ts` — snapshot de question/options
- `tie_emoji_fallback_template.spec.ts` — snapshot do texto
- `admin_picked_template.spec.ts` — snapshot

### Functional
- `fixtures_sync_service.spec.ts` — cenário tie persiste candidatos + status awaiting_pick
- `round_candidate_pick_service.spec.ts`
  - happy path: cria match, flipa pra pending, soft-delete candidatos
  - rejeita quando round não awaiting (409)
  - rejeita quando candidato é de outra round (404)
- `pick_candidate_endpoint.spec.ts` — auth + happy + 404 + 409
- `match_candidates_endpoint.spec.ts` — listagem
- `whatsapp_inbound_handler.spec.ts` — `/escolher`:
  - admin + posição válida → cria match + reply DM + post no grupo
  - user comum → reply restrição
  - sem round awaiting → reply "nenhuma rodada"
  - posição inválida → reply
- `open_round_job.spec.ts`
  - round em awaiting_pick + WhatsApp ready + nenhum poll_message_id → manda poll
  - round em awaiting_pick + algum candidato com poll_message_id → não re-manda (idempotência)
  - round em awaiting_pick + WhatsApp offline → skip silencioso
  - admin escolhe → próximo run vê pending+match → flipa pra open normalmente
- `notifier.spec.ts` — `notifyTieCandidatesPoll`:
  - poll OK → retorna mode 'poll' + messageId
  - poll throws → fallback emoji + sendToGroup chamado

## Edge cases tratados

- **Cron rodando antes do admin escolher** → `markPollSent` na primeira tentativa garante idempotência.
- **Override manual via `PUT /rounds/:id/match`** com round em awaiting_pick → controller atualizado pra: em transaction, criar match + flipar status pra `pending` + soft-delete dos candidatos. Mantém compatibilidade com fluxo de override existente.
- **Múltiplas seasons em awaiting_pick simultâneas** → cada season é independente; `OpenRoundJob` itera por season normalmente.
- **`/escolher` quando há awaiting em múltiplas seasons** → pega a primeira (limit 1). Caso patológico em produção (10 users, 1 season ativa por vez); aceitável.
- **Football-data atualiza a rodada (`currentMatchday` avança) durante awaiting** → round antiga continua awaiting até admin agir; sync da nova rodada não cria a próxima até a antiga sair desse estado? **Decisão**: sync por season opera só na `currentMatchday` retornada pela API. Se ela avançar com round antiga ainda awaiting, a antiga fica órfã — admin pode resolver via `PUT /rounds/:id/match` (override) ou esperar finalizar manualmente. **Não criamos UI/endpoint pra "cancelar awaiting"** (YAGNI).
- **Poll fallback grava `'fallback-emoji'` como sentinela em `poll_message_id`** — feio mas garante idempotência sem coluna nova. Alternativa: coluna `poll_attempted_at` na rounds; rejeitada por overhead.

## Não-objetivos

- **Tally automático** dos votos do poll. Admin lê manual no app.
- **Reaction parsing** (emoji vote). Só fallback texto.
- **UI/dashboard**.
- **Notificação de "ainda esperando admin"** se demorar muito (ex.: lembrete T-2h). Pode ser fase 2.
- **Cancelar awaiting_pick sem match** (admin desistir). Workaround: `PUT /rounds/:id/match` com override manual.

## Plano de implementação (alto nível)

Subdividir em planos numerados sob `docs/superpowers/plans/`:

1. **9.1 — Schema + shared** (migrations, RoundStatus, MatchCandidateView, RoundMatchCandidate model)
2. **9.2 — Picker + sync ramo tie** (featured_match_picker, fixtures_sync_service, repository, presenter)
3. **9.3 — WhatsApp port + notifier + templates** (sendPollToGroup nas 3 impls, notifyTieCandidatesPoll, templates tie_poll/tie_emoji/admin_picked)
4. **9.4 — Admin pick HTTP + service** (RoundCandidatePickService, endpoints pick/list, validators, atualização do `PUT /rounds/:id/match` pra cleanup de candidatos)
5. **9.5 — Admin pick WhatsApp `/escolher` + wiring no OpenRoundJob**

Cada plano com 3-6 tasks. Detalhamento via skill `writing-plans`.
