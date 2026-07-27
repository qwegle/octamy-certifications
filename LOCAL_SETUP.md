# Local development setup

## Requirements

- Node.js 20 or newer
- PostgreSQL
- npm and Git
- A separate disposable PostgreSQL database if database-backed tests will run

## Install and configure

```bash
git clone <repository-url>
cd octamy-certifications
npm ci
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, long distinct `JWT_SECRET` and `SESSION_SECRET` values, `APP_URL` matching `PORT`, and a private `ADMIN_PASSWORD` of at least 12 characters for first development startup. Leave `AUTO_APPROVE_PROFILES=false`. Gateway credentials are needed only for paid-flow testing; use Cashfree sandbox credentials with `CASHFREE_ENV=sandbox` or PayU test credentials.

Apply committed migrations—do not use `db:push` as the normal setup or deployment path:

```bash
npm run db:migrate
npm run dev
```

The server exposes `/healthz` and database-aware `/readyz`. In development it runs the baseline seed only when categories are absent. The seed has no default password and refuses to create the initial admin without `ADMIN_PASSWORD`.

To create/update a local admin explicitly:

```bash
npm run admin:bootstrap-local
```

This command refuses `NODE_ENV=production` and non-local database hosts.

## Authentication

Use the registration UI or `POST /api/auth/register` with `{name,email,password}`. Passwords must be 8–128 characters with letters and at least one number or symbol. Login validates a stored bcrypt hash; arbitrary credentials do not work. Google sign-in requires both Google environment values and the exact callback origins documented in `.env.example`.

## Mobile

The active Expo app is `mobile/`; `octamy-mobile/` is retired.

```bash
cd mobile
npm ci
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:5000 (or a device-reachable origin)
npm start
```

Never place secrets in `EXPO_PUBLIC_*`. Use a development/EAS build for full native validation. Consult `mobile/README.md` for release limitations.

## Database changes and validation

```bash
# After changing shared/schema.ts, generate and review a migration:
npm run db:generate
npm run db:migrate

npm run check
npm run build
```

For tests, create a separate disposable database and set only `TEST_DATABASE_URL` to it:

```bash
TEST_DATABASE_URL=postgresql://... npm test
```

Database suites truncate every public table. They fail rather than using `DATABASE_URL` when `TEST_DATABASE_URL` is absent. See `TESTING_DOCUMENTATION.md`.
