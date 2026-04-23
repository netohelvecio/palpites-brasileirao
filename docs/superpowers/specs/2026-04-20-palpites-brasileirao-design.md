# Palpites do Brasileirão — Design

**Data:** 2026-04-20
**Status:** Aprovado para implementação

## Visão geral

API que automatiza um bolão anual do Brasileirão entre ~10 amigos, hoje operado manualmente em grupo de WhatsApp. A cada rodada do campeonato, o sistema escolhe automaticamente o confronto com maior soma de pontos (somando os pontos atuais dos dois times na tabela), abre palpites via WhatsApp, recebe as respostas, calcula pontuação após o jogo e divulga ranking.

**Regras de pontuação:**
- Placar exato: **3 pts**
- Acertar vencedor ou empate: **1 pt**
- Qualquer outra situação: **0 pts**

## Stack

- **Linguagem:** Node.js + TypeScript
- **Framework:** Adonis 6
- **Banco:** PostgreSQL (tipos `uuid` via `gen_random_uuid()`)
- **ORM:** Lucid (nativo do Adonis)
- **Scheduler:** `node-cron` (sem Redis/BullMQ por enquanto — YAGNI pra 10 usuários)
- **Monorepo:** pnpm workspaces + Turborepo
- **WhatsApp:** Baileys (não oficial) com chip secundário
- **Fonte de dados de futebol:** API-Football (api-football.com), Brasileirão Série A (`league=71`)

### Decisões registradas

- **Adonis vs NestJS:** Adonis escolhido por ser batteries-included (ORM, auth, validação, migrations nativos), menos boilerplate e entrega mais rápida pro escopo do projeto.
- **node-cron vs BullMQ:** node-cron suficiente pra 10 usuários. Migrar pra BullMQ se escalar.
- **Baileys vs WhatsApp Cloud API:** Baileys com chip secundário — menor fricção, custo marginal (chip ~R$15). Risco de banimento assumido; mitigado usando número dedicado e delays humanizados.
- **API-Football vs alternativas:** melhor cobertura do Brasileirão, free tier (100 req/dia) suficiente.

## Estrutura do monorepo

```
palpites-brasileirao/
├── apps/
│   └── api/              # Adonis 6
├── packages/
│   └── shared/           # tipos/DTOs compartilhados (para futuro frontend)
├── docs/
│   └── superpowers/
│       └── specs/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

Futuro: `apps/web/` (Next.js ou similar) será adicionado em iteração posterior.

## Arquitetura de alto nível

Dentro de `apps/api`, três módulos lógicos rodando no mesmo processo, compartilhando a camada de domínio:

1. **HTTP API (REST)** — endpoints admin autenticados por token.
2. **WhatsApp Gateway (Baileys)** — envia e recebe mensagens.
3. **Scheduler (node-cron)** — jobs recorrentes de sincronização e notificação.

Integrações externas isoladas em `app/integrations/` com interfaces claras pra facilitar teste e futura substituição.

## Modelo de dados

Todas as tabelas têm:
- `id` UUID (pk, default `gen_random_uuid()`)
- `is_deleted` boolean default `false` (soft delete — queries padrão filtram)
- `created_at`, `updated_at` timestamps

### Tabelas

**`users`**
- `name` string
- `whatsapp_number` string UNIQUE (E.164, ex: `5511999998888`)
- `emoji` string (identificador visual, ex: `⚽`)
- `is_admin` boolean default `false`

**`seasons`**
- `year` integer
- `name` string (ex: "Brasileirão 2026")
- `external_league_id` integer (71 na API-Football)
- `is_active` boolean
- `starts_at`, `ends_at` timestamps

**`rounds`**
- `season_id` uuid FK
- `number` integer (1..38)
- `status` enum: `pending | open | closed | finished`
- UNIQUE(`season_id`, `number`)

**`matches`** (jogo da rodada — **um por `round`**)
- `round_id` uuid FK UNIQUE
- `external_id` integer (ID na API-Football)
- `home_team`, `away_team` string
- `kickoff_at` timestamp
- `home_score`, `away_score` integer nullable
- `status` enum: `scheduled | live | finished`

**`guesses`**
- `user_id` uuid FK
- `match_id` uuid FK
- `home_score`, `away_score` integer
- `points` integer nullable (preenchido pós-jogo)
- UNIQUE(`user_id`, `match_id`)

**`scores`** (denormalização de ranking)
- `user_id` uuid FK
- `season_id` uuid FK
- `total_points` integer
- `exact_scores_count` integer
- UNIQUE(`user_id`, `season_id`)

### Relações

```
Season 1——* Round 1——1 Match *——1 Guess *——1 User
                                  ↘
                                Score (user+season)
