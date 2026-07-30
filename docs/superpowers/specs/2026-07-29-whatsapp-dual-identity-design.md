# WhatsApp Dual Identity (telefone + lid) — Design

**Data**: 2026-07-29
**Status**: aprovado para planejamento

## Problema

`users.whatsapp_number` guarda **ou** o telefone E.164 **ou** o JID `@lid`, e a busca do inbound é match exato num único valor. Qual dos dois formatos chega depende de o Baileys conseguir resolver `m.key.senderPn` — e isso é propriedade da sessão, não do usuário.

Em 2026-07-29 a sessão do WhatsApp foi re-pareada. A sessão nova passou a resolver `senderPn`, `fromNumber` virou telefone, e **todos os usuários cadastrados com `@lid` deixaram de ser encontrados de uma vez**. O bot passou a responder `NOT_REGISTERED` e a convidar cada um a rodar `/cadastro`.

Log do incidente:

```json
{"remoteJid":"1348703617067@lid","pushName":"Helvécio Neto","fromNumber":"557196916296","msg":"BaileysClient: DM inbound"}
```

Linha correspondente no banco: `whatsapp_number = '1348703617067@lid'`.

Agravante: quem seguisse a instrução de rodar `/cadastro` criaria uma **linha duplicada** — `handleRegister` procura pelo telefone, não acha, e cria usuário novo com `is_admin: false`, deixando o histórico e os scores órfãos na linha antiga.

## Solução em uma frase

Separar as duas identidades em colunas próprias (`whatsapp_number` = telefone, `whatsapp_lid` = JID), buscar o usuário por qualquer uma das duas numa query só, e deixar o handler preencher sozinho o campo que faltar conforme cada pessoa mandar a primeira DM.

## Regras de domínio

1. **`whatsapp_number` é telefone E.164 sem `+`** (ex.: `557196916296`), ou `NULL` quando ainda não se sabe.
2. **`whatsapp_lid` é o JID completo** (ex.: `1348703617067@lid`), ou `NULL` quando a pessoa nunca mandou DM por `@lid`.
3. **Um usuário é encontrado por qualquer uma das duas identidades.** Não há precedência: é uma query com `OR`.
4. **Auto-cura só preenche buraco.** Campo `NULL` recebe o valor que veio na mensagem. Campo já preenchido com valor divergente **não** é sobrescrito — vira `logger.warn`. Divergência é sinal de algo real (número portado, troca de chip), não ruído.
5. **Unicidade vale só entre linhas vivas.** Índices únicos parciais com `WHERE is_deleted = false` nas duas colunas.
6. **Resposta a DM sai sempre pelo `fromJid`** — a origem da mensagem é sempre um destino válido, e não depende de o telefone ser conhecido.

## Arquitetura

### Fluxo do inbound

```
BaileysClient.messages.upsert
  ├─ DM @s.whatsapp.net → fromNumber = <telefone>, fromJid = <telefone>@s.whatsapp.net
  └─ DM @lid            → fromNumber = senderPn ?? null, fromJid = <lid>@lid
        │
        ▼
WhatsAppInboundHandler.handle(msg)
  ├─ /cadastro  → resolveUser → existe? avisa : cria com os dois campos
  ├─ /escolher  → resolveUser → gate de admin
  └─ palpite    → resolveUser → parse + upsert

resolveUser(msg)
  ├─ userRepository.findByWhatsappIdentity(msg.fromNumber, msg.fromJid)
  │     WHERE whatsapp_number = :phone OR whatsapp_lid = :jid
  └─ achou? healIdentity(user, msg)
        ├─ whatsapp_number NULL e msg tem telefone → grava
        ├─ whatsapp_lid    NULL e fromJid é @lid   → grava
        ├─ valor existente diverge                 → logger.warn, não escreve
        └─ nada mudou                              → nenhum write
```

### Estado da base ao longo do tempo

| Momento | `whatsapp_number` | `whatsapp_lid` |
|---|---|---|
| Hoje (pré-migration) | `1348703617067@lid` | — |
| Pós-migration | `NULL` | `1348703617067@lid` |
| Após a 1ª DM da pessoa | `557196916296` | `1348703617067@lid` |

A convergência é preguiçosa e não exige ação de ninguém. Enquanto `whatsapp_number` for `NULL`, tanto a busca quanto o envio de DM funcionam pelo lid — que é exatamente o que já funcionava antes do incidente.

## Schema

### Migration `0013_add_whatsapp_lid_to_users`

Prefixo numérico manual (convenção do projeto — não usar `make:migration`).

**up()**, nesta ordem:

