# Acesso à produção — palpites-brasileirao

Como acessar a VM Oracle, o banco de produção e os logs da API. Contexto: a stack roda via Docker Compose em `/opt/palpites` na VM Oracle Always Free (São Paulo), containers `palpites-api-1`, `palpites-postgres-1` e `palpites-caddy-1`.

## Pré-requisito: chave SSH

O acesso é sempre como `deploy@147.15.112.59` com a chave **`~/.ssh/palpites_actions`**.

> **Gotcha**: a chave `~/.ssh/palpites_oracle` **não funciona** — foi rejeitada tanto para `deploy@` quanto para `ubuntu@` (testado em 2026-07-17). A chave válida é a `palpites_actions` (a mesma do secret `DEPLOY_SSH_KEY` do GitHub Actions).

Opcional, mas recomendado — alias no `~/.ssh/config` para encurtar todos os comandos abaixo:

```
Host palpites-prod
  HostName 147.15.112.59
  User deploy
  IdentityFile ~/.ssh/palpites_actions
```

Com o alias, troque `ssh -i ~/.ssh/palpites_actions deploy@147.15.112.59` por `ssh palpites-prod` em qualquer comando deste runbook.

## 1. Conectar no servidor Oracle

```bash
ssh -i ~/.ssh/palpites_actions deploy@147.15.112.59
```

Na VM:

- Repo/stack em `/opt/palpites`
- `docker ps` mostra os 3 containers (api, postgres, caddy)
- Deploy é automático via GitHub Actions no push para `main` — não editar arquivos na VM manualmente

## 2. Conectar no banco de produção

O Postgres está bound em `127.0.0.1:5432` **na VM** (ufw + bind loopback) — não é exposto na internet. Há dois caminhos:

### Opção A — psql rápido dentro do container (sem senha)

```bash
ssh -t -i ~/.ssh/palpites_actions deploy@147.15.112.59 \
  'cd /opt/palpites && docker compose -f docker-compose.prod.yml exec postgres psql -U palpites -d palpites_prod'
```

- `-t` força TTY para o prompt interativo do psql
- Não pede senha: conexão local via socket dentro do container

### Opção B — túnel SSH para cliente local (DBeaver/TablePlus/psql)

```bash
ssh -N -f -L 15432:127.0.0.1:5432 -i ~/.ssh/palpites_actions deploy@147.15.112.59
```

- `-N` não abre shell, `-f` manda para background
- Porta local: **15432** (a 5432 local fica livre para o Postgres dev do compose)

Dados de conexão:

| Campo | Valor |
|---|---|
| Host | `127.0.0.1` |
| Porta | `15432` |
| Database | `palpites_prod` |
| User | `palpites` |
| Senha | só existe na VM — ver abaixo |

```bash
ssh -i ~/.ssh/palpites_actions deploy@147.15.112.59 'cat /opt/palpites/infra/secrets/db_password.txt'
```

String de conexão: `postgresql://palpites:<senha>@127.0.0.1:15432/palpites_prod`

Sem psql instalado localmente, use o client via Docker:

```bash
docker run --rm -it --network host postgres:16-alpine \
  psql -h 127.0.0.1 -p 15432 -U palpites -d palpites_prod
```

Para derrubar o túnel: `pkill -f "15432:127.0.0.1:5432"`

> **Cuidado**: é o banco de produção. Prefira sessões read-only (`SET default_transaction_read_only = on;`) quando for só consultar.

## 3. Ver logs da API

```bash
ssh -i ~/.ssh/palpites_actions deploy@147.15.112.59 \
  'cd /opt/palpites && docker compose -f docker-compose.prod.yml logs -f api'
```

Variantes úteis:

- `--tail 200` — últimas N linhas sem seguir
- `--since 30m` — só os últimos X minutos
- Trocar `api` por `caddy` ou `postgres` para os outros serviços
- `| grep -iE 'error|fail'` — filtrar erros

> **Gotcha**: o `-f docker-compose.prod.yml` é obrigatório. O repo tem 3 compose files (`docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.local-prod.yml`) e em produção a stack só está definida no `.prod.yml` — sem o `-f` dá `no such service: api`.
