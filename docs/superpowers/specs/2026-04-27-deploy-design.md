# Deploy — Palpites do Brasileirão

**Data:** 2026-04-27
**Escopo:** colocar a API + Postgres + WhatsApp gateway em produção 24/7 a custo zero, com pipeline GitHub Actions, TLS automático e backup diário.

## Objetivo

Sair de "rodando local em dev" pra "rodando 24/7 em VPS" sem gastar dinheiro recorrente, atendendo aos 10 usuários do bolão. Deploy precisa ser repetível, seguro e ter caminho de rollback.

## Restrições não-negociáveis

- **Custo recorrente:** R$ 0/mês.
- **Disponibilidade:** 24/7 contínuo. Baileys mantém WebSocket aberto — não pode "dormir" em escala-a-zero.
- **TLS obrigatório** na API admin: `ADMIN_API_TOKEN` trafega como Bearer, HTTP puro inviabiliza.
- **Volume persistente** pra `./storage/whatsapp-auth` (sessão Baileys multi-file): perder = re-parear chip.
- **Backup automatizado:** banco com palpites de uma temporada inteira não pode depender só do disco da VM.

## Arquitetura geral

```
GitHub (main) ──push──▶ GitHub Actions
                          │
                          ├── CI: install → typecheck → lint → prettier --check → test
                          ├── Build Docker image ARM64 → push pra ghcr.io
                          └── Deploy: SSH → docker compose pull → migration:run → up -d

   ┌────────────── Oracle VM (Ubuntu 22.04 ARM Ampere, Vinhedo) ──────────────┐
   │                                                                          │
   │   palpites-bolao.duckdns.org ──▶ Caddy (80/443, Let's Encrypt automático) │
   │                                    │                                     │
   │                                    └──▶ api (palpites-api container)     │
   │                                          │     ├── volume: whatsapp_auth │
   │                                          │     └── network: app + edge   │
   │                                          ▼                               │
   │                                       postgres:16-alpine (volume)        │
   │                                                                          │
   │   cron host: pg_dump diário ──▶ Oracle Object Storage (10 GB free)       │
   │   cron host: DuckDNS update a cada 5 min                                 │
   └──────────────────────────────────────────────────────────────────────────┘
```

3 containers: `caddy`, `api`, `postgres`. 2 crons no host (não em container): backup e DuckDNS. Postgres não expõe porta — só rede interna Docker.

## Componentes

### `apps/api/Dockerfile` (multi-stage, ARM64-nativo)

```
[deps]      base node:24-alpine; corepack enable pnpm
            pnpm install --frozen-lockfile (apenas prod deps)

[builder]   base deps + dev deps; copia src; pnpm build
            (gera build/ via `node ace build`)

[runtime]   base node:24-alpine
            copia build/ + node_modules de prod
            USER node (sem root)
            ENTRYPOINT node bin/server.js
            EXPOSE 3333
            HEALTHCHECK curl /health
```

Imagem final ~150 MB. `corepack` evita instalar pnpm globalmente. Stage `runtime` não tem dev deps nem source TS.

### `docker-compose.prod.yml` (raiz do repo)

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./infra/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [edge]
    restart: unless-stopped

  api:
    image: ghcr.io/<usuario>/palpites-api:latest
    env_file: ./apps/api/.env.production
    volumes:
      - whatsapp_auth:/app/storage/whatsapp-auth
    networks: [edge, app]
    depends_on:
      postgres: { condition: service_healthy }
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: palpites
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: palpites_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets: [db_password]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "palpites"]
      interval: 5s
    networks: [app]
    restart: unless-stopped

volumes:
  postgres_data:
  whatsapp_auth:
  caddy_data:
  caddy_config:

networks:
  edge:        # caddy ↔ api (público)
  app:         # api ↔ postgres (interno, postgres não exposto)

secrets:
  db_password:
    file: ./infra/secrets/db_password.txt
