# Rodada Dobrada (1º × 2º) — Design

**Data:** 2026-05-02
**Status:** Aprovado, pronto pra implementação
**Branch sugerido:** `feat/double-points-round`

## Contexto

Hoje toda rodada vale a mesma coisa: 3 pts (placar exato), 1 pt (vencedor/empate), 0 pt (errou). O jogo da rodada é escolhido pelo `FeaturedMatchPicker` como o confronto com **maior soma de pontos** dos dois times na tabela do Brasileirão.

Esta feature adiciona um modificador: quando o jogo da rodada coincide com o **confronto direto entre o 1º e o 2º colocado da tabela**, a pontuação daquela rodada é **multiplicada por 2** (placar exato vale 6, vencedor/empate vale 2). É uma forma de dar mais peso aos clássicos do topo, sem mudar a regra de pick.

## Goals

- Detectar automaticamente quando o jogo selecionado é 1º × 2º na tabela atual e marcar a rodada como "dobrada" no momento do pick
- Multiplicar a pontuação dos palpites dessa rodada por 2 ao finalizar (apenas a pontuação da rodada — o critério de "placar exato" continua sendo o palpite acertado, independente do multiplicador)
- Anunciar a condição "rodada dobrada" no grupo do WhatsApp em três momentos: abertura da rodada (`OpenRoundJob` → `round_opened` + `round_opened_dm`), lembrete T-30min (`MatchReminderJob` → `match_reminder`) e resultado final pós-jogo (`SyncScoresJob` → `match_finished`)
- Estender de forma flexível: a coluna persistida é um inteiro (`points_multiplier`), não um boolean, pra permitir variações futuras (×3, etc.) sem migration nova

## Non-goals

- Escolher o jogo da rodada com base em ser 1º × 2º (o picker continua usando soma de pontos; o multiplicador só **detecta** se calhou de ser 1×2)
- Multiplicadores configuráveis por admin via API (são derivados automaticamente da posição na tabela)
- Aplicar multiplicador em rodadas já finalizadas no banco (migration faz só backfill compatível, sem retroação)
- Threshold ou janela de "início de campeonato" — confiamos na ordem da resposta da API football-data, que já aplica critérios de desempate (saldo de gols, gols pró, etc.)

## Constraints / decisões herdadas

- **Stack atual** (pré-existente, não muda): Adonis 7 + Lucid + Postgres + node-cron + football-data.org
- **API football-data já retorna `total.table` ordenado** com critérios de desempate aplicados — `flattenStandings` em `app/integrations/football_data/mappers.ts` preserva essa ordem. Posições 1 e 2 = índices 0 e 1 do array
- **`matches.round_id UNIQUE`** — uma rodada tem um jogo só; o multiplier mora no `match` (single source of truth por rodada)
- **Admin override** existe via `PUT /rounds/:id/match` — qualquer caminho que cria ou substitui o featured match precisa rodar a mesma lógica de detecção
- **Backfill seguro:** nenhum match em produção tem multiplier > 1 ainda, então `is_exact = (points = 3)` no UPDATE inicial é correto

## Decisões de design (resumo das escolhas durante brainstorming)

1. **Quando detectar 1×2:** no momento do pick, congela em coluna do `match`. Determinístico, conhecido na abertura da rodada, simples de exibir nas mensagens. (Alternativas: detectar no fechamento ou no kickoff — descartadas por adicionar complexidade sem ganho de UX.)
2. **Critério de "1º × 2º":** confiar nos índices 0 e 1 do `total.table` da resposta da API. Sem threshold de pontos mínimos nem janela de rodadas iniciais. A API já aplica critérios de desempate consistentes.
3. **Anúncio no WhatsApp:** três momentos — abertura (`OpenRoundJob`), T-30min (`MatchReminderJob`), resultado pós-jogo (`SyncScoresJob`/`match_finished`). Reforça pra galera ajustar palpite e tem disclaimer no resultado pra explicar a pontuação dobrada.
4. **Persistência:** `SMALLINT points_multiplier` em `matches`, default 1. Mais flexível que boolean, mesmo custo de implementação.
5. **Onde aplicar multiplicação:** dentro de `calculatePoints` (scoring service permanece a fonte única da regra de pontuação). Função passa a receber `multiplier` e retornar `{ points, isExact }` — caller (finalizer) escreve ambos no banco.