1. `table.string('whatsapp_lid', 40).nullable()` — 40 dá folga sobre os ~18 chars de um JID `@lid`.
2. `ALTER TABLE users ALTER COLUMN whatsapp_number DROP NOT NULL` via `this.schema.raw`. Raw pontual em vez de `.alter()` do Knex, que reescreve a definição inteira da coluna e pode derrubar constraints/defaults junto.
3. `UPDATE users SET whatsapp_lid = whatsapp_number, whatsapp_number = NULL WHERE whatsapp_number LIKE '%@lid'`
4. Troca do unique comum pelos parciais:

```sql
ALTER TABLE users DROP CONSTRAINT users_whatsapp_number_unique;

CREATE UNIQUE INDEX users_whatsapp_number_active_unique
  ON users (whatsapp_number) WHERE is_deleted = false;

CREATE UNIQUE INDEX users_whatsapp_lid_active_unique
  ON users (whatsapp_lid) WHERE is_deleted = false;
```

> `users_whatsapp_number_unique` é o nome que o Knex gera por padrão para `.unique()` em `0001`, mas a implementação deve **confirmar o nome real** (`\d users` no psql) antes de escrever o `DROP CONSTRAINT` — errar o nome faz a migration falhar no meio, depois de o `DROP NOT NULL` e o `UPDATE` já terem rodado.

O `whatsapp_lid` já nasce com índice parcial, sem passar por um unique comum antes. Postgres aceita múltiplos `NULL` em índice único, então as duas colunas convivem nullable+unique sem conflito.

**down()**: reverte na ordem inversa — dropa os índices parciais, recria o `UNIQUE` comum em `whatsapp_number`, devolve `whatsapp_number = whatsapp_lid` onde o número está `NULL`, dropa a coluna e restaura o `NOT NULL`.

> Após `migration:run`, rodar `pnpm format` — o codegen do Adonis 7 regenera `database/schema.ts` e o prettier precisa reformatar, senão o lint do CI quebra.

### Efeito colateral aceito do índice parcial

Com `WHERE is_deleted = false`, a linha soft-deletada de um usuário deixa de reservar o número. Consequência conhecida e aceita: **um usuário removido consegue se recadastrar** via `/cadastro`. Hoje ele fica bloqueado por acidente — o `INSERT` estoura unique violation e a pessoa recebe "Erro interno, avise o admin". Bloqueio real de usuário, se um dia for necessário, é campo próprio, não efeito colateral de constraint.

Isso também corrige um bug existente: `POST /users` com o número de alguém soft-deletado hoje retorna 500 (unique violation) em vez de criar.

## Porta WhatsApp — `whatsapp_client.ts`

```ts
export interface IncomingMessage {
  fromNumber: string | null
  fromJid: string
  text: string
  messageId: string
}
```

`fromJid` é sempre o `remoteJid` cru. `fromNumber` é o E.164 quando o `senderPn` resolve, senão `null`.

Some o fallback atual (`fromNumber = m.key.remoteJid` quando não há `senderPn`), que é a origem da ambiguidade: um campo chamado "number" carregando às vezes um JID.

`StubClient` e `DisabledClient` não constroem `IncomingMessage` — nenhuma mudança neles.

## `BaileysClient`

No `messages.upsert`, a resolução passa a produzir os dois campos:

```ts
const fromJid = m.key.remoteJid!
const fromNumber = isPlainDM
  ? fromJid.replace(/@s\.whatsapp\.net$/, '')
  : typeof (m.key as any).senderPn === 'string'
    ? (m.key as any).senderPn.replace(/@s\.whatsapp\.net$/, '')
    : null
```

O log `BaileysClient: DM inbound` já emite `remoteJid` e `fromNumber` — mantém como está, é o que permitiu diagnosticar o incidente.

## `UserRepository`

`findByWhatsappNumber` sai; entra a busca pelas duas identidades:

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

O agrupamento importa: sem ele o `orWhere` escaparia do escopo de soft delete aplicado pelo `@beforeFetch`. Com `phone = null`, sobra só a cláusula do lid — nunca `whatsapp_number IS NULL`.

`existsByWhatsappNumber` continua como está: serve o `POST /users`, que só lida com telefone.

## `WhatsAppInboundHandler`

Os três pontos que hoje chamam `findByWhatsappNumber(msg.fromNumber)` passam por um helper único:

```ts
private async resolveUser(msg: IncomingMessage): Promise<User | null> {
  const user = await this.userRepository.findByWhatsappIdentity(msg.fromNumber, msg.fromJid)
  if (user) await this.healIdentity(user, msg)
  return user
}
```

`healIdentity` monta um patch parcial, loga divergência e só escreve se houver o que mudar. Nenhum write em regime estável.

`handleRegister` cria com as duas identidades:

```ts
whatsappNumber: msg.fromNumber,
whatsappLid: msg.fromJid.endsWith('@lid') ? msg.fromJid : null,
```

