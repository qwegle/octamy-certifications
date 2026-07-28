#!/usr/bin/env bash
# Safe, repeatable Octamy production deployment for a Linux + PM2 server.
#
# First use:
#   APP_DIR=/var/www/html/octamy-certifications bash scripts/deploy-production.sh
#
# Optional overrides:
#   BRANCH=main PM2_APP=octamy HEALTHCHECK_URL=http://127.0.0.1:5000/readyz \
#     BACKUP_DIR=/var/backups/octamy bash scripts/deploy-production.sh
#
# The script never resets local changes or force-pushes. It deploys only a
# fast-forward of origin/<branch>, and restarts PM2 only after install, typecheck,
# build, backup, and migrations all succeed.

set -Eeuo pipefail
IFS=$'\n\t'

APP_DIR="${APP_DIR:-/var/www/html/octamy-certifications}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
PM2_APP="${PM2_APP:-octamy}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/octamy}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
ADOPT_EXISTING_SCHEMA="${ADOPT_EXISTING_SCHEMA:-0}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
PM2_HANDOFF_STARTED=0

timestamp() { date -Iseconds; }
log() { printf '[deploy] %s %s\n' "$(timestamp)" "$*"; }
fail() { printf '[deploy] %s ERROR: %s\n' "$(timestamp)" "$*" >&2; exit 1; }

on_error() {
  local code=$?
  local process_note="The running PM2 process was not changed."
  if [[ "$PM2_HANDOFF_STARTED" == "1" ]]; then
    process_note="PM2 handoff had started; inspect process state and logs before retrying."
  fi
  printf '[deploy] %s FAILED at line %s (exit %s). %s\n' \
    "$(timestamp)" "${BASH_LINENO[0]}" "$code" "$process_note" >&2
  exit "$code"
}
trap on_error ERR

[[ -d "$APP_DIR/.git" ]] || fail "APP_DIR is not a Git checkout: $APP_DIR"
[[ -f "$ENV_FILE" ]] || fail "Missing production environment file: $ENV_FILE"

for command in git node npm pm2 curl flock stat; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command is missing: $command"
done

[[ "$BRANCH" == "main" ]] || fail "Production deployments are restricted to BRANCH=main"
[[ "$SKIP_BACKUP" == "0" || "$SKIP_BACKUP" == "1" ]] || fail "SKIP_BACKUP must be 0 or 1"
[[ "$ADOPT_EXISTING_SCHEMA" == "0" || "$ADOPT_EXISTING_SCHEMA" == "1" ]] || fail "ADOPT_EXISTING_SCHEMA must be 0 or 1"
[[ "$HEALTH_RETRIES" =~ ^[1-9][0-9]*$ ]] || fail "HEALTH_RETRIES must be a positive integer"

if [[ "$SKIP_BACKUP" == "0" ]]; then
  for command in pg_dump gzip sha256sum tail grep awk; do
    command -v "$command" >/dev/null 2>&1 || fail \
      "Required backup command is missing: $command (or set SKIP_BACKUP=1 deliberately)"
  done
fi

# Prevent two deploys from modifying the same checkout concurrently. Keeping
# the lock under .git scopes it to this installation and avoids a shared /tmp
# pathname when the deploy user has more than one application.
exec 9>"$APP_DIR/.git/octamy-deploy.lock"
flock -n 9 || fail "Another deployment is already running for $APP_DIR"

cd "$APP_DIR"

# .env is trusted shell input, must not be a symlink, and must be readable only
# by the dedicated deploy user before it is sourced.
[[ ! -L "$ENV_FILE" ]] || fail "Production environment file must not be a symlink: $ENV_FILE"
env_mode="$(stat -c '%a' "$ENV_FILE")"
[[ "$env_mode" == "600" ]] || fail "Production environment file must have mode 600; found $env_mode"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require_real_value() {
  local name="$1"
  local value="$2"
  local minimum="$3"
  [[ ${#value} -ge $minimum ]] || fail "$name must contain at least $minimum characters"
  case "$value" in
    your_*|YOUR_*|*placeholder*|*PLACEHOLDER*|*example*|*EXAMPLE*|*CHANGE_ME*)
      fail "$name is still a placeholder" ;;
  esac
}

[[ "${NODE_ENV:-}" == "production" ]] || fail "NODE_ENV=production is required in $ENV_FILE"
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required in $ENV_FILE"
jwt_secret="${JWT_SECRET:-}"
session_secret="${SESSION_SECRET:-}"
payment_status_secret="${PAYMENT_STATUS_SECRET:-}"
app_url="${APP_URL:-}"
require_real_value "JWT_SECRET" "$jwt_secret" 24
require_real_value "SESSION_SECRET" "$session_secret" 24
require_real_value "PAYMENT_STATUS_SECRET" "$payment_status_secret" 24
[[ "$payment_status_secret" != "$jwt_secret" ]] || fail "PAYMENT_STATUS_SECRET must be distinct from JWT_SECRET"
[[ "$app_url" =~ ^https://[^[:space:]/]+/?$ ]] || \
  fail "APP_URL must be the canonical HTTPS production origin"
[[ "${AUTO_APPROVE_PROFILES:-}" == "false" ]] || \
  fail "AUTO_APPROVE_PROFILES=false is required for governed production onboarding"

payment_gateway="${PAYMENT_DEFAULT_GATEWAY:-cashfree}"
payment_gateway="${payment_gateway,,}"
case "$payment_gateway" in
  cashfree)
    [[ "${CASHFREE_ENV:-}" == "production" ]] || fail "CASHFREE_ENV=production is required"
    require_real_value "CASHFREE_APP_ID" "${CASHFREE_APP_ID:-}" 3
    require_real_value "CASHFREE_SECRET_KEY" "${CASHFREE_SECRET_KEY:-}" 12
    require_real_value "CASHFREE_WEBHOOK_SECRET" "${CASHFREE_WEBHOOK_SECRET:-}" 12
    ;;
  payu)
    require_real_value "PAYUMONEY_MERCHANT_ID" "${PAYUMONEY_MERCHANT_ID:-}" 2
    require_real_value "PAYUMONEY_MERCHANT_KEY" "${PAYUMONEY_MERCHANT_KEY:-}" 3
    require_real_value "PAYUMONEY_SALT" "${PAYUMONEY_SALT:-}" 8
    ;;
  *) fail "PAYMENT_DEFAULT_GATEWAY must be cashfree or payu" ;;
esac

if [[ -n "${GOOGLE_CLIENT_ID:-}" || -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]] || \
    fail "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together"
  require_real_value "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID" 8
  require_real_value "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET" 8
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( node_major >= 20 )) || fail "Node.js 20 or newer is required; found $(node --version)"

