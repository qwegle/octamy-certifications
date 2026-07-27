# Octamy development notes

Octamy is a React/TypeScript + Express + PostgreSQL platform with learner, creator, institute, recruiter, seller, and admin workspaces. This file contains current operational notes only; historical Replit implementation claims and credentials were removed because they were not a release contract.

## Run

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run dev
```

Use `/healthz` for liveness and `/readyz` for readiness. Authentication validates persisted bcrypt credentials; this repository publishes no working user/admin password. For a local-only admin, choose private `ADMIN_EMAIL`/`ADMIN_PASSWORD` values and run `npm run admin:bootstrap-local`.

## Verified capability boundaries

- Payments support Cashfree and PayU. Client returns/status reads never fulfill orders; verified provider callbacks do. Cashfree status polling uses short-lived signed tokens, and Practice Pass entitlement comes from `/api/me/subscription`.
- Browser-evidence exams collect bounded consented integrity events. This is not AI cheating detection, biometric identity verification, or video proctoring.
- Interview Studio is private practice. Verified mode, server-side video recording/upload, and recruiter sharing are disabled; transient voice audio is deleted after transcription.
- Recruiter search requires active KYC approval and explicit discovery consent. Search/profile unlocks do not reveal certificate evidence; selected evidence requires a separate expiring, revocable learner grant.
- Assessment packs under `content/` are source-controlled candidates. Registration/import does not approve or publish them; exact-version independent review and guarded release gates are required.
- The active Expo learner project is `mobile/`. `octamy-mobile/` is retired.

## Validate

```bash
npm run check
npm run build
TEST_DATABASE_URL=postgresql://... npm test
```

`TEST_DATABASE_URL` must be a separate disposable database because database suites truncate all public tables. Production deployment is main-only through `scripts/deploy-production.sh`; see `DEPLOYMENT.md`.