```

Decisões-chave:

- `whatsapp_auth` é **volume nomeado**, não bind: sobrevive a `compose down` e migrações de hardware Oracle.
- Postgres password via **Docker secret** (arquivo `db_password.txt` chmod 600). `.env` cuida do resto.
- Duas redes: `edge` (caddy↔api) e `app` (api↔postgres). Postgres invisível externamente.
- `restart: unless-stopped` em tudo: sobrevive a reboot da VM.

### `infra/Caddyfile`

```
palpites-bolao.duckdns.org {
  reverse_proxy api:3333
  encode gzip
  log {
    output file /data/access.log
  }
}
```

Caddy emite cert Let's Encrypt automático na primeira requisição HTTPS, renova a cada 60 dias. Sem config manual de ACME.

### GitHub Actions — `.github/workflows/ci.yml`

```yaml
on:
  push:
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: palpites, POSTGRES_PASSWORD: palpites, POSTGRES_DB: palpites_test }
        ports: ["5433:5432"]
        options: --health-cmd "pg_isready" --health-interval 5s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 24.14.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @palpites/api typecheck
      - run: pnpm --filter @palpites/api lint
      - run: pnpm --filter @palpites/api format:check
      - run: pnpm --filter @palpites/api test
```

Adicionar script `format:check": "prettier --check ."` ao `apps/api/package.json` pra suportar a etapa.