if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  fail "The server working tree has tracked or untracked changes. Commit or intentionally remove them before deploying."
fi

git show-ref --verify --quiet "refs/heads/$BRANCH" || fail "Local branch does not exist: $BRANCH"
current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$BRANCH" ]] || fail "Checkout is on '$current_branch'; expected '$BRANCH'"

OLD_SHA="$(git rev-parse HEAD)"
log "Fetching $REMOTE/$BRANCH (currently ${OLD_SHA:0:12})"
git fetch --prune "$REMOTE" "refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH"
REMOTE_REF="refs/remotes/$REMOTE/$BRANCH"
git rev-parse --verify "${REMOTE_REF}^{commit}" >/dev/null
git merge --ff-only "$REMOTE_REF"
NEW_SHA="$(git rev-parse HEAD)"
export GIT_COMMIT="$NEW_SHA"
log "Release candidate ${OLD_SHA:0:12} -> ${NEW_SHA:0:12}"

log "Installing locked dependencies"
npm ci --include=dev --no-audit --no-fund

log "Running TypeScript validation"
npm run check

log "Building frontend and server"
npm run build
[[ -f dist/index.js ]] || fail "Build completed without dist/index.js"
[[ -f dist/public/index.html ]] || fail "Build completed without dist/public/index.html"

if [[ "$SKIP_BACKUP" == "1" ]]; then
  log "Database backup explicitly skipped (SKIP_BACKUP=1)"
else
  log "Creating pre-migration database backup"
  APP_DIR="$APP_DIR" ENV_FILE="$ENV_FILE" BACKUP_DIR="$BACKUP_DIR" bash scripts/pg-backup.sh
fi

log "Checking database migration history"
APP_DIR="$APP_DIR" ADOPT_EXISTING_SCHEMA="$ADOPT_EXISTING_SCHEMA" node scripts/adopt-drizzle-baseline.mjs

log "Applying pending database migrations"
npm run db:migrate

log "Checking published assessments for substantive content or legal blockers"
log "Administrative release-evidence gaps are reported below as WARNING and do not fail this deployment"
npm run assessments:inventory -- --mode dry-run --format summary --fail-on-unsafe-published

# Drizzle and Vite are development dependencies; remove them only after the
# migration and build have succeeded. They are restored by npm ci next deploy.
log "Pruning development-only packages"
npm prune --omit=dev --no-audit --no-fund --no-package-lock

PM2_HANDOFF_STARTED=1
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  log "Reloading PM2 process '$PM2_APP'"
  pm2 reload "$PM2_APP" --update-env
else
  log "Creating PM2 process '$PM2_APP'"
  pm2 start dist/index.js --name "$PM2_APP" --cwd "$APP_DIR" --time --node-args="--enable-source-maps"
fi

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:${PORT:-5000}/readyz}"
log "Checking readiness at $HEALTHCHECK_URL"
last_health_detail="no successful response"
for ((attempt=1; attempt<=HEALTH_RETRIES; attempt++)); do
  health_body=""
  if health_body="$(curl --fail --silent --max-time 5 \
    -H 'X-Forwarded-Proto: https' "$HEALTHCHECK_URL")"; then
    reported_commit="$(node -e '
      try {
        const body = JSON.parse(process.argv[1]);
        if (body.status === "ready" && body.db?.ok === true && typeof body.commit === "string") {
          process.stdout.write(body.commit);
        }
      } catch {}
    ' "$health_body")"
    if [[ "$reported_commit" != "$NEW_SHA" ]]; then
      last_health_detail="HTTP 2xx but ready commit was '${reported_commit:-missing}'"
      sleep 2
      continue
    fi

    pm2 save
    log "Deployment healthy: ${OLD_SHA:0:12} -> ${NEW_SHA:0:12}"
    pm2 status "$PM2_APP"
    trap - ERR
    exit 0
  fi
  last_health_detail="readiness request failed"
  sleep 2
done

printf '[deploy] %s Readiness failed after %s attempts. Inspecting recent logs:\n' "$(timestamp)" "$HEALTH_RETRIES" >&2
printf '[deploy] %s Last readiness result: %s\n' "$(timestamp)" "$last_health_detail" >&2
pm2 logs "$PM2_APP" --lines 80 --nostream >&2 || true
fail "Release ${NEW_SHA:0:12} did not become ready. Database migrations and application code are not auto-rolled back; investigate before retrying."
