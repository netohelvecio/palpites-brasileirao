# Backup setup — palpites-brasileirao

Setup único na VM Oracle. Pré-requisitos: VM provisionada (Plan 6.5), Docker rodando, repo clonado em `/opt/palpites`.

## 1. Instalar OCI CLI

```bash
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
```

Ao prompt:

- Install location: default
- Add to PATH: **yes**
- Optional packages: pular

Após:

```bash
exec "$SHELL"
oci --version
```

Expected: versão impressa (ex: `3.42.0`).

## 2. Criar API Key no console Oracle

1. Console Oracle → ícone do usuário (canto superior direito) → **My profile**
2. Resources (esquerda) → **API keys** → **Add API key**
3. Marcar "Generate API key pair" → **Add**
4. **Salvar a chave privada** (download `.pem`) — única chance!
5. Copiar o conteúdo do "Configuration file preview" exibido no modal

## 3. Configurar OCI CLI na VM

Subir a chave privada pra VM:

```bash
# Da sua máquina local:
scp ~/Downloads/<arquivo>.pem deploy@<VM-IP>:~/.oci/oci_api_key.pem
```

Na VM:

```bash
mkdir -p ~/.oci
nano ~/.oci/config            # cole o snippet do "Configuration file preview"
# Edite a linha key_file= apontando pra ~/.oci/oci_api_key.pem
chmod 600 ~/.oci/oci_api_key.pem ~/.oci/config
```

Testar:

```bash
oci os ns get
```

Expected: namespace impresso (string tipo `axxxxxxxxxxxx`).

## 4. Criar bucket no Object Storage

```bash
oci os bucket create \
  --name palpites-backups \
  --compartment-id "$(oci iam compartment list --query 'data[0].id' --raw-output)" \
  --public-access-type NoPublicAccess
```

Expected: JSON com detalhes do bucket.

## 5. Lifecycle Policy (retenção 30 dias no bucket)

```bash
NAMESPACE=$(oci os ns get --query 'data' --raw-output)

cat > /tmp/lifecycle.json <<'EOF'
{
  "items": [
    {
      "name": "expire-old-backups",
      "action": "DELETE",
      "objectNameFilter": { "inclusionPrefixes": ["pg/"] },
      "timeAmount": 30,
      "timeUnit": "DAYS",
      "isEnabled": true
    }
  ]
}
EOF

oci os object-lifecycle-policy put \
  --namespace "${NAMESPACE}" \
  --bucket-name palpites-backups \
  --from-json file:///tmp/lifecycle.json
```

Expected: confirmação JSON.

## 6. Diretório local + cron

```bash
sudo mkdir -p /var/backups/palpites
sudo chown deploy:deploy /var/backups/palpites
sudo touch /var/log/palpites-backup.log
sudo chown deploy:deploy /var/log/palpites-backup.log

echo "0 3 * * * deploy /opt/palpites/infra/backup.sh >> /var/log/palpites-backup.log 2>&1" |
  sudo tee /etc/cron.d/palpites-backup
sudo chmod 644 /etc/cron.d/palpites-backup
```

Cron roda 03:00 UTC (~00:00 BRT) todo dia.

## 7. Smoke test

```bash
sudo -u deploy /opt/palpites/infra/backup.sh
oci os object list --bucket-name palpites-backups
ls -la /var/backups/palpites/
```

Expected:

- `backup.sh` exit 0
- Listagem mostra `pg/palpites-<timestamp>.sql.gz` no Object Storage
- Mesmo arquivo presente em `/var/backups/palpites/`

## Restore (procedimento manual)

```bash
# Listar backups disponíveis
oci os object list --bucket-name palpites-backups --prefix pg/

# Baixar um específico
oci os object get \
  --namespace "$(oci os ns get --query 'data' --raw-output)" \
  --bucket-name palpites-backups \
  --name pg/palpites-<timestamp>.sql.gz \
  --file /tmp/restore.sql.gz

# Restaurar (CUIDADO: sobrescreve o banco atual)
gunzip -c /tmp/restore.sql.gz |
  docker compose -f /opt/palpites/docker-compose.prod.yml exec -T postgres \
    psql -U palpites -d palpites_prod
```

## Capacidade

10 GB grátis no Object Storage. Banco do bolão (10 usuários × 38 rodadas × 10 palpites + scores) ocupa < 5 MB comprimido por dump. 30 dias × 5 MB = 150 MB. Folga > 65×.
