#!/usr/bin/env bash
# Octamy nightly Postgres backup.
# Usage:   bash scripts/pg-backup.sh
# Cron:    0 3 * * *  /var/www/html/octamy-certifications/scripts/pg-backup.sh >> /var/log/octamy-pg-backup.log 2>&1
#
# Reads DATABASE_URL from /var/www/html/octamy-certifications/.env
# Writes gzip dump to /var/backups/octamy/octamy-YYYY-MM-DD.sql.gz
# Keeps last 14 days; older files are deleted.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/octamy-certifications}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/octamy}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -f "$APP_DIR/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | xargs -d '\n' -I{} echo {})
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[pg-backup] DATABASE_URL not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

STAMP=$(date +%F)
OUT="$BACKUP_DIR/octamy-$STAMP.sql.gz"

echo "[pg-backup] $(date -Iseconds) -> $OUT"
pg_dump --no-owner --no-acl --clean --if-exists "$DATABASE_URL" | gzip -9 > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
chmod 640 "$OUT"

# Verify
if [[ ! -s "$OUT" ]]; then
  echo "[pg-backup] backup file empty — aborting rotation" >&2
  exit 2
fi

# Rotate
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'octamy-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
SIZE=$(du -h "$OUT" | cut -f1)
echo "[pg-backup] OK size=$SIZE retained_days=$RETENTION_DAYS"
