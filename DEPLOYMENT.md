# Octamy production deployment

The supported production path is the guarded Linux + PM2 pipeline in `scripts/deploy-production.sh`. Do not deploy with `db:push`, ad-hoc index creation, Replit/Vercel recipes, or an unreviewed Docker example from an older guide.

## Host and checkout

Provide Node.js 20+, Git, PM2, `curl`, `flock`, `stat`, and PostgreSQL client tools (`pg_dump`, `gzip`, and the other commands checked by the script). Run as a dedicated non-root user that owns the checkout, PM2 process, and backup directory.

The checkout must be on `main`, have no tracked or untracked changes, and be able to fast-forward from the configured remote. `BRANCH` is not a selectable release override: the script rejects every value except `main`.

## Production environment

Keep a trusted, non-symlink `.env` at mode `600`. Start from `.env.example` and replace all placeholders. The deploy preflight requires:

- `NODE_ENV=production`
- `DATABASE_URL`
- distinct `JWT_SECRET`, `SESSION_SECRET`, and `PAYMENT_STATUS_SECRET` values of at least 24 characters
- canonical HTTPS `APP_URL`
- `AUTO_APPROVE_PROFILES=false`
- `PAYMENT_DEFAULT_GATEWAY=cashfree` plus `CASHFREE_ENV=production`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and `CASHFREE_WEBHOOK_SECRET`; or `PAYMENT_DEFAULT_GATEWAY=payu` plus all three PayU credentials

If either Google credential is set, both must be real values.

## Deploy

```bash
cd /var/www/html/octamy-certifications
APP_DIR="$PWD" ./scripts/deploy-production.sh
```

Useful overrides include `REMOTE`, `PM2_APP`, `ENV_FILE`, `BACKUP_DIR`, `HEALTHCHECK_URL`, and `HEALTH_RETRIES`. `SKIP_BACKUP=1` is an explicit emergency escape hatch only when a verified provider snapshot exists. `ADOPT_EXISTING_SCHEMA=1` is a one-time, guarded path for a confirmed legacy Octamy schema; never use it for an unrelated or partial database.

The script locks the checkout, validates secrets and Git state, fast-forwards `main`, installs the lockfile, type-checks, builds, creates and verifies a pre-migration dump, applies committed migrations, and runs the read-only governed-assessment release gate. Assessment, taxonomy, question-bank, pricing, and Interview Studio catalog data remain database-managed; deployment never overwrites those records from application files. The gate exits nonzero if any active/public/approved assessment has runtime release blockers. Only then are development dependencies pruned and PM2 reloaded. `/readyz` must report a working database, healthy evaluation queue, and the exact deployed commit before PM2 state is saved.

## Backup and rollback

Backups default to 14-day retention. Copy them to encrypted off-host storage and regularly prove restoration into a separate recovery database. Deployments do not auto-roll back migrations. On failure, preserve the release and pre-migration dump, inspect `pm2 logs octamy`, and prefer a forward fix. Revert an application revision only after confirming schema compatibility; database restoration requires a maintenance window, stopped writes, another incident snapshot, and a validated compatible dump.
