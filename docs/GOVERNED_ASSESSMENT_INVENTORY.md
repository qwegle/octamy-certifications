# Governed assessment inventory

`npm run --silent assessments:inventory -- --format summary` evaluates the configured
database snapshot against `ASSESSMENT_CONTENT_SCALE_PROGRAM.md`. It does not
publish, approve, import, migrate, seed, or update anything.

## Safety contract

- The only accepted mode is `--mode dry-run` (the default). Any other mode fails
  with `READ_ONLY_ONLY`.
- Every database read runs in one PostgreSQL `REPEATABLE READ READ ONLY`
  transaction with statement and lock timeouts.
- The CLI contains only inventory `SELECT` statements. It exposes no mutation,
  approval, publication, or migration option and writes the report to stdout.
- Prefer a least-privilege read-only database role through
  `ASSESSMENT_INVENTORY_DATABASE_URL`. `DATABASE_URL` is accepted for local
  compatibility, but PostgreSQL transaction enforcement still remains active.
- Reports label their scope `configured_database_snapshot` and production status
  `not_asserted`. A local/staging report must never be described as production.

Before reading assessment content, the CLI inventories required tables and
columns through `information_schema`. If the configured snapshot is behind the
repository schema, it does not migrate or infer missing values. It emits exact
`schema.gaps`, lists assessment shells when the legacy columns allow that, and
blocks each one with `GOVERNANCE_SCHEMA_INCOMPLETE`.

JSON is the default machine-readable output. Use `--format summary` for an
operator view, and repeat `--assessment <slug>` to limit the snapshot:

```bash
npm run --silent assessments:inventory -- --format json > /tmp/assessment-inventory.json
npm run --silent assessments:inventory -- --format summary \
  --assessment grade-3-mathematics-practice
```

The shell redirection above writes only a local report file; it does not alter
the database. Unknown options such as `--publish`, `--apply`, or `--mutate` are
rejected.

## Deployment gate and current quarantine

`scripts/deploy-production.sh` runs the same read-only inventory after migrations:

```bash
npm run assessments:inventory -- --mode dry-run --format summary --fail-on-unsafe-published
```

The flag exits nonzero when `unsafePublished > 0`, meaning an assessment is
active, public and approved while strict release blockers remain. The gate does
not repair or unpublish data. Migration
`0033_unpublish_audited_blocked_assessments.sql` separately and idempotently
moved the 11 audited blocked Practice shells to inactive/private/pending while
preserving questions, provenance, attempts, payments and learner records.

## Source-controlled candidates are not production approval

Reviewed artifacts under `content/question-packs/` are candidates for governed
intake. Their manifests and review notes may establish authorship, scope or
candidate-level review, but they do not prove that production rows are imported,
approved, active or published. An authorized operator must register exact rights
evidence and import the JSONL; import creates pending/inactive rows. Each exact
database item version must then receive attributable independent review through
the governed workflow. Bank activation, blueprint reconciliation, acceptance
checks and publication are additional separate acts. Never report all questions
as approved from a filename, manifest, generated metadata or review document.

## What the report proves

For each assessment, the report checks and groups exact blocker codes with
occurrence counts and all affected question, bank, and source IDs:

- a versioned blueprint exists and has at least one rule;
- every bank is active, has a syllabus version, and matches the assessment's
  `certification` or `practice` purpose;
- certification inventory meets `max(80, draw x 4)` and Practice inventory
  meets `max(200, draw x 5)`, including each blueprint scope;
- item author and content reviewer are attributable and different;
- the exact active item version is approved, timestamped, hashed, attested, has
  rationale/distractor/factual validation, and is runtime-compatible;
- each item has source-register provenance whose current content hash matches;
- every linked source has verified commercial/derivative rights, reviewer/time,
  acquiring legal entity, exact evidence reference, and evidence SHA-256;
- edited items retain immutable version history; and
- question/option media carry alt text where the current schema represents it.

`runtimePublishReady` reports whether the existing runtime bank/content gates
pass. `releaseReady` is stricter and implements the full governed program.
`unsafePublished` means a row is currently active/public/approved while the
strict inventory still has blockers; it does not mutate that row.

## Fail-closed representation gaps

The current schema does **not** represent all evidence required by the scale
program. Therefore the inventory emits blockers rather than inferring approval:

- `RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE`: source rights reviewers are free-text
  values, so their separation from attributable item authors/content reviewers
  cannot be system-verified.
- `ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED`: media alt text exists,
  but there is no assessment-level accessibility reviewer acceptance record.
- `IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED`: there is no immutable record for
  simulated forms, standard setting/cut-score approval, representative attempt
  QA, publisher sign-off, release commit/time, rollback ownership, and takedown.

Consequently, a row may pass current runtime publication checks while still be
blocked for governed release. Do not remove or downgrade these blockers based
on a review document, ticket, filename, generated content, or operator claim.
A future reviewed migration and guarded single-assessment release workflow must
store attributable evidence before the inventory can treat those gates as
represented. This tool deliberately does not create that migration or evidence.

## Operator runbook: candidate pack to publishable assessment

Verified state on 2026-07-27 in the development snapshot: 100,040 stored
questions, **0 approved**, and no active/public assessment. Nothing in
`content/` is approved by virtue of being committed. Every step below is
explicitly attributable, defaults to dry-run, and refuses to self-approve.

Run from the checkout with `DATABASE_URL` pointing at the target database.

```bash
# 1. Register exact rights evidence for the pack's source (rights reviewer).
npm run questions:register-source -- \
  --manifest content/career-question-banks/<pack>/manifest.json \
  --evidence-file <local-rights-proof-file> \
  --acquiring-entity "<legal entity>" \
  --operator "<rights reviewer name>" --confirm-rights

# 2. Plan the import; omit --commit to mutate nothing.
npm run questions:import -- \
  --file content/career-question-banks/<pack>/questions.jsonl \
  --source <registered-source-key> --bank <admin-bank-slug> \
  --operator "<import operator>" --author-user-id <author user id>
# Re-run with --commit once the plan is accepted. Imported items stay
# pending and inactive; import never approves or publishes.

# 3. Record attributable independent review. The reviewer must be a human
#    who read each item, and must not be the author. Each decision carries
#    the exact content hash, expected version, and an item-specific note.
npm run questions:review -- \
  --source <registered-source-key> --bank <admin-bank-slug> \
  --decisions <reviewer-decisions.jsonl> \
  --reviewer-user-id <reviewer user id> \
  --operator "<content reviewer name>" --apply --confirm-reviewed
```

Only after step 3 approves enough items may an authorized admin activate the
bank, wire the blueprint quotas, and publish the assessment through the
governed admin workflow. Publication is still refused while any strict
release blocker remains, and `scripts/deploy-production.sh` fails the release
when a published assessment has blockers.

Do not generate reviewer decisions programmatically, reuse the author as
reviewer, or edit `content/` review metadata to make the gate pass. Doing so
produces an unreviewed exam that only appears approved.
