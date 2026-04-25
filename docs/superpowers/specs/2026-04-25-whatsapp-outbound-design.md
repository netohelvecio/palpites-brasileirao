# WhatsApp Outbound (Fase 4) — Design

**Data:** 2026-04-25
**Status:** Aprovado para implementação
**Escopo:** apenas envio (outbound) de mensagens no grupo. Recebimento de palpites (inbound) fica para a Fase 5.

## Visão geral

A Fase 4 substitui os `logger.info` de fim de job por mensagens reais no grupo do WhatsApp via Baileys. Três eventos disparam mensagem:

1. **Rodada aberta** — quando `OpenRoundJob` flipa `rounds.status` de `pending` para `open`.
2. **Rodada fechada** — quando `CloseRoundJob` flipa de `open` para `closed`.
3. **Jogo finalizado** — quando `SyncScoresJob` detecta `match.status=finished` e `RoundFinalizerService.finalize` está prestes a flipar para `finished`.

DMs individuais previstas na spec geral (prompt de palpite, confirmação) ficam para a Fase 5, junto com o handler de inbound — DM sem bot que escuta gera UX confusa.

## Decisões registradas

### Comportamento quando o WhatsApp está desconectado

**Gate + abort.** Antes de qualquer mudança de status no DB, o job/service consulta `WhatsAppClient.isConnected()`. Se falso, loga warning e sai sem alterar DB. Os crons (`OpenRoundJob` 30min, `CloseRoundJob` 5min, `SyncScoresJob` 10min) recobrem naturalmente quando o chip volta.

Rejeitada: **fail-soft pós-commit** (mensagem perdida = experiência ruim para 10 amigos). Rejeitada: **outbox pattern** (complexidade desnecessária para o volume).

Monitoramento da saúde do Baileys (alarmes, alerta de sessão expirada) é melhoria futura — por ora, `GET /whatsapp/status` exposto sem auth permite checagem manual.

### Modos de operação

`WHATSAPP_MODE` env var com três valores:

- `real` — `BaileysClient` conecta via socket Baileys, usa sessão persistida em `WHATSAPP_AUTH_PATH`.
- `stub` — `StubClient` loga mensagens via `logger.info` em vez de enviar. Dev day-to-day sem precisar parear chip.
- `disabled` — `DisabledClient` reporta `isConnected() = false` permanentemente; `sendToGroup` lança. Default em `.env.example` e em `.env.test`.

A escolha de impl é resolvida no container no boot (`whatsapp_provider.ts`).

### Atomicidade de mensagens

Cada evento envia **uma única mensagem** para o grupo. O `match_finished` (que a spec original lista como 3 mensagens — final + pontuação + ranking) vira um único `sendToGroup` com texto formatado em parágrafos. Eliminando estado de envio parcial.

### Ordem dentro de um item: gate → send → DB write

Para cada round/match processado:

1. Checa `notifier.isReady()`. Falso → skip silencioso, retorna.
2. Envia mensagem via `notifier.notify*()`. Se lança → log error, sem mudar DB. Cron retenta (pode duplicar mensagem se a falha foi após a entrega — aceitável para o volume).
3. Faz a transição de status no DB.

### `RoundFinalizerService.previewFinalize`

`finalize(roundId)` continua transacional como hoje (calcula pontos, persiste `scores`, flipa `rounds.status` na mesma trx). Para enviar a mensagem com os números corretos antes do flip, ganha um método irmão `previewFinalize(roundId)` que computa os mesmos `roundScores` e `seasonRanking` em memória **sem persistir**. `SyncScoresJob` chama `previewFinalize` → notifier → `finalize`.

Rejeitado: enviar dentro da transação. Mistura I/O externo lento com lock de DB; em retry do Baileys, segura conexão de DB.

## Arquitetura

### Estrutura de diretórios