## Architecture

### Componentes afetados

```
apps/api/
  database/migrations/
    0009_add_points_multiplier_and_is_exact.ts        ← migration nova

  app/
    services/
      featured_match_picker.ts                        ← retorna pointsMultiplier
      guess_scoring_service.ts                        ← novo signature: (guess, final, multiplier=1) → { points, isExact }
      fixtures_sync_service.ts                        ← persiste pointsMultiplier no insert do match
      round_finalizer_service.ts                      ← usa novo retorno; persiste points + isExact

    controllers/
      <round/match override controller>               ← reavalia multiplier no PUT /rounds/:id/match

    presenters/
      match_presenter.ts                              ← expõe pointsMultiplier

    repositories/
      guess_repository.ts                             ← passa a aceitar isExact em update / continua agregando por isExact

    services/
      whatsapp_notifier.ts                            ← métodos notifyRoundOpened/MatchReminder/MatchFinished/RoundOpenedToUser repassam pointsMultiplier no input

    integrations/whatsapp/templates/
      round_opened.ts                                 ← Input ganha pointsMultiplier?: number; header se > 1
      round_opened_dm.ts                              ← idem
      match_reminder.ts                               ← idem
      match_finished.ts                               ← Input ganha pointsMultiplier?: number; disclaimer no resultado

    jobs/
      open_round_job.ts                               ← lê pointsMultiplier do match e passa pros templates round_opened / round_opened_dm
      match_reminder_job.ts                           ← idem, passa pro match_reminder
      sync_scores_job.ts                              ← idem, passa pro match_finished (notifier.notifyMatchFinished)
```

### Schema (migration 0009)

```sql
ALTER TABLE matches
  ADD COLUMN points_multiplier SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE guesses
  ADD COLUMN is_exact BOOLEAN NULL;

-- Backfill: todos os palpites já pontuados (rodadas finalizadas) tinham multiplier=1,
-- então isExact é exatamente equivalente a points=3.
UPDATE guesses
   SET is_exact = (points = 3)
 WHERE points IS NOT NULL;
```

`points_multiplier` em `matches` (não em `rounds`) porque a regra é derivada do jogo escolhido — se o admin trocar o featured match, o novo cálculo grava no `match` novo. Em `rounds` exigiria sincronização.

### Mudanças no `featured_match_picker`

Tipo de retorno passa de `{ ok: true; match }` para `{ ok: true; match; pointsMultiplier }`:

```ts
export type PickResult =
  | { ok: true; match: FixtureCandidate; pointsMultiplier: number }
  | { ok: false; reason: string }
```

Lógica adicional após escolher `best`:

```ts
const top1 = standings[0]?.teamId
const top2 = standings[1]?.teamId
const isOneVsTwo =
  top1 !== undefined &&
  top2 !== undefined &&
  ((best.match.homeTeamId === top1 && best.match.awayTeamId === top2) ||
   (best.match.homeTeamId === top2 && best.match.awayTeamId === top1))
const pointsMultiplier = isOneVsTwo ? 2 : 1
```

Edge case: se `standings.length < 2` (improvável em produção, mas possível em testes/seed) → multiplier = 1, comportamento default seguro.

### Mudanças em `guess_scoring_service`

Função pura, signature evolui:

```ts
export function calculatePoints(
  guess: GuessScore,
  final: FinalScore,
  multiplier: number = 1
): { points: number; isExact: boolean } {
  const isExact =
    guess.guessHome === final.finalHome && guess.guessAway === final.finalAway
  if (isExact) return { points: 3 * multiplier, isExact: true }
  if (outcome(guess.guessHome, guess.guessAway) === outcome(final.finalHome, final.finalAway)) {
    return { points: 1 * multiplier, isExact: false }
  }
  return { points: 0, isExact: false }
}
```

Default `multiplier = 1` mantém compatibilidade pra qualquer call site futuro fora do finalizer.

### Mudanças no `round_finalizer_service`

Em `finalize`:

```ts
const { points, isExact } = calculatePoints(
  { guessHome: guess.homeScore, guessAway: guess.awayScore },
  final,
  match.pointsMultiplier
)
await this.guessRepository.update(guess, { points, isExact }, trx)
```

Agregação de `exactScoresCount` muda de `g.points === 3` pra `g.isExact === true`:

```ts
const userGuesses = await this.guessRepository.listBySeasonAndUser(seasonId, userId, trx)
const totalPoints = userGuesses.reduce((acc, g) => acc + (g.points ?? 0), 0)
const exactScoresCount = userGuesses.filter((g) => g.isExact === true).length
```

`previewFinalize` usa o mesmo padrão — `RoundScoreEntry.points` carrega o valor já dobrado, e o envelope retornado também inclui `pointsMultiplier` pra consumidores (template / endpoint admin).

### Mudanças no admin override

`PUT /rounds/:id/match` (`MatchesController.upsert`) é um override **manual**: o admin envia `externalId`, `homeTeam`, `awayTeam`, `kickoffAt` (nomes, não teamIds), então `pickFeaturedMatch` não dá pra ser reusado direto.

Caminho prático: o `upsertMatchValidator` ganha `pointsMultiplier?: number` (opcional, default 1, validado entre 1 e 10). Admin decide explicitamente. Tanto no insert quanto no update, o `MatchesController.upsert` persiste o valor recebido (ou 1). Em casos onde admin quer marcar uma rodada manual como dobrada, basta `{ ..., pointsMultiplier: 2 }` no payload.

Não tentamos auto-detectar 1×2 pelo nome porque (a) nomes podem variar entre fontes e (b) admin override é exceção rara — deixar manual é suficiente e honesto.

### Templates de WhatsApp

**`round_opened` / `round_opened_dm` / `match_reminder`** — `Input` ganha campo opcional `pointsMultiplier?: number`. Quando `> 1`, render um header destacado:

```
🔥 *RODADA VALENDO EM DOBRO!* (1º × 2º na tabela)
```

Posição: primeira linha do corpo da mensagem, antes do bloco de teams/kickoff. Quando `=== 1` ou ausente, omite.

**`match_finished`** — `Input` ganha o mesmo campo. Quando `> 1`, render uma linha de disclaimer logo após o placar final:

```
ℹ️ Foi rodada dobrada — pontuação multiplicada por 2.
```

Os scores per-user no template já chegam com o valor dobrado (`RoundScoreEntry.points`), então o disclaimer é só pra explicar.

`round_closed.ts` (snapshot dos palpites no fechamento, antes do jogo) não recebe disclaimer — não exibe pontuação, só lista de palpites. Manter intacto.

### Presenter / API surface

`MatchView` em `packages/shared/src/views.ts` ganha `pointsMultiplier: number` (não opcional — sempre presente, default 1 quando não dobrada). Como o `dist/` é build-on-install, depois da edição rodar `pnpm --filter @palpites/shared build` (ou ter `build:watch` rodando) pra propagar pro `apps/api`.

`presentMatch` em `apps/api/app/presenters/match_presenter.ts` adiciona `pointsMultiplier: match.pointsMultiplier` no shape de saída. Endpoints afetados (sem mudança de contrato, só campo a mais):

- `GET /seasons/:id/rounds`
- `GET /rounds/:id`
- `POST /rounds/:id/finalize/preview`
- Qualquer outro que retorne match via `presentMatch`

### Data flow (diferencial do que muda)

```
PICK (sync ou admin override)
  ↓
FootballDataClient.fetchStandings → flattenStandings (ordenado pela API)
  ↓
pickFeaturedMatch(candidates, standings) → { match, pointsMultiplier }
  ↓
matches.insert({ ..., points_multiplier })
  ↓
OpenRoundJob → round_opened template com header se multiplier > 1


FINALIZE (chamado pelo SyncScoresJob após match.status virar FINISHED)
  ↓
RoundFinalizerService.finalize(roundId)
  ↓
loop por guess:
  calculatePoints(guess, final, match.pointsMultiplier) → { points, isExact }
  guessRepository.update(guess, { points, isExact }, trx)
  ↓
agregação por user:
  totalPoints = sum(g.points)        ← já refletindo doubling
  exactScoresCount = count(g.isExact)
  scoreRepository.upsert(...)
  ↓
SyncScoresJob → notifyMatchFinished → match_finished template com disclaimer se multiplier > 1
```

