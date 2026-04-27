# WhatsApp Inbound (Fase 5) — Design

**Data:** 2026-04-25
**Status:** Aprovado para implementação
**Escopo:** recebimento de mensagens privadas via Baileys + DMs de prompt no abertura da rodada + post no grupo a cada palpite registrado.

## Visão geral

A Fase 5 fecha o loop com o WhatsApp completo. Quando uma rodada abre, cada usuário recebe DM privada com o prompt do palpite. O usuário responde em DM com o placar; o bot identifica, valida, registra (`upsert`) e responde privado + posta no grupo. Edições antes do kickoff são aceitas: a última mensagem vence; cada edição gera novo post no grupo.

Pré-requisitos cumpridos: Fase 4 entregou socket Baileys conectado, port `WhatsAppClient`, `WhatsAppNotifier`, `score_parser` (Plano 1.4).

## Decisões registradas

### Auto-cadastro stateless via `/cadastro <nome> <emoji>`

Mensagens de números desconhecidos não são silenciosamente ignoradas (mudança em relação à spec original). Em vez disso:

- Se a mensagem começa com `/cadastro` → tenta cadastrar.
- Se vem outro texto sem cadastro prévio → resposta `"Você não está cadastrado. Manda /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽"`.

Stateless: o cadastro inteiro acontece numa única mensagem. Sem conversa multi-step. Pra 10 amigos + chip dedicado, fricção mínima e sem estado intermediário.

Rejeitada: conversa multi-step (excesso de complexidade pra volume baixo). Rejeitada: auto-cadastro com defaults (resulta em ranking feio até admin renomear).

### Edição de palpites com post-por-edição no grupo

Cada palpite (incluindo edições enquanto a janela está aberta) dispara post no grupo. Histórico de envios fica visível. DB sempre tem o último (upsert por `(user_id, match_id)`). Quando a rodada fecha, mais nada é aceito.

Rejeitada: silenciar edições no grupo (perde transparência). Rejeitada: não postar nada antes do close (bot fica mudo durante a janela).

### Sem dedupe explícito de message id

Filtros do `messages.upsert`: `type === 'notify'` (skip history sync) + `key.fromMe === false` (skip mensagens do bot) + `key.remoteJid` termina em `@s.whatsapp.net` (DM, não grupo). Texto vazio é ignorado.

Sem cache/DB de message ids. Replays raros (reconnect) só causam `upsert` idempotente do mesmo palpite.

### Ordem de operações no handler

`gate-free` — handler já roda no socket conectado, então não precisa do `isReady()` que os jobs usam. Falhas em `sendToUser`/`sendToGroup` após o `upsert` no DB são logadas mas não dão rollback. Próximas tentativas funcionam.

### DMs do `OpenRoundJob` vêm depois do flip + grupo

Razão: o flip de status + post no grupo são o "anúncio oficial". DM individual é nice-to-have. Falha de DM em algum user não desfaz a abertura da rodada nem trava DMs dos outros — log e segue.

Delay humanizado simples: 1s entre DMs sequenciais (~10s pra 10 users).

## Arquitetura

### Estrutura de diretórios

```
apps/api/app/
├── integrations/whatsapp/
│   ├── whatsapp_client.ts         # PORT estendida: + sendToUser, + onMessage
│   ├── baileys_client.ts          # subscreve messages.upsert; sendToUser
│   ├── stub_client.ts             # sendToUser loga; onMessage no-op
│   ├── disabled_client.ts         # sendToUser throws; onMessage no-op
│   └── templates/
│       ├── round_opened_dm.ts     # NOVO — DM individual no abertura
│       └── guess_registered_group.ts  # NOVO — post no grupo a cada palpite
├── services/
│   ├── whatsapp_notifier.ts       # estendido: notifyRoundOpenedToUser, notifyGuessRegistered
│   └── whatsapp_inbound_handler.ts  # NOVO — orquestrador do inbound
└── repositories/
    └── (extensions: GuessRepository.upsertByUserAndMatch, RoundRepository.findOpenInActiveSeason)

apps/api/start/
└── whatsapp.ts                    # registra handler.handle como onMessage

apps/api/tests/
├── unit/whatsapp/
│   ├── round_opened_dm_template.spec.ts
│   └── guess_registered_group_template.spec.ts
├── functional/
│   ├── whatsapp_inbound_handler.spec.ts  # cobre todos os paths do handler
│   └── open_round_job.spec.ts            # estendido pra verificar DMs
└── helpers/
    └── whatsapp_mock.ts           # FakeWhatsAppClient ganha sentDms + simulateIncoming
```

### Port `WhatsAppClient` — extensão

```ts
export interface IncomingMessage {
  fromNumber: string  // E.164, ex: "5511999998888" (sem o "@s.whatsapp.net")
  text: string
  messageId: string   // pra log/debug
}

export type IncomingMessageHandler = (msg: IncomingMessage) => Promise<void>

export default abstract class WhatsAppClient {
  abstract readonly mode: WhatsAppMode
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract isConnected(): boolean
  abstract sendToGroup(text: string): Promise<void>
  abstract sendToUser(phoneNumber: string, text: string): Promise<void>
  abstract onMessage(handler: IncomingMessageHandler): void
}
```