```
apps/api/app/
├── integrations/whatsapp/
│   ├── whatsapp_client.ts        # interface (port)
│   ├── baileys_client.ts         # impl real
│   ├── stub_client.ts            # impl que loga
│   ├── disabled_client.ts        # impl que sempre reporta offline
│   ├── whatsapp_provider.ts      # registra impl no container conforme WHATSAPP_MODE
│   └── templates/
│       ├── round_opened.ts       # função pura
│       ├── round_closed.ts       # função pura
│       └── match_finished.ts     # função pura
├── services/
│   └── whatsapp_notifier.ts      # orquestração: gate, templates, envio
└── controllers/
    └── whatsapp_controller.ts    # GET /whatsapp/status

apps/api/start/
└── whatsapp.ts                   # preload em environment: ['web']; chama client.connect() no boot

apps/api/commands/whatsapp/
└── list_groups.ts                # ace command: imprime JIDs dos grupos pareados

apps/api/storage/                 # adicionado ao .gitignore
└── whatsapp-auth/                # auth state Baileys (multi-file)
```

`integrations/whatsapp/` é o **adapter de tecnologia** (não conhece domínio). `services/whatsapp_notifier.ts` carrega regras de domínio (qual template para qual evento) e fica junto dos outros services.

### Interface `WhatsAppClient`

```ts
export interface WhatsAppClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  sendToGroup(text: string): Promise<void>
}
```

Mínima de propósito: só envio para o grupo configurado em `WHATSAPP_GROUP_JID`. A impl conhece o JID — não é parametrizado por chamada. Fácil de mockar.

### `BaileysClient` — lifecycle

- **Boot**: lê `WHATSAPP_AUTH_PATH` via `useMultiFileAuthState`. Sem creds → Baileys emite QR → `qrcode-terminal` printa para parear via "Aparelhos vinculados".
- **Estado interno**: subscreve `connection.update`; mantém `private connectionState: 'open' | 'connecting' | 'close'`. `isConnected()` retorna `state === 'open'`.
- **Reconnect**: em `connection.update` com `close`, se `lastDisconnect.error.statusCode === DisconnectReason.loggedOut`, **não** reconecta — loga error pedindo re-pareamento manual. Outros casos: backoff 2s → 5s → 10s, cap em 30s.
- **Disconnect graceful**: `socket.end()` em `app.terminating`.
- **Sessão persistida**: `apps/api/storage/whatsapp-auth/` (ignorado pelo git; volume Docker em prod).

### `WhatsAppNotifier` — API

```ts
@inject()
export default class WhatsAppNotifier {
  constructor(private client: WhatsAppClient) {}

  isReady(): boolean

  async notifyRoundOpened(round: Round, match: Match): Promise<void>
  async notifyRoundClosed(round: Round, match: Match, guesses: Guess[]): Promise<void>
  async notifyMatchFinished(args: {
    round: Round
    match: Match
    roundScores: RoundScoreEntry[]
    seasonRanking: SeasonRankingEntry[]
  }): Promise<void>
}
```

Cada `notify*` monta texto via template puro e chama `client.sendToGroup(text)`. Sem retries internos. Erros propagam ao caller.

`isReady()` é proxy direto para `client.isConnected()` — exposto para os callers fazerem o gate.

### Templates

Funções puras em `integrations/whatsapp/templates/`. Cada uma recebe os dados já formatados (Lucid models ou plain shapes) e devolve string. Texto base segue a spec original (`docs/superpowers/specs/2026-04-20-palpites-brasileirao-design.md` seções 2/4/5):

- `round_opened` → `"📢 Rodada {N} aberta!\nJogo: {homeTeam} x {awayTeam}\nKickoff: {dd/MM HH:mm}"` (sem instrução "manda no privado" enquanto o handler inbound não existe; Fase 5 atualiza)
- `round_closed` → `"⏱️ Rodada {N} fechada. Palpites:\n{lista: nome emoji {home}x{away}}"`
- `match_finished` → `"🏁 Final: {homeTeam} {h} x {a} {awayTeam}\n\nPontuação da rodada:\n{lista}\n\n🏆 Ranking da temporada:\n{lista numerada}"`

