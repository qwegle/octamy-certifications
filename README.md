# Octamy Professional Certification Platform

## Overview

Octamy is a multi-tenant EdTech SaaS platform for the complete digital journey **Learn → Validate → Certify → Get recruited**. Learners build a consent-controlled Skill Evidence Passport; creators and institutes publish courses and assessments; KYC-approved recruiters discover opted-in candidates and request selected evidence rather than relying only on self-reported claims.

## Architecture

### MVC Structure
The application follows a clean MVC (Model-View-Controller) architecture:

```
server/
├── controllers/         # Modular request handlers
├── middleware/          # Authentication and authorization
├── routes/              # Domain route modules
├── lib/                 # Policy, payment, assessment, and security logic
├── utils/               # Delivery and document utilities
├── routes.ts            # Legacy/direct routes and composition
└── storage.ts           # Drizzle-backed storage interface
shared/schema.ts         # Shared Drizzle schema
```

### Database Schema
- **Users**: Authentication and profile management
- **Categories**: Course categorization (AI, Development, Business, Internships)
- **Courses**: Course metadata with pricing and passing scores
- **Questions**: Multiple-choice questions with correct answers
- **Exam Attempts**: User exam submissions with scoring
- **Certificates**: Generated certificates with verification
- **Payments**: Cashfree and PayU reservations, callbacks, status polling, and fulfillment records
- **Sellers**: Partner/affiliate system with commission tracking

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **Tailwind CSS** with shadcn/ui components
- **Vite** for development and production builds

### Backend
- **Node.js** with Express.js framework
- **TypeScript** with ES modules
- **PostgreSQL** with Drizzle ORM
- **JWT** authentication with bcrypt password hashing
- **Cashfree and PayU** payment integrations with server-side confirmation

## Setup Instructions

### Prerequisites
- Node.js 20+
- PostgreSQL database
- A disposable PostgreSQL database for tests
- Cashfree or PayU credentials only when testing paid flows

### Environment Variables
Copy `.env.example` to `.env`, then replace every placeholder. At minimum for local development configure:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/octamy

# JWT Secret
JWT_SECRET=use-a-long-random-development-secret
SESSION_SECRET=use-a-different-long-random-development-secret

# Public origin; Google callback URLs must use this exact origin
PORT=8080
APP_URL=http://localhost:8080
```

Google sign-in additionally requires `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. Register both callback URLs documented in
`.env.example`. Keep real credentials only in `.env`; it is ignored by Git.

AI-assisted course drafting is optional. Configure a server-side OpenAI key to
enable it for authenticated creator and institute workspaces:

```env
OPENAI_API_KEY=your-real-server-side-key
OPENAI_MODEL=gpt-5-mini
```

Never expose the key through a `VITE_` variable or commit it. With no usable
key, the copilot reports that it is unavailable and manual course creation
continues to work. Generated blueprints require human review and do not save,
publish, set pricing, or change visibility automatically.

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd octamy-platform
```

2. **Configure the environment**
```bash
cp .env.example .env
# Edit .env and create the PostgreSQL database/user referenced by DATABASE_URL.
```

3. **Install locked dependencies and apply migrations**
```bash
npm ci
npm run db:migrate
```

4. **Start development server**
```bash
npm run dev
```

The application is available at the `APP_URL` in `.env`. Development startup
runs the baseline seed only when categories are absent and requires a private
`ADMIN_PASSWORD`; the repository provides no default login password.

## Development

### Database Operations
```bash
# Generate a reviewed migration after changing shared/schema.ts
npm run db:generate

# Apply committed migrations
npm run db:migrate