```

## Endpoints HTTP

Base: `/api/v1`. Autenticação via header `Authorization: Bearer <ADMIN_API_TOKEN>` em todos os endpoints exceto `/health` e `/whatsapp/status`.

### Users
- `POST /users` — cria usuário
- `GET /users` — lista
- `PATCH /users/:id` — edita

### Seasons
- `POST /seasons` — cria temporada
- `GET /seasons` — lista
- `PATCH /seasons/:id` — edita (ex: marcar como ativa)
- `POST /seasons/:id/sync` — dispara sync manual da API-Football

### Rounds
- `GET /seasons/:seasonId/rounds` — lista rodadas
- `GET /rounds/:id` — detalhe (inclui jogo e palpites)
- `PATCH /rounds/:id/status` — força status

### Matches (jogo da rodada)
- `GET /rounds/:roundId/match`
- `PUT /rounds/:roundId/match` — admin troca o jogo da rodada
- `POST /rounds/:roundId/match/refresh-score` — força buscar placar

### Guesses
- `POST /guesses` — registra palpite manual (admin em nome de usuário)
- `GET /rounds/:roundId/guesses` — lista palpites da rodada
- `PATCH /guesses/:id`
- `DELETE /guesses/:id` — soft delete

### Ranking
- `GET /seasons/:seasonId/ranking` — ordenado por pontos desc, desempate por `exact_scores_count` desc
- `GET /rounds/:roundId/ranking` — pontuação da rodada

### Health
- `GET /health`
- `GET /whatsapp/status`

## Fluxos principais

### 1. Início de temporada (anual, manual)
1. Admin: `POST /seasons` com `year`, `external_league_id=71`.
2. Admin: `POST /seasons/:id/sync` → cria 38 `rounds` com status `pending`.
3. Admin: `POST /users` pra cada participante.

### 2. Abertura de rodada (automático, 4x/dia — idempotente)
Cron às 8h, 12h, 16h, 20h:
1. Busca rodadas com kickoff nos próximos 3 dias e sem `match` associado.
2. Para cada rodada sem `match`:
   - Busca jogos da rodada na API-Football.
   - Busca tabela atual (`/standings`).
   - Escolhe confronto com **maior soma de pontos** dos dois times.
   - Cria linha em `matches`.
   - Muda `rounds.status` para `open`.
   - **Mensagem no grupo:** "📢 Rodada X aberta! Jogo: Time A vs Time B, kickoff DD/MM HH:mm. Respondam no privado com o palpite."
   - **Mensagem no privado de cada usuário:** "Oi {nome} {emoji}! Palpite da Rodada X — Time A vs Time B. Manda o placar (ex: `2x1 Time A`)."
3. Se já tem `match`, skip silencioso. Job é idempotente — múltiplas execuções não causam efeito colateral.

### 3. Recebimento de palpite (passivo, via Baileys)
1. Identifica usuário por `whatsapp_number`. Não cadastrado → ignora.
2. Busca rodada com status `open` pra esse usuário. Se nenhuma → responde "sem palpite aberto no momento".
3. **Parser de placar:** aceita formatos como `2x1 Palmeiras`, `2X1 Flamengo`, `Flamengo 2x1`, `1x1` (empate). Fuzzy match do nome do time contra os dois do jogo.
4. Se kickoff já passou → responde "palpites fechados".
5. Parse inválido → responde "não entendi o placar. Exemplo: `2x1 Flamengo` ou `1x1`".
6. Upsert em `guesses`.
7. Responde no privado: "✅ Palpite registrado: Time A {X} x {Y} Time B".
8. **Posta no grupo imediatamente:** "{nome} {emoji} palpitou: Time A {X} x {Y} Time B".

### 4. Fechamento de palpites (automático, a cada 5 min)
1. Para cada `round` com `status=open` e `match.kickoff_at` passado:
   - Muda `status` pra `closed`.
   - Posta no grupo: resumo com todos os palpites da rodada.

### 5. Pós-jogo (automático, a cada 10 min)
1. Para cada `match` com round `status=closed` e `match.status != finished`:
   - Busca placar na API-Football.
   - Se `finished`: atualiza `home_score`, `away_score`, `match.status=finished`.
   - Calcula `points` de cada palpite (3/1/0).
   - Recalcula linha em `scores` do usuário.
   - Muda `rounds.status` pra `finished`.
   - Posta no grupo:
     - "🏁 Final: Time A X x Y Time B"
     - "Pontuação da rodada: {nome} {emoji} {pts} ..."
     - "🏆 Ranking da temporada: 1. {nome} {emoji} {pts}pts ..."

### 6. Parser de placar (função pura, testável)
Entrada: string. Saída: `{home_score, away_score}` ou erro.

Casos:
- `"2x1 Palmeiras"` → Palmeiras 2 x outro 1
- `"Flamengo 2x1"` → Flamengo 2 x outro 1
- `"1x1"` → empate (sem time, 1x1)
- `"2X0 flamengo"` → case insensitive
- Nome do time: normalizado (lowercase, sem acentos), fuzzy match contra `home_team`/`away_team`.
- Inválido: retorna erro com mensagem pra enviar ao usuário.

## Estrutura de código (apps/api)

```
apps/api/
├── app/
│   ├── controllers/
│   │   ├── users_controller.ts
│   │   ├── seasons_controller.ts
│   │   ├── rounds_controller.ts
│   │   ├── matches_controller.ts
│   │   ├── guesses_controller.ts
│   │   └── ranking_controller.ts
│   ├── models/
│   │   ├── user.ts
│   │   ├── season.ts
│   │   ├── round.ts
│   │   ├── match.ts
│   │   ├── guess.ts
│   │   └── score.ts
│   ├── services/
│   │   ├── guess_scoring_service.ts
│   │   ├── featured_match_picker.ts
│   │   ├── score_parser.ts
│   │   └── ranking_service.ts
│   ├── integrations/
│   │   ├── api_football/
│   │   │   ├── client.ts
│   │   │   ├── fixtures_sync.ts
│   │   │   └── standings_fetcher.ts
│   │   └── whatsapp/
│   │       ├── baileys_client.ts
│   │       ├── message_sender.ts
│   │       └── message_handler.ts
│   ├── jobs/
│   │   ├── open_round_job.ts
│   │   ├── close_round_job.ts
│   │   └── sync_scores_job.ts
│   ├── validators/
│   ├── exceptions/
│   └── middleware/
│       └── admin_auth_middleware.ts
├── config/
├── database/
│   ├── migrations/
│   └── seeders/
├── start/
│   ├── routes.ts
│   ├── kernel.ts
│   └── scheduler.ts
├── tests/
│   ├── unit/
│   └── functional/
└── .env.example
```

**Princípios:**
- Controllers finos: validam input, delegam ao service, devolvem response.
- Services concentram regras de domínio; não conhecem HTTP.
- Integrações isoladas atrás de interface — testáveis via mock.
- Jobs são orquestradores que chamam services.

## Infra e operação

### Dev local
- Docker Compose: Postgres 16.
- `.env` variáveis:
  - `DATABASE_URL`
  - `API_FOOTBALL_KEY`, `API_FOOTBALL_BASE_URL`
  - `WHATSAPP_GROUP_JID`
  - `ADMIN_API_TOKEN`
  - `APP_KEY` (Adonis)
- Sessão Baileys persistida em `./storage/whatsapp-auth/` (fora do git, em volume no deploy).

### Logs
- Logger Adonis (pino) em JSON.
- Eventos críticos: falha API-Football, desconexão Baileys, erro de parse, falha no scoring.

### Tratamento de falhas
- Jobs idempotentes (rerodam sem efeito colateral).
- API-Football offline → log, retry na próxima execução.
- Baileys desconectado → reconnect automático; status exposto em `GET /whatsapp/status`.
- Parse inválido de palpite → responde ao usuário, não crasha job.

### Deploy (futuro)
- VPS (Hetzner/DigitalOcean, ~US$5/mês) com Docker Compose: API + Postgres + volume pra sessão Baileys.
- Backup diário `pg_dump` via cron.

### Segurança
- Token admin via `Authorization: Bearer`.
- Endpoints públicos apenas `/health` e `/whatsapp/status`.
- Secrets em `.env`, nunca commitados. `.env.example` versionado.
- Sessão Baileys é credencial sensível — documentar.

## Testes

- **Unitários** (lógica pura): `score_parser`, `guess_scoring_service`, `featured_match_picker`, `ranking_service`.
- **Funcionais** (endpoints HTTP): principais fluxos com banco de teste (Postgres via Docker).
- Integrações externas (API-Football, Baileys) mockadas em teste.

## Fora de escopo (YAGNI)

- Frontend web (monorepo prepara, implementação em iteração posterior).
- Multi-bolão simultâneo.
- Outras ligas (Série B, Europeus).
- Notificações push / email.
- Permissões granulares (só `is_admin` bool).
- Rate limit / anti-abuse.
- Histórico de alterações de palpite.
- BullMQ / Redis / filas.