Todos os `sendToUser(msg.fromNumber, ...)` do handler viram `sendToUser(msg.fromJid, ...)`.

## Model `User`

Getter simples para o destino de DM proativa:

```ts
get whatsappTarget(): string | null {
  return this.whatsappLid ?? this.whatsappNumber
}
```

> **Revisado em 2026-07-29, após a revisão final da branch.** A ordem original era `whatsappNumber ?? whatsappLid`. Foi invertida porque o lid é o endereço **provado em produção** para os contatos de privacidade-lid, enquanto o JID de telefone nunca foi exercitado com eles — e uma entrega que falha não levanta erro no Baileys, então a DM sumiria em silêncio. Preferimos o caminho conhecido e deixamos o telefone como fallback.

Getter puro, não `@computed` — não entra na serialização, então `guesses.spec.ts:140` (que assere ausência de `whatsappNumber` na resposta) continua válido.

`OpenRoundJob` passa `user.whatsappTarget` ao notifier e pula com `logger.warn` quando for `null`. `WhatsAppNotifier.notifyRoundOpenedToUser` troca `whatsappNumber` por `whatsappTarget: string` na assinatura.

## `commands/whatsapp/lookup_lid.ts`

Só a descrição, que hoje diz "útil pra preencher `users.whatsapp_number` com o lid" e passa a apontar `users.whatsapp_lid`. Sem mudança de comportamento.

## Testes

### Functional — `whatsapp_inbound_handler.spec.ts`

Os ~20 literais de `IncomingMessage` existentes ganham `fromJid`. Para os casos de telefone puro, `fromJid: '<numero>@s.whatsapp.net'` — o que o `BaileysClient` produziria.

Casos novos:

- acha o usuário pelo lid com `whatsapp_number` NULL — **reproduz o bug de 2026-07-29**
- acha pelo telefone com `whatsapp_lid` NULL
- auto-cura preenche `whatsapp_number` que estava NULL
- auto-cura preenche `whatsapp_lid` que estava NULL
- divergência entre gravado e recebido não sobrescreve e não interrompe o fluxo
- `/cadastro` novo grava as duas identidades
- `/cadastro` de DM `@s.whatsapp.net` grava lid `NULL`
- reply sai para o `fromJid`

### Functional — repositório

`findByWhatsappIdentity` com `phone = null` não casa linha de número nulo.

### Functional — `open_round_job.spec.ts`

Usuário com `whatsapp_number` NULL recebe a DM proativa pelo lid.

### Functional — índice parcial

Dois usuários vivos com o mesmo número → erro. Um soft-deletado e um vivo com o mesmo número → passa. Idem para `whatsapp_lid`. Inclui o caso de `POST /users` com número de soft-deletado, que hoje retorna 500.

### Factory

`UserFactory` continua gerando só `whatsappNumber`. Estado opcional `withLid` para os testes que precisam das duas identidades.

## Risco de ordem no deploy

`deploy.yml` sobe o container novo (linha 77), espera o `/health`, e só então roda `migration:run` (linha 95). Existe uma janela de até ~60s com código novo contra schema velho: uma DM que chegue nela bate em `column "whatsapp_lid" does not exist`.

Rodar a migration antes do push não é possível — o arquivo só existe dentro da imagem nova, que é justamente o motivo da ordem ser essa.

**Decisão**: aceitar a janela e fazer o push em horário morto. São 7 usuários, o bot fica fora do ar durante o restart de qualquer forma, e reformar o pipeline não se justifica agora.

O restart **não** exige re-pareamento: o volume `whatsapp_auth` persiste e o Baileys reconecta sozinho.

## Não-objetivos

- **Bloqueio explícito de usuário.** O índice parcial destrava o recadastro de quem foi removido. Se virar necessidade, é campo próprio numa próxima iteração.
- **Reformar a ordem do `deploy.yml`.** Ver acima.
- **Fechar o auto-cadastro.** Hoje qualquer um que mande DM pro número do bot consegue se cadastrar sozinho. Problema real e conhecido, mas ortogonal a este.
- **Backfill manual dos telefones.** A convergência é preguiçosa, pela auto-cura.
- **Normalizar formato de telefone** (nono dígito, DDI). Guardamos exatamente o que o `senderPn` entrega.

## Plano de implementação (alto nível)

1. Migration `0013` + regeneração do `database/schema.ts` + `pnpm format`
2. Porta `IncomingMessage` + `BaileysClient` + ajuste dos literais nos testes existentes
3. `findByWhatsappIdentity` + `resolveUser`/`healIdentity` no handler + reply por `fromJid`
4. Getter `whatsappTarget` + `OpenRoundJob` + assinatura do notifier
5. Testes novos (identidade, auto-cura, índice parcial) + descrição do `lookup_lid`