# Validate TypeScript and the production bundle
npm run check
npm run build
```

Tests intentionally refuse to use `DATABASE_URL` because they truncate data.
Point `TEST_DATABASE_URL` at a separate disposable database before running
`npm test`.

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

#### Courses
- `GET /api/categories` - Get all categories
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get specific course
- `GET /api/courses/category/:categoryId` - Get courses by category

#### Exams
- `POST /api/exam/submit` - Submit exam attempt
- `GET /api/exam/results/:id` - Get exam results

#### Certificates
- `POST /api/certificates/create` - Create certificate
- `GET /api/certificates/:id/download` - Download certificate
- `GET /api/certificates/verify/:certificateId` - Verify certificate

#### Payments
- `POST /api/payment/initiate` - Initiate payment
- `POST /api/payment/success` - Payment success callback
- `POST /api/payment/failure` - Payment failure callback

## Features

### Core Features
- **Multi-workspace SaaS**: learner, creator, institute, recruiter, partner, and platform-admin workspaces with role-aware access
- **Courses and assessments**: video/PDF/text curricula, reusable media, question banks, timed exams, and network-safe attempt recovery
- **Assessment integrity evidence**: consented, bounded browser events and institute result workspaces; this is not webcam recording, biometric identity proof, AI cheating detection, or a guarantee of misconduct detection
- **Dual-branded credentials**: Octamy verification plus institute branding, QR verification, and evidence-backed certificate tiers
- **Recruiter discovery**: verified-company search, explicit learner/institute sharing consent, auditable profile unlocks, and transactional credits

### Advanced Features
- **Skill Evidence Passport (USP)**: portable proof connecting identity, scored attempts, credentials, integrity evidence, and consent state
- **Review-first AI course copilot**: structured course details, learning outcomes, modules, lessons, and assessment ideas for creator and institute workspaces without automatic publishing
- **Creator/institute commerce**: separate content-access and credential prices, attributable seller codes, earnings, payouts, and configurable platform splits
- **WordPress-style media library**: upload once, inspect metadata/link details, reuse, and delete owned assets
- **Traceable online workflows**: course delivery, assessments, results, digital credential issuance, sharing, verification, and optional physical-copy requests retain auditable server state

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **OAuth integrity**: short-lived, HttpOnly, same-site state cookies and fragment-based token handoff
- **Tenant authorization**: owner/admin/teacher/staff permissions enforced by backend ownership checks
- **Payment integrity**: provider signature/hash and amount checks; transactional idempotency for credential activation; token-bound, non-fulfilling status reads; and auditable credit ledgers
- **Operational safeguards**: rate limits, CSP/security headers, audit events, health probes, backup-before-migrate deployment, and PM2 readiness verification

## Deployment

### Production Build
```bash
# Build frontend assets
npm run build

# Start production server
npm start
```

### One-command PM2 deployment

The deployment target is a Linux server running Node.js 20+, Git, PM2, `curl`,
`flock`, and PostgreSQL client tools (`pg_dump` plus `gzip`). Run deployments as
a dedicated, non-root application user that owns the checkout and PM2 process.
The user must also be able to create files in the configured backup directory.

Keep the checkout on `main` with no tracked or untracked working-tree changes.
Store a trusted, shell-compatible production `.env` in the application
directory and set its mode to `600`. The preflight requires `NODE_ENV=production`,
`DATABASE_URL`, canonical HTTPS `APP_URL`, distinct `JWT_SECRET`, `SESSION_SECRET`
and `PAYMENT_STATUS_SECRET` values, `AUTO_APPROVE_PROFILES=false`, and the full
credential set for `PAYMENT_DEFAULT_GATEWAY`. Review `.env.example` for OAuth,
media-storage, mail, CORS, and optional settings.

From the checkout, run:

```bash
cd /var/www/html/octamy-certifications
APP_DIR="$PWD" ./scripts/deploy-production.sh
```

The script acquires a per-checkout lock and refuses a dirty tree, the wrong
branch, a non-fast-forward Git update, or missing production secrets. It then:

1. fetches the configured remote's `main` branch with an explicit ref and fast-forwards;
2. installs the exact lockfile including build tools, type-checks, and builds;
3. creates and verifies an atomic, timestamped Postgres dump;
4. applies all pending Drizzle migrations and runs the read-only governed-assessment
   release gate without overwriting database-managed catalog data;
5. fails if any active/public/approved assessment has strict release blockers,
   then prunes development dependencies;
6. reloads (or creates) the PM2 process with the new environment; and
7. accepts the release only when `/readyz` reports a working database and the
   exact Git commit just deployed, then saves the PM2 process list.

Assessment names, categories, subcategories, question banks, pricing, and
Interview Studio templates are production database records. Historical import
utilities are not release commands, and production deployment never seeds or
synchronizes a code-defined catalogue.

Production deployment is restricted to `main`; setting `BRANCH` to any other
value fails. Useful overrides are `REMOTE`, `PM2_APP`, `ENV_FILE`, `BACKUP_DIR`,
`HEALTHCHECK_URL`, and `HEALTH_RETRIES`. `SKIP_BACKUP=1` is an explicit emergency
escape hatch; use it only when a verified provider snapshot already exists. On
first server setup, configure PM2 startup persistence separately using the
command printed by `pm2 startup`, then run one successful deployment.

Older Octamy databases created before the Drizzle migration journal may contain
application tables but no migration history. The deploy script deliberately
stops in that situation. After verifying the pre-migration backup and confirming
that the database is the existing Octamy schema, run the deployment once with
`ADOPT_EXISTING_SCHEMA=1`. A conservative preflight checks every baseline table
and critical column before recording only migration `0000`; migrations `0001`
onward then execute normally. Never use this flag for an unrelated or partially
restored database.

The first production installation used one known hand-authored `baseline`
checkpoint after applying both `0000` and `0001`. The preflight recognizes only
that exact marker and normalizes it to canonical Drizzle hashes and timestamps
after rechecking the baseline schema and every `0001` index. Any other
noncanonical migration history is rejected by the verified migration runner.

### Backup and rollback policy

`scripts/pg-backup.sh` keeps 14 days of uniquely named gzip SQL dumps by default.
Override this with `RETENTION_DAYS` and copy backups to encrypted off-host
storage; same-server files are not disaster recovery. Schedule the script with
cron if provider-managed backups are not already enabled, and regularly prove
that a dump restores into a separate recovery database.

Deployments intentionally do not auto-roll back database migrations. If a
readiness check fails, inspect `pm2 logs octamy`, preserve the failed release
and pre-migration dump, and prefer a forward fix. The checkout and build files
may already contain the new release even if PM2 was not reloaded, so do not
blindly restart the process after an earlier deployment step fails.

For an application rollback, revert the release commit in the upstream Git
branch and rerun this script only after confirming that the migrated schema is
backward-compatible. If the schema must be restored, enter a maintenance window,
stop all writes, take an additional incident snapshot, validate the pre-migration
dump in a recovery database, and restore it together with a compatible
application revision. Database restoration is a deliberate operator action,
not part of this deploy command.

### Environment Configuration
Ensure all environment variables are set in production:
- Database connection string
- JWT secret key
- Canonical `APP_URL` (for example `https://octamy.com`)
- Google OAuth web client ID and secret, with the user and seller callback URLs from `.env.example`
- Cashfree or PayU credentials for the gateway enabled in production
- SSL certificates for HTTPS

