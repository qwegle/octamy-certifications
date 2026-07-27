# Octamy API reference

This is a concise integration index, not an exhaustive generated specification. The learner-mobile contract in `mobile/docs/API-CONTRACT.md` records the currently verified request/response shapes and explicit backend limitations. Unknown `/api/*` routes return `404 {"message":"API route not found"}`.

## Origin and authentication

Use the server origin plus `/api`. Learner routes accept `Authorization: Bearer <JWT>` where documented.

- `POST /api/auth/register` (also `/api/register`): `{name,email,password,phone?}`. Passwords must be 8–128 characters with letters and at least one number or symbol.
- `POST /api/auth/login` (also `/api/login`): validates an existing password-backed account. Arbitrary credentials never authenticate.
- `GET /api/auth/me`, `GET /api/auth/user`, or `GET /api/user`: current learner.
- `POST /api/auth/logout`: acknowledgment only; the client must delete its JWT. There is no refresh-token or server-side learner-session revocation contract.

Recruiter tokens are separate and cannot substitute for learner JWTs.

## Catalog, attempts, and credentials

Public catalog routes include `/api/categories`, `/api/courses`, `/api/assessments`, and `/api/practice-assessments`. Published assessment attempts start at `POST /api/courses/:id/questions` with explicit evidence consent and submit at `POST /api/exam/submit`. Correct answers are withheld at start. There is no active-session GET or answer-progress-save endpoint; final submission is retry-safe only with the same server-issued `sessionId`.

Credential routes are under `/api/certificates`. Practice assessments do not issue credentials. Public verification and display responses are narrower than internal records; consult the mobile contract before integrating.

Browser-evidence proctoring records a bounded consented event allowlist. It is not webcam recording, biometric identity proof, AI cheating detection, or a guarantee that misconduct did not occur.

## Payment trust boundary

Client navigation, gateway return URLs, and status polling never fulfill purchases. Cashfree fulfillment requires a timestamp-bound verified webhook signature and reservation/amount checks; PayU fulfillment requires a valid reverse hash plus matching transaction and amount. Credential activation is completed with the payment in one database transaction and duplicate activation is detected.

Cashfree checkout responses include a short-lived `statusToken`. Public polling calls require that exact token as `?token=...`, are rate-limited and no-store, read matching local reservation fields without exposing provider payloads, and do not call the provider or mutate fulfillment:

- `GET /api/payments/cashfree/:orderId/status?token=<statusToken>`
- `GET /api/payment/status/:transactionId?token=<statusToken>`

Practice Pass checkout is `POST /api/subscriptions/checkout`; it returns `orderId`, `statusToken`, Cashfree session/link data, subscription ID, amount, and currency. `GET /api/subscriptions/orders/:orderId/status` requires the learner JWT and returns only that user's local reservation. `GET /api/me/subscription` is the authoritative entitlement read. The current Practice Pass is a Cashfree one-off order with renewal tracked by dates, not an Apple/Google or automatic recurring subscription.

## Recruiter evidence

Discovery requires an active KYC-approved recruiter plus learner and, where applicable, institute discovery consent. A profile/CV unlock does not disclose credential evidence. Evidence disclosure requires a separate purpose-bound, expiring, revocable grant selecting eligible items for that exact recruiter; accesses are no-store and audited. Interview Studio, answers, raw integrity events, and local recordings are excluded.

## Health

- `GET /healthz`: process liveness
- `GET /readyz`: database, evaluation-queue, environment, gateway, and deployed-commit readiness