### `BaileysClient` — handler real

`sendToUser` chama `socket.sendMessage('${number}@s.whatsapp.net', { text })`.

`onMessage` armazena o handler. Subscrição ao `messages.upsert` é feita no setup do socket:

```ts
socket.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return
  for (const m of messages) {
    if (m.key.fromMe) continue
    if (!m.key.remoteJid?.endsWith('@s.whatsapp.net')) continue  // só DMs
    const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? ''
    if (!text.trim()) continue
    const fromNumber = m.key.remoteJid.replace(/@s\.whatsapp\.net$/, '')
    await this.handler?.({
      fromNumber, text, messageId: m.key.id ?? 'unknown'
    }).catch((err) => {
      logger.error({ err, fromNumber }, 'inbound handler threw')
    })
  }
})
```

Erro do handler é capturado (log) — não derruba o socket.

### `StubClient` / `DisabledClient` / `FakeWhatsAppClient`

- **Stub**: `sendToUser` loga; `onMessage` armazena callback mas nunca dispara.
- **Disabled**: `sendToUser` lança; `onMessage` no-op.
- **Fake (testes)**: ganha `sentDms: { number, text }[]` e `simulateIncoming(msg)` que aciona o handler registrado via `onMessage`. Permite tests funcionais sem socket real.

## `WhatsAppInboundHandler`

Service injectable, dependências:

```ts
@inject()
class WhatsAppInboundHandler {
  constructor(
    private userRepository: UserRepository,
    private seasonRepository: SeasonRepository,
    private roundRepository: RoundRepository,
    private matchRepository: MatchRepository,
    private guessRepository: GuessRepository,
    private notifier: WhatsAppNotifier,
    private client: WhatsAppClient
  ) {}

  async handle(msg: IncomingMessage): Promise<void>
}
```

### Roteamento

```
handle(msg):
  if /^\/cadastro\b/i.test(text):
    → handleRegister(msg)
  else:
    → handleGuess(msg)
```

### `handleRegister(msg)`

1. Parse: `/cadastro <nome>+ <emoji>` — último token = emoji, resto (juntado por espaços) = nome.
2. Validações:
   - Nome ou emoji vazio → `"Pra te cadastrar, manda: /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽"`
   - Nome > 80 chars → `"Nome muito longo (max 80 caracteres)."`
3. Já cadastrado (`userRepository.findByWhatsappNumber`)? → `"Você já está cadastrado como {name} {emoji}."` (não atualiza; admin troca via `PATCH /users/:id`).
4. Cria via `userRepository.create({ name, emoji, whatsappNumber, isAdmin: false })`.
5. Reply: `"✅ Cadastrado, {name} {emoji}! A partir de agora você pode mandar palpites."`

### `handleGuess(msg)`

1. **User**: `findByWhatsappNumber`. Não existe → reply `"Você não está cadastrado. Manda /cadastro <seu nome> <emoji>. Ex: /cadastro Helvécio ⚽"`.
2. **Rodada aberta**: `roundRepository.findOpenInActiveSeason()` (join `seasons.is_active=true` + `rounds.status='open'`, com `match` preloaded). Nenhuma → `"Sem rodada aberta no momento."`.
3. **Match**: já vem preloaded; defensivo se vier `null` → log + reply `"Erro interno, avise o admin."`.
4. **Janela**: `match.kickoffAt < DateTime.now()` → `"⏱️ Palpites fechados pra rodada {N}."`
5. **Parse**: `parseScore(text, { homeTeam, awayTeam })`. Falha → `"❌ Não entendi o placar. Exemplo: 2x1 {homeTeam}, ou 1x1 (empate)."`
6. **Upsert**: `guessRepository.upsertByUserAndMatch(user.id, match.id, { homeScore, awayScore })`. Reseta `points=null` (preenchido só no finalize).
7. **Reply privado**: `"✅ Palpite registrado: {homeTeam} {h} x {a} {awayTeam}."`
8. **Post no grupo**: `notifier.notifyGuessRegistered({ user, match, homeScore, awayScore })` → `"{name} {emoji} palpitou: {homeTeam} {h} x {a} {awayTeam}"`.

Falhas em 7/8 são logadas mas não revertem o DB. Próxima edição funciona.

## `WhatsAppNotifier` — métodos novos

```ts
notifyRoundOpenedToUser({ user, round, match }): Promise<void>
notifyGuessRegistered({ user, match, homeScore, awayScore }): Promise<void>
```

`notifyRoundOpenedToUser` chama `client.sendToUser(user.whatsappNumber, roundOpenedDmMessage(...))`.

`notifyGuessRegistered` chama `client.sendToGroup(guessRegisteredGroupMessage(...))`.

## Templates novos

### `round_opened_dm`

```
Oi {userName} {userEmoji}!
📢 Rodada {N} aberta — {homeTeam} x {awayTeam}
Kickoff: dd/MM HH:mm

Manda o palpite aqui no privado. Ex: 2x1 {homeTeam}
```