Detalhes finais de wording ficam para o plano de implementação — testes do tipo "snapshot" amarram o texto.

## Wiring nos jobs

### `OpenRoundJob`

```ts
const syncReport = await this.fixturesSyncService.syncCurrentMatchday(season.id)
const round = await this.roundRepository.findBySeasonAndNumber(season.id, syncReport.currentMatchday)

if (round?.status === RoundStatus.PENDING && syncReport.match) {
  if (!this.notifier.isReady()) {
    logger.warn({ seasonId, roundId: round.id }, 'OpenRoundJob: WhatsApp offline, skipping flip')
    runs.push({ seasonId, syncReport, roundOpened: false })
    continue
  }
  await this.notifier.notifyRoundOpened(round, syncReport.match)
  await this.roundRepository.update(round, { status: RoundStatus.OPEN })
  roundOpened = true
}
```

Sync da football-data acontece **antes** do gate (sync é idempotente e barato; mantém DB atualizado mesmo com WhatsApp fora).

### `CloseRoundJob`

```ts
for (const round of rounds) {
  if (!this.notifier.isReady()) {
    logger.warn({ roundId: round.id }, 'CloseRoundJob: WhatsApp offline, skipping')
    continue
  }
  const guesses = await this.guessRepository.listByRound(round.id) // preload user
  await this.notifier.notifyRoundClosed(round, round.match, guesses)
  await this.roundRepository.update(round, { status: RoundStatus.CLOSED })
  closedRoundIds.push(round.id)
}
```

`GuessRepository.listByRound` precisa ser adicionado se ainda não existe, com preload de `user` (nome + emoji para o template).

### `SyncScoresJob` + `RoundFinalizerService`

```ts
const fresh = await this.matchRepository.findByIdOrFail(match.id)
if (fresh.status === MatchStatus.FINISHED && match.round.status === RoundStatus.CLOSED) {
  if (!this.notifier.isReady()) {
    logger.warn({ matchId, roundId }, 'SyncScoresJob: WhatsApp offline, skipping finalize')
    runs.push({ matchId, roundId, refreshed: report.updated, finalized: false })
    continue
  }

  const preview = await this.roundFinalizerService.previewFinalize(match.roundId)
  await this.notifier.notifyMatchFinished({
    round: match.round,
    match: fresh,
    roundScores: preview.roundScores,
    seasonRanking: preview.seasonRanking,
  })
  await this.roundFinalizerService.finalize(match.roundId)
  finalized = true
}
```

`RefreshMatchService.refresh` (atualizar placar via football-data) continua **antes** do gate — independe do WhatsApp.

### `RoundFinalizerService` — novo método

```ts
async previewFinalize(roundId: string): Promise<{
  roundScores: RoundScoreEntry[]
  seasonRanking: SeasonRankingEntry[]
}>
```

Computa em memória os mesmos números que `finalize(roundId)` persistiria (delta de pontos por palpite + ranking final = ranking atual + delta). Sem escrita.

Razão: enviar mensagem com números **antes** de persistir; se transação falhar, próxima execução do cron re-roda `previewFinalize` (idempotente) → re-envia → retenta `finalize`. Duplicata aceita no caso raro.

## Endpoint público

`GET /whatsapp/status` (sem auth):

```json
{ "mode": "real" | "stub" | "disabled", "connected": true | false }
```

Único jeito do admin saber se a sessão expirou sem entrar no servidor. Não expõe nada sensível.

## Ace command — descoberta de JID

```bash
node ace whatsapp:list-groups
```

Comportamento:
- `WHATSAPP_MODE !== 'real'` → imprime aviso e sai sem fazer nada.
- Não conectado: aguarda até 30s pela conexão; se falhar, sai com erro.
- Conectado: `socket.groupFetchAllParticipating()`, imprime `<JID>\t<nome>`.