### GitHub Actions — `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/api/Dockerfile
          platforms: linux/arm64
          tags: |
            ghcr.io/${{ github.repository_owner }}/palpites-api:${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/palpites-api:latest
          push: true
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/palpites
            git pull origin main
            docker compose -f docker-compose.prod.yml pull api
            docker compose -f docker-compose.prod.yml up -d --no-deps api
            docker compose -f docker-compose.prod.yml exec -T api node ace migration:run --force
```

Decisões-chave:

- **CI roda em todo push e PR**, deploy só em `main`.
- **Build ARM64 emulado via QEMU** no runner x86 do GitHub. Cache do buildx via `type=gha`: builds incrementais ~30s.
- **Tag dupla** (`:sha` + `:latest`): `:sha` pra rollback rápido, `:latest` pro deploy default.
- **`pull` + `up -d --no-deps api`**: atualiza só a API, não toca em Postgres/Caddy.
- **`migration:run` rodada após o `up`**: container já está com a imagem nova. `--force` evita prompt em prod.
- **`git pull` no servidor**: necessário pra `Caddyfile`, `docker-compose.prod.yml`, `infra/backup.sh` seguirem versionados. Repo é clonado em `/opt/palpites` no setup inicial.

### Secrets do GitHub repo

| Secret | Origem |
|---|---|
| `DEPLOY_HOST` | IP público da VM Oracle |
| `DEPLOY_USER` | `deploy` (criado no provisioning) |
| `DEPLOY_SSH_KEY` | chave privada do `deploy@VM` |
| `GITHUB_TOKEN` | automático (não configurar manualmente) |

### Variáveis do `.env.production`

```
NODE_ENV=production
APP_KEY=<openssl rand -hex 32>
APP_URL=https://palpites-bolao.duckdns.org
HOST=0.0.0.0
PORT=3333
LOG_LEVEL=info
TZ=America/Sao_Paulo

DB_HOST=postgres
DB_PORT=5432
DB_USER=palpites
DB_PASSWORD=<conteúdo de infra/secrets/db_password.txt>
DB_DATABASE=palpites_prod

ADMIN_API_TOKEN=<openssl rand -hex 32>
FOOTBALL_DATA_TOKEN=<token gratuito de football-data.org>

WHATSAPP_MODE=real
WHATSAPP_GROUP_JID=<obtido após pareamento, via whatsapp:list-groups>
WHATSAPP_AUTH_PATH=/app/storage/whatsapp-auth
```

Permissão: `chmod 600 apps/api/.env.production`. Mesma regra pra `infra/secrets/db_password.txt`.

## Pareamento Baileys (procedimento manual único)

Headless via SSH:

1. SSH na VM
2. `docker compose -f docker-compose.prod.yml up -d`
3. `docker compose logs -f api` — Baileys imprime QR no terminal (dep `qrcode-terminal` já existe)
4. Escanear QR com chip dedicado (WhatsApp Web → Dispositivos conectados)
5. "Connection open" no log → sessão salva em `/app/storage/whatsapp-auth`
6. Ctrl+C nos logs (não derruba container)

Pós-pareamento:

```
docker compose exec api node ace whatsapp:list-groups
```

Copia o JID do grupo do bolão, edita `.env.production`, restart no container pra aplicar.

Sessão persiste no volume nomeado `whatsapp_auth`. Reboot, redeploy, restart — tudo mantém. Re-pareamento só se chip for desconectado manualmente do WhatsApp Web ou se o volume for destruído.

## DuckDNS update (cron host)

Oracle Free Tier dá IP público reservado (não muda em stop/start), mas atualização periódica é seguro de barganha:

```
*/5 * * * * deploy curl -s "https://www.duckdns.org/update?domains=palpites-bolao&token=<TOKEN>&ip=" >> /var/log/duckdns.log 2>&1
```

DuckDNS detecta IP de origem da requisição (`ip=` vazio). Token gerado em `duckdns.org` (login com Google/GitHub). Subdomínio `palpites-bolao` criado pelo usuário no painel.

## Backup Postgres → Oracle Object Storage

Setup único na VM:

1. Instalar OCI CLI: `bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"`
2. Criar API key no console Oracle (Identity → User → API Keys → Generate)
3. `oci setup config` cola a chave e configura `~/.oci/config`
4. Criar bucket `palpites-backups` no Object Storage (10 GB free)
5. **Lifecycle Policy** no bucket: deletar objetos com prefixo `pg/` e idade > 30 dias

Script `/opt/palpites/infra/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/palpites-${TIMESTAMP}.sql.gz"
NAMESPACE=$(oci os ns get --query 'data' --raw-output)

docker compose -f /opt/palpites/docker-compose.prod.yml exec -T postgres \
  pg_dump -U palpites -d palpites_prod --no-owner --no-privileges \
  | gzip -9 > "$BACKUP_FILE"

oci os object put \
  --namespace "$NAMESPACE" \
  --bucket-name palpites-backups \
  --file "$BACKUP_FILE" \
  --name "pg/palpites-${TIMESTAMP}.sql.gz" \
  --force

# Retém 7 dias local como fallback
mv "$BACKUP_FILE" /var/backups/palpites/
find /var/backups/palpites -name "palpites-*.sql.gz" -mtime +7 -delete

logger -t palpites-backup "backup ok: ${TIMESTAMP}"
```

Cron diário 03:00 UTC (~00:00 BRT):

```
0 3 * * * deploy /opt/palpites/infra/backup.sh
```

Capacidade: banco de 10 usuários por temporada inteira (~38 rodadas × ~10 palpites + scores) é < 5 MB comprimido. 30 dias = 150 MB. Cabe nos 10 GB Object Storage com folga de 65×.

Restore (runbook):

```
oci os object get --namespace <ns> --bucket palpites-backups \
  --name pg/palpites-<timestamp>.sql.gz --file /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | docker compose exec -T postgres \
  psql -U palpites -d palpites_prod
```

## Provisioning runbook (passo a passo)

### 1. Criar VM no console Oracle

- Compute → Instances → Create Instance
- Name: `palpites-prod`
- Region: South America East (Vinhedo)
- Image: Ubuntu 22.04 (Always Free Eligible)
- Shape: **`VM.Standard.A1.Flex`** ARM Ampere — 1 OCPU + 6 GB RAM (pode ir até 4+24 sem custo)
- Networking: VCN nova; "Assign a public IPv4" marcado
- SSH keys: chave pública do dev local
- Boot volume: 50 GB (default)

Se "out of capacity": tentar outra AD ou clicar "Create" de novo a cada poucos minutos.

### 2. Security List (firewall externo Oracle)

Networking → VCN → Security List default → Ingress Rules:

| Source | Protocol | Port |
|---|---|---|
| 0.0.0.0/0 | TCP | 22 |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

### 3. Hardening da VM (primeiro acesso)

```bash
ssh ubuntu@<IP-PUBLICO>

# Atualiza
sudo apt update && sudo apt upgrade -y

# PEGADINHA ORACLE: iptables vem bloqueando 80/443 mesmo com Security List ok
sudo iptables -F
sudo iptables -X
sudo netfilter-persistent save
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Usuário deploy
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# SSH só com chave
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Auto-updates de segurança
sudo dpkg-reconfigure -plow unattended-upgrades

# Docker + plugin compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy

# Re-login como deploy
exit
ssh deploy@<IP-PUBLICO>
```

### 4. Clone do repo + secrets

```bash
sudo mkdir -p /opt/palpites && sudo chown deploy:deploy /opt/palpites
cd /opt
git clone https://github.com/<usuario>/palpites-brasileirao.git palpites
cd palpites

cp apps/api/.env.example apps/api/.env.production
nano apps/api/.env.production            # preenche todas as vars
chmod 600 apps/api/.env.production

mkdir -p infra/secrets
openssl rand -base64 32 > infra/secrets/db_password.txt
chmod 600 infra/secrets/db_password.txt
```

### 5. DuckDNS + GitHub secrets + primeiro deploy

```bash
# DuckDNS: criar conta + subdomínio em duckdns.org, depois:
echo "*/5 * * * * deploy curl -s 'https://www.duckdns.org/update?domains=palpites-bolao&token=<TOKEN>&ip=' > /dev/null 2>&1" \
  | sudo tee /etc/cron.d/duckdns

# GitHub repo → Settings → Secrets and variables → Actions:
# DEPLOY_HOST, DEPLOY_USER (deploy), DEPLOY_SSH_KEY (chave privada deploy@VM)

# Primeiro deploy MANUAL (CI ainda não disparou)
docker login ghcr.io -u <usuario>           # PAT com read:packages
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api node ace migration:run --force

# Pareamento WhatsApp (cf. seção dedicada)
docker compose logs -f api
docker compose exec api node ace whatsapp:list-groups
# copia JID, edita .env.production, restart api
docker compose -f docker-compose.prod.yml restart api

# Backup setup
sudo apt install -y python3-pip
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
oci setup config
sudo mkdir -p /var/backups/palpites && sudo chown deploy:deploy /var/backups/palpites
chmod +x /opt/palpites/infra/backup.sh
echo "0 3 * * * deploy /opt/palpites/infra/backup.sh" | sudo tee /etc/cron.d/palpites-backup
```

### 6. Validação

```bash
curl https://palpites-bolao.duckdns.org/health
# → {"status":"ok"}

sudo -u deploy /opt/palpites/infra/backup.sh
oci os object list --bucket-name palpites-backups
# → palpites-<timestamp>.sql.gz

git commit --allow-empty -m "chore: smoke test ci/cd" && git push
# acompanha em GitHub Actions
```

## Riscos conhecidos e mitigações

| Risco | Mitigação |
|---|---|
| ARM "out of capacity" na criação | Tentar várias vezes / outra AD / outra região |
| iptables Oracle bloqueia 80/443 mesmo com Security List ok | Flush iptables + ufw como única gerência |
| Sessão Baileys perdida em redeploy | Volume nomeado `whatsapp_auth` sobrevive; só re-pareia se volume for destruído |
| Migration quebra deploy | CI roda 157 testes contra schema; se ainda assim falhar, rollback `docker compose pull api:<sha-anterior>` |
| Conta Oracle "reclama" instância idle | Upgrade pra Pay As You Go (não cobra dentro do free tier) — desabilita reclamation |
| Let's Encrypt rate limit (50 certs/semana) | Caddy lida automático; não vamos chegar perto |
| `pg_dump` durante write pesado | Postgres garante consistência via snapshot transacional. Sem ação. |
| IP da VM mudar | Cron DuckDNS atualiza a cada 5 min + Oracle dá IP reservado por padrão |
| Breve 502 do Caddy durante `up -d --no-deps api` (~3-5s) | Aceitável pra 10 usuários. Mitigação futura: rolling deploy com 2 réplicas atrás do Caddy. |

## Fora de escopo (próximas iterações)

- Monitoramento ativo da conexão Baileys (alerta de sessão expirada via webhook/email).
- UptimeRobot externo monitorando `/health`.
- Métricas (Prometheus + Grafana).
- Multi-environment (staging).
- Canary / blue-green deploy.
- IaC (Terraform) — provisioning é manual via console + scripts shell.
- Rollback automático no GitHub Actions caso healthcheck falhe pós-deploy.
- Frontend `apps/web/` (Next.js) atrás do mesmo Caddy.
