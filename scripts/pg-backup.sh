#!/usr/bin/env bash
# Octamy nightly Postgres backup.
# Usage:   bash scripts/pg-backup.sh
# Cron:    0 3 * * *  /var/www/html/octamy-certifications/scripts/pg-backup.sh >> /var/log/octamy-pg-backup.log 2>&1
#
# Reads DATABASE_URL from /var/www/html/octamy-certifications/.env
# Writes an atomic gzip dump to /var/backups/octamy with a unique UTC timestamp.
# Keeps last 14 days; older files are deleted.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/octamy-certifications}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/octamy}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

for command in pg_dump gzip; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "[pg-backup] required command is missing: $command" >&2
    exit 1
  }
done

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[pg-backup] DATABASE_URL not set" >&2
  exit 1
fi

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "[pg-backup] RETENTION_DAYS must be a non-negative integer" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT="$BACKUP_DIR/octamy-$STAMP-$$.sql.gz"
TMP="$(mktemp "$BACKUP_DIR/.octamy-backup.XXXXXX")"

cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT

echo "[pg-backup] $(date -Iseconds) -> $OUT"
pg_dump --no-owner --no-acl --clean --if-exists --dbname="$DATABASE_URL" | gzip -9 > "$TMP"

# Verify the completed archive before publishing it under the retained name.
if [[ ! -s "$TMP" ]]; then
  echo "[pg-backup] backup file empty — aborting rotation" >&2
  exit 2
fi
gzip -t "$TMP"

chmod 640 "$TMP"
mv "$TMP" "$OUT"
trap - EXIT

# Rotate
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'octamy-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
SIZE=$(du -h "$OUT" | cut -f1)
echo "[pg-backup] OK size=$SIZE retained_days=$RETENTION_DAYS"
