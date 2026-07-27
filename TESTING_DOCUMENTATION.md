# Testing Octamy

## Safety first

`tests/setup.ts` forces `NODE_ENV=test`. Database-backed suites require `TEST_DATABASE_URL`, repoint the application database singleton to that URL, and truncate every public table before/after tests. They never fall back to the development `DATABASE_URL`. Use a separate disposable database only.

Pure unit/contract tests can run without PostgreSQL; the setup supplies an intentionally unreachable placeholder URL so imports cannot accidentally reach a developer database.

## Commands

The root package currently exposes:

```bash
npm test                 # Jest; pass additional Jest arguments after --
npm run check            # TypeScript
npm run build            # Vite client + bundled server
```

Examples:

```bash
npm test -- --runInBand tests/unit/cashfree-status-token.test.ts
TEST_DATABASE_URL=postgresql://... npm test -- --runInBand tests/integration/api.test.ts
```

There are no root `test:unit`, `test:integration`, `test:coverage`, `type-check`, or lint scripts in `package.json`; invoke Jest paths/flags directly and use `npm run check`.

The mobile package has its own validation:

```bash
cd mobile
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

## Current coverage areas

The repository includes focused unit and integration coverage for authentication/password policy; catalog and assessment publication safety; blueprint inventory and scoring; exam timing/recovery; certificates and activation policy; Cashfree status tokens/webhook boundaries; commerce regressions; recruiter consent/evidence grants; proctor-event limits; Interview Studio privacy/evaluation; media permissions; question-pack contracts/import/review; migrations; and mobile learner/payment/privacy flows.

Test existence is not proof of a fixed percentage, endpoint count, production readiness, CSRF coverage, load testing, or store acceptance. No coverage threshold is configured in `package.json`, and deployment does not claim a percentage. Run the targeted tests for changed behavior plus `npm run check` and `npm run build`; use the full suite when a disposable database and external-service isolation are available.

## Assessment release checks

The governed inventory is a read-only operational gate, not a test fixture or publication command:

```bash
npm run assessments:inventory -- --mode dry-run --format summary
npm run assessments:inventory -- --mode dry-run --format summary --fail-on-unsafe-published
```

The second command exits nonzero when an active/public/approved assessment has strict release blockers. It does not approve, import, publish, migrate, or mutate data.
