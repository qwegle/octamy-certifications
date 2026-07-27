#!/usr/bin/env bash
# Octamy nightly Postgres backup.
# Usage:   bash scripts/pg-backup.sh
# Cron:    0 3 * * *  /var/www/html/octamy-certifications/scripts/pg-backup.sh >> /var/log/octamy-pg-backup.log 2>&1
#
# Reads DATABASE_URL from /var/www/html/octamy-certifications/.env.
# Publishes an atomic gzip SQL dump plus a verified SHA-256 sidecar.

set -Eeuo pipefail
IFS=$'\n\t'

APP_DIR="${APP_DIR:-/var/www/html/octamy-certifications}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/octamy}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

for command in pg_dump gzip sha256sum tail grep awk; do
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
SUM="$OUT.sha256"
TMP="$(mktemp "$BACKUP_DIR/.octamy-backup.XXXXXX")"
TMP_SUM="$(mktemp "$BACKUP_DIR/.octamy-checksum.XXXXXX")"

cleanup() {
  rm -f "$TMP" "$TMP_SUM"
}
trap cleanup EXIT

echo "[pg-backup] $(date -Iseconds) -> $OUT"
pg_dump --no-owner --no-acl --clean --if-exists --dbname="$DATABASE_URL" | gzip -9 > "$TMP"

[[ -s "$TMP" ]] || {
  echo "[pg-backup] backup file empty — aborting rotation" >&2
  exit 2
}
gzip -t "$TMP"
if ! gzip -cd "$TMP" | tail -n 20 | grep -Fq -- '-- PostgreSQL database dump complete'; then
  echo "[pg-backup] dump completion marker missing — refusing to publish" >&2
  exit 2
fi

HASH="$(sha256sum "$TMP" | awk '{print $1}')"
printf '%s  %s\n' "$HASH" "$(basename "$OUT")" > "$TMP_SUM"
chmod 640 "$TMP" "$TMP_SUM"
mv "$TMP" "$OUT"
mv "$TMP_SUM" "$SUM"
trap - EXIT

(
  cd "$BACKUP_DIR"
  sha256sum -c "$(basename "$SUM")"
)

while IFS= read -r -d '' expired; do
  rm -f -- "$expired" "$expired.sha256"
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'octamy-*.sql.gz' -mtime "+$RETENTION_DAYS" -print0)

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[pg-backup] OK size=$SIZE sha256=$HASH retained_days=$RETENTION_DAYS"