### Governed assessment release state

The deploy pipeline runs `assessments:inventory` in a PostgreSQL read-only,
repeatable-read transaction with `--fail-on-unsafe-published`. It reports
blockers without mutating data and fails the release when any assessment is
simultaneously active, public, approved, and not strict-release-ready.
Migration `0033_unpublish_audited_blocked_assessments.sql` conservatively moves
the specifically audited blocked Practice shells to inactive/private/pending;
it preserves questions, provenance, attempts, payments, and learner records.

Source-controlled packs and review records under `content/question-packs/` are
release candidates, not proof that production questions are approved. An
authorized operator must register rights evidence and import a candidate; the
import remains pending/inactive. Every exact imported item version then needs
attributable independent review, followed by guarded bank activation,
blueprint/acceptance checks, and separate publication. Do not describe all
questions—or a whole pack—as approved merely because files or review notes
exist in Git.

### Product differentiation

Octamy's core promise is the **Skill Evidence Passport**: a portable record that
connects a learner's identity, scored assessment, credential tier, and live QR
verification. Courses may prepare a learner, but the passport is the durable,
inspectable proof that institutions and hiring teams can trust.

## Common Issues & Solutions

### Local Development Issues

1. **Import.meta.url Error**
```bash
# If you encounter import.meta.url issues, ensure Node.js 20+ is installed
node --version
```

2. **Database Connection Issues**
```bash
# Check that the configured role can reach the configured database
psql "$DATABASE_URL" -c 'select current_user, current_database();'
```

3. **Environment Variables Not Loading**
```bash
# Ensure .env file is in root directory
# Verify dotenv configuration in vite.config.ts
```

4. **Port Conflicts**
```bash
# APP_URL must change with PORT, especially for Google OAuth.
PORT=8081 APP_URL=http://localhost:8081 npm run dev
```

## API Documentation

### Authentication Flow
1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. JWT token returned and stored in localStorage
3. Token included in Authorization header for protected routes
4. Middleware validates token and adds user to request object

### Payment flow
1. The server validates authoritative product/assessment state and reserves a checkout.
2. Cashfree or PayU opens from server-generated gateway data; Cashfree responses include a short-lived status token.
3. Browser returns and status polling report local state only and never fulfill an order.
4. Cashfree fulfillment requires a timestamp-bound signed webhook; PayU requires a valid reverse hash plus matching transaction and amount.
5. Eligible credential activation completes the credential and payment atomically; duplicate activation is detected.

### Certificate Generation
1. User completes exam with passing score
2. Certificate data validated and stored
3. PDF generated with professional styling
4. Verification code created for public verification
5. Certificate available for download and verification

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or questions:
- Email: support@octamy.com
- Documentation: [Internal Wiki]
- Issues: [GitHub Issues]

---

**Note**: This platform is designed for professional certification and assessment. Ensure all content and assessments meet industry standards and regulatory requirements.
