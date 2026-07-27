# Octamy quick start

## Web platform

Requirements: Node.js 20+, PostgreSQL, npm, and Git.

```bash
git clone <repository-url>
cd octamy-certifications
npm ci
cp .env.example .env
```

Create the development database named in `DATABASE_URL`. Replace every secret placeholder in `.env`; on a fresh database, set a strong, private `ADMIN_PASSWORD` (12+ characters) because development startup creates the configured admin without any default password.

```bash
npm run db:migrate
npm run dev
```

Open the exact `APP_URL` configured in `.env`. Health probes are `GET /healthz` and `GET /readyz` (not `/api/health`). Development startup seeds the baseline catalog only when categories are absent.

Authentication is real database authentication. Register through the UI or `POST /api/auth/register` using a unique email and a password of 8–128 characters containing letters and at least one number or symbol. Login succeeds only for an existing account with the matching password. No demo, partner, test, or admin password is published by this repository.

For a local-only admin, choose private values in `.env`, then run:

```bash
npm run admin:bootstrap-local
```

The command refuses production and non-local database hosts.

## Current mobile app

`octamy-mobile/` is retired. The supported Expo SDK 57 learner app is `mobile/`:

```bash
cd mobile
npm ci
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to the server origin, without /api.
npm start
```

Use a development/EAS build for SQLCipher, camera, microphone, and complete native validation; Expo Go is not the release runtime. See `mobile/README.md` and `mobile/docs/API-CONTRACT.md` for capabilities and backend limitations.

## Validate

```bash
npm run check
npm run build
# TEST_DATABASE_URL must name a separate disposable database:
npm test

cd mobile
npm run typecheck
npm test
npx expo-doctor
```

Tests never fall back to the development `DATABASE_URL` for destructive database suites. Paid flows additionally require configured sandbox gateway credentials. Production deployments must use `scripts/deploy-production.sh`; see `DEPLOYMENT.md`.