Detalhes finais de wording ficam para o plano de implementação (testes snapshot pinam o texto).

### `guess_registered_group`

```
{userName} {userEmoji} palpitou: {homeTeam} {h} x {a} {awayTeam}
```

## `OpenRoundJob` — laço de DMs

Hoje (Fase 4):
1. Sync football-data
2. Gate WhatsApp
3. `notifyRoundOpened` (grupo)
4. Flip status `pending → open`

Adição (Fase 5):
5. **`userRepository.list()`** — busca todos os users (não há binding per-season ainda).
6. **Loop** com delay 1s:
   ```ts
   for (const user of users) {
     try {
       await this.notifier.notifyRoundOpenedToUser({ user, round, match })
       await sleep(1000)
     } catch (err) {
       logger.warn({ userId: user.id, err }, 'OpenRoundJob: falha ao mandar DM')
     }
   }
   ```

Falhas individuais não travam outros users nem desfazem o flip de status.

## Wiring (`start/whatsapp.ts`)

Após `client.connect()`:

```ts
const handler = await app.container.make(WhatsAppInboundHandler)
client.onMessage((msg) => handler.handle(msg))
```

Preload já é `environment: ['web']`. Handler nunca recebe mensagens em ace commands ou test — coerente.

## Repositórios — métodos novos

### `UserRepository.findByWhatsappNumber(number: string)`

Provavelmente já existe (uso em validators); confirmar e adicionar se não.

### `RoundRepository.findOpenInActiveSeason()`

```ts
return Round.query()
  .whereHas('season', (s) => s.where('is_active', true))
  .where('status', RoundStatus.OPEN)
  .preload('match')
  .first()
```

### `GuessRepository.upsertByUserAndMatch(userId, matchId, { homeScore, awayScore })`

Find or create. Se existe, atualiza `homeScore`, `awayScore`, reseta `points=null`. Se não existe, cria.

## Testes

### Unit (`tests/unit/whatsapp/`)

- `round_opened_dm_template.spec.ts`
- `guess_registered_group_template.spec.ts`

Snapshot do texto produzido para inputs conhecidos.

### Functional (`tests/functional/whatsapp_inbound_handler.spec.ts`)

Padrão: swap `WhatsAppClient` pelo `FakeWhatsAppClient`. Test usa `fake.simulateIncoming({ fromNumber, text, messageId })` pra disparar o handler.

**Cadastro:**
- `/cadastro Helvécio ⚽` de número novo → user criado, reply `"✅ Cadastrado..."`
- `/cadastro` (sem args) → reply de help
- `/cadastro X ⚽` quando user já existe → reply `"Você já está cadastrado..."`, sem update no DB

**Palpite — happy path:**
- User cadastrado + round open + kickoff futuro + `2x1 Palmeiras` → upsert guess + reply privado `✅ Palpite registrado` + post no grupo `Helvécio ⚽ palpitou`
- Edição: mesmo user manda `1x1` → upsert sobrescreve, novo reply, novo post no grupo

**Palpite — caminhos de erro:**
- Number desconhecido manda palpite (sem `/cadastro`) → reply `"Você não está cadastrado..."`
- User cadastrado, sem rodada aberta → reply `"Sem rodada aberta no momento."`
- Kickoff já passou → reply `"⏱️ Palpites fechados pra rodada N."`
- Texto `"oi tudo bem"` → reply `"❌ Não entendi o placar..."`

### Functional (`tests/functional/open_round_job.spec.ts`) — adições

- Cenário existente "online flipa+envia" estendido pra verificar `fake.sentDms.length === N` (1 por user) + conteúdo dos DMs.
- Cenário novo: `sendToUser` falha pra um user (fake throws) → outros recebem DM normal, status flipa OK, log warn.

### Não testado automatizado

- Subscrição real do `messages.upsert` do Baileys (validação manual).
- Delay humanizado entre DMs (visual em logs).

## Fora de escopo (Fase 5)

- Comandos extras (`/ranking`, `/ajuda`, `/meu-palpite`). YAGNI.
- Rate limit / anti-flood. Volume baixíssimo.
- Histórico de edições de palpite. Apenas o último é guardado.
- Comandos admin via WhatsApp (banir user, abrir rodada manual). Admin usa HTTP.
- Re-registro / atualização de nome/emoji via WhatsApp. Admin usa `PATCH /users/:id`.
- Suporte a múltiplas seasons ativas concorrentes. `findOpenInActiveSeason` retorna a primeira; se houver 2+ ativas é considerado bug de admin.

## Critério de aceitação

- Suite passa.
- `WhatsAppInboundHandler` cobre todos os paths: cadastro novo, cadastro duplicado, cadastro malformado, palpite ok, palpite edit, palpite sem cadastro, palpite sem rodada, palpite kickoff passado, palpite parse-erro.
- `OpenRoundJob` ainda passa nos cenários antigos + novos da Fase 5 (DMs, falha individual).
- Validação manual com chip real: cadastrar via `/cadastro`, mandar palpite, ver post no grupo + reply privado.