Esse é o caminho do admin para preencher `WHATSAPP_GROUP_JID` na primeira configuração. Comando em `commands/whatsapp/list_groups.ts` com `static options = { startApp: true }`.

## Env vars novas

Validadas em `start/env.ts`:

| Var | Tipo | Default | Obrigatória |
|---|---|---|---|
| `WHATSAPP_MODE` | enum `real\|stub\|disabled` | `disabled` | sempre |
| `WHATSAPP_GROUP_JID` | string `*@g.us` | — | só se `MODE=real` |
| `WHATSAPP_AUTH_PATH` | string | `./storage/whatsapp-auth` | sempre |

`.env.example` ganha as 3 com defaults seguros (`disabled`). `.env.test` força `WHATSAPP_MODE=disabled`.

`apps/api/storage/` adicionado ao `.gitignore`.

## Dependências novas

`apps/api/package.json`:

- `@whiskeysockets/baileys`
- `qrcode-terminal`

## Testes

Padrão: swap de `WhatsAppClient` no container (mesmo padrão de `FootballDataClient`).

```
tests/helpers/whatsapp_mock.ts
  └── FakeWhatsAppClient {
        connected: boolean
        sentMessages: string[]
        setConnected(b: boolean): void
        // implementa WhatsAppClient
      }
```

### Unit (`tests/unit/whatsapp/`)

- `round_opened_template.spec.ts`
- `round_closed_template.spec.ts`
- `match_finished_template.spec.ts`

Snapshots do texto produzido para inputs conhecidos. Sem app boot.

### Functional

- **`OpenRoundJob`**:
  - online → status `pending → open` + mensagem em `sentMessages`.
  - offline (`fake.setConnected(false)`) → status fica `pending`, sem mensagem.
  - send falha (fake `sendToGroup` lança) → status fica `pending`.
- **`CloseRoundJob`**: mesmas 3 variantes.
- **`SyncScoresJob` + `RoundFinalizerService`**:
  - match finalizado + online → mensagem enviada, round `closed → finished`, `scores` atualizado.
  - match finalizado + offline → round fica `closed`, `scores` intocado, sem mensagem.
  - `previewFinalize(roundId)` retorna mesmos números que `finalize(roundId)` persistiria (consistência testada).
- **`GET /whatsapp/status`** — retorna `mode` e `connected` corretos para cada modo.

Setup default em todos os functional que tocam jobs: `FakeWhatsAppClient` com `connected = true`. Testes que querem outro estado chamam `setConnected(false)` ou registram `sendToGroup` que lança.

### Não testado automatizado

- `BaileysClient` real (depende de socket externo). Verificação manual via `node ace whatsapp:list-groups`.
- `qrcode-terminal` (saída visual).

## Dev workflow

1. `pnpm dev` com `WHATSAPP_MODE=stub` → todas as mensagens vão para o logger; fluxo end-to-end sem chip.
2. Testar real local: trocar para `WHATSAPP_MODE=real` + parear via QR no terminal + `node ace whatsapp:list-groups` → preencher `WHATSAPP_GROUP_JID`.
3. Prod: `WHATSAPP_MODE=real` + sessão pareada uma vez + volume Docker em `./storage/whatsapp-auth/`.

## Fora de escopo (Fase 4)

- DMs (prompt de palpite, confirmação, ranking individual). → Fase 5.
- Handler de inbound (parser de placar, registro de palpite via WhatsApp). → Fase 5.
- Monitoramento ativo da conexão Baileys (alerta de sessão expirada, dashboards). → futuro.
- Outbox / queue / retry com backoff persistido. → não previsto (YAGNI para 10 usuários).
- Delays humanizados entre mensagens. → não necessário com volume atual (1 mensagem por evento, 3 eventos por rodada).
