# packages/shared — Context for Claude

Tipos e constantes compartilhadas entre `apps/api` e futuro `apps/web`. Zero runtime dependencies.

**Estrutura:**
```
src/
  index.ts     # re-exporta tudo
  status.ts    # RoundStatus, MatchStatus (const + type com mesmo nome)
  views.ts     # Shapes "de fio" dos responses HTTP (UserSummary, MatchView, GuessListItem, GuessListView)
```

**Regra dos view types:** eles representam o **formato JSON do response**, não os models internos. Datas são `string` (ISO 8601), não `DateTime`. Enums são as string literals definidas em `status.ts`. Quando adicionar uma nova view, o presenter (`apps/api/app/presenters/`) faz o mapping de `Match` → `MatchView` serializando explicitamente (`kickoffAt: match.kickoffAt.toISO()!`).

**Constraint:** tudo aqui deve ser seguro para browser (sem `node:*`, sem `fs`, sem `process.env`, **sem luxon/DateTime**). Se precisar de runtime Node-only, fica em `apps/api/`.

> **Contexto global:** ver `../../CLAUDE.md` na raiz do monorepo.

## O que mora aqui

- **Tipos de domínio**: `RoundStatus`, `MatchStatus`, enums de status de negócio.
- **DTOs de API** (futuro): tipos serializáveis de request/response.
- **Constantes compartilhadas** (futuro): limites de placar, formatos de data, mensagens padrão do WhatsApp.

## O que NÃO mora aqui

- **Runtime code** com side effects (logger, http client, config).
- **Lucid models** — ficam em `apps/api/app/models/`.
- **Integrações externas** (football-data.org, Baileys) — ficam em `apps/api/app/integrations/`.
- **Dependências pesadas** — o pacote deve ser importável tanto por Node (API) quanto por browser (futuro web) sem polyfills.

## Convenções

- **ESM only** — `"type": "module"` implícito via config do TS.
- **Source-to-source linking**: `main` e `types` apontam pro TS direto (`./src/index.ts`). Não há build obrigatório pro consumer usar — o TSC do consumidor resolve.
- **`lint` = `tsc --noEmit`** — não há ESLint aqui ainda.
- **Export nomeado sempre**, sem default exports.
- **Enums como union de literais** (ex: `type RoundStatus = 'pending' | 'open' | ...`), não `enum`. Evita gerar runtime code e combina melhor com validators (Vine).

## Como consumir no apps/api

```ts
import type { RoundStatus } from '@palpites/shared'
```

Está linkado via pnpm workspace (`workspace:*` em `dependencies`). Mudanças em `src/index.ts` aparecem imediatamente na API sem rebuild.

## Ao adicionar algo

1. Pergunta: é consumido por **múltiplos apps** ou só por um? Se só um, mora no app.
2. Pergunta: tem side-effect, ou depende de runtime específico (Node only)? Se sim, não mora aqui.
3. Se a resposta for "tipo puro usado em múltiplos apps", adiciona no `src/index.ts` com export nomeado e tipo-alias preferencialmente.
