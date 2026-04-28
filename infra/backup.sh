#!/usr/bin/env bash
# Daily Postgres backup -> Oracle Object Storage.
# Cron entry (executado pelo user `deploy`):
#   0 3 * * * deploy /opt/palpites/infra/backup.sh >> /var/log/palpites-backup.log 2>&1
set -euo pipefail

# Config
COMPOSE_FILE="/opt/palpites/docker-compose.prod.yml"
LOCAL_DIR="/var/backups/palpites"
BUCKET="palpites-backups"
PREFIX="pg/"
RETENTION_DAYS_LOCAL=7

# Setup
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
FILENAME="palpites-${TIMESTAMP}.sql.gz"
TMP_FILE="/tmp/${FILENAME}"

mkdir -p "${LOCAL_DIR}"

# Dump streamado e comprimido (sem arquivo intermediário)
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U palpites -d palpites_prod --no-owner --no-privileges |
  gzip -9 >"${TMP_FILE}"

# Sanity: arquivo > 0 bytes
if [ ! -s "${TMP_FILE}" ]; then
  logger -t palpites-backup "FAILED: backup empty for ${TIMESTAMP}"
  exit 1
fi

# Upload pra Object Storage
NAMESPACE=$(oci os ns get --query 'data' --raw-output)
oci os object put \
  --namespace "${NAMESPACE}" \
  --bucket-name "${BUCKET}" \
  --file "${TMP_FILE}" \
  --name "${PREFIX}${FILENAME}" \
  --force

# Mantém 7 dias local como fallback
mv "${TMP_FILE}" "${LOCAL_DIR}/"
find "${LOCAL_DIR}" -name "palpites-*.sql.gz" -mtime "+${RETENTION_DAYS_LOCAL}" -delete

logger -t palpites-backup "ok: ${FILENAME}"