## Idempotência e edge cases

- **Featured match nunca acontecer** (rodada cancelada): `points_multiplier` fica gravado mas nunca é aplicado (finalize precisa de match `FINISHED`). Sem efeito colateral.
- **Tabela com menos de 2 times** (testes/cenário inválido): picker retorna `multiplier = 1` por fallback. Sem crash.
- **Empate em pontos no topo** (1º e 2º com mesmos pontos, ou 2º e 3º empatados): a API já aplicou critérios de desempate (saldo, gols pró). Confiamos na ordem retornada — decisão consciente registrada acima.
- **Admin reverte override** (volta pro pick original): o controller reroda a lógica e atualiza `points_multiplier` no novo match. Cada `match` carrega seu próprio multiplier — sem estado escondido.
- **Re-finalize** (já existe no `RoundFinalizerService`?): se for chamado mais de uma vez, palpites são reescritos com os mesmos `points`/`isExact` (idempotente, since match.pointsMultiplier é estável).

## Testing

### Unit

- `featured_match_picker.spec.ts`:
  - Pick coincide com (standings[0], standings[1]) em qualquer ordem → `pointsMultiplier = 2`
  - Pick é 1×3, 2×3, ou qualquer outro → `pointsMultiplier = 1`
  - Standings com < 2 entradas → fallback `pointsMultiplier = 1`
  - Casos pré-existentes (lista vazia, escolha por max-soma) continuam passando
- `guess_scoring_service.spec.ts`:
  - Matriz placar-exato / acerto-vencedor / erro × multiplier=1 e =2: pontos batem (3/1/0 e 6/2/0)
  - `isExact` é `true` somente quando `guessHome === finalHome && guessAway === finalAway`, independente do multiplier
  - Multiplier omitido (default 1) → comportamento legado

### Integration / functional

- `round_finalizer_service.spec.ts` (ou equivalente functional): cenário com rodada dobrada — palpites exatos viram 6 pts, vencedores 2 pts; `is_exact` setado corretamente; `scores.totalPoints` reflete soma dobrada; `scores.exactScoresCount` conta corretamente
- Functional cobrindo `GET /rounds/:id` e `POST /rounds/:id/finalize/preview` retornando `pointsMultiplier`
- Smoke do template `round_opened` com `pointsMultiplier=2` renderizando o header

### Manual

- Disparar `node ace jobs:run-open-round` em dev com seed onde 1º × 2º está marcado e verificar a mensagem rendered no console (modo `WHATSAPP_MODE=stub`)

## Open questions / future work

- **Multiplicadores customizados** (×3 pra última rodada, clássico nacional, etc.): a coluna `points_multiplier` já comporta. Faltaria UI/endpoint admin pra setar manualmente. Fora do escopo agora.
- **Anúncio no `MatchReminderJob`** com info da posição atualizada (caso a tabela tenha mudado entre o pick e o T-30min): hoje o multiplier é **congelado no pick**, então é fiel ao momento da abertura. Se um dia quisermos "ao vivo", precisaria refetch standings no reminder. Fora do escopo.
- **Histórico de multiplicadores no ranking**: o ranking de temporada não distingue pontos "normais" de "dobrados" — soma tudo. Se um dia quisermos exibir "X exatos em rodadas dobradas", precisaria de coluna adicional. Não pedido.

## Migration plan

Single migration (`0009_add_points_multiplier_and_is_exact.ts`):

1. `ALTER TABLE matches ADD COLUMN points_multiplier SMALLINT NOT NULL DEFAULT 1`
2. `ALTER TABLE guesses ADD COLUMN is_exact BOOLEAN NULL`
3. Backfill: `UPDATE guesses SET is_exact = (points = 3) WHERE points IS NOT NULL`

Deploy: roda automaticamente via `deploy.yml` no push pra `main`. Sem downtime — colunas com default e backfill compatível.

Rollback: `DROP COLUMN` simétrico se precisar reverter (improvável depois de deploy).
