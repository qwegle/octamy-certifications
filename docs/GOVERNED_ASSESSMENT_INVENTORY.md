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

## Deployment gate and blocker classification

`scripts/deploy-production.sh` runs the same read-only inventory after migrations:

```bash
npm run assessments:inventory -- --mode dry-run --format summary --fail-on-unsafe-published
```

`--fail-on-unsafe-published` exits nonzero only when a currently
active/public/approved assessment has at least one `SUBSTANTIVE` blocker. The
summary separately prints `release-ready`, `blocked`,
`published-with-substantive-blockers`, and
`published-missing-release-evidence`; the last count is a clearly labelled,
non-blocking warning in deployment. Use `--require-release-evidence` when an
operator intentionally wants both substantive blockers and administrative
evidence gaps to fail a strict run; that option implies the substantive gate. The gate never repairs, publishes, or unpublishes data.

Every blocker has exactly one `blockerSeverity` in JSON and beside its code in
the summary:

| Classification | Blocker codes |
| --- | --- |
| `RELEASE_EVIDENCE` | `BLUEPRINT_REVISION_REQUIRED`, `ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED`, `IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED`, `RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE` (the source rights are registered but the attributable current-revision reviewer record is absent/incomplete) |
| `SUBSTANTIVE` | All content, answer, explanation, review, approval, inventory, blueprint availability/draw/scope, syllabus, provenance, source-rights/legal-entity, media accessibility, immutable item-version, bank/runtime, schema-integrity, and actual `RIGHTS_ROLE_SEPARATION_VIOLATED` blockers |

This classification is exhaustive and fail-closed: an unknown future blocker
code aborts inventory rather than defaulting to administrative evidence.
`releaseReady` remains strict and is false for either classification. Thus
administrative release-evidence gaps remain visible and prevent the strict
standard from being claimed, but do not block unrelated deployments.

Migration `0033_unpublish_audited_blocked_assessments.sql` separately and
idempotently moved the 11 audited blocked Practice shells to
inactive/private/pending while preserving questions, provenance, attempts,
payments and learner records.

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
pass. `releaseReady` is the strict standard and requires both substantive
integrity and all administrative release evidence. `unsafePublished` means a
row is currently active/public/approved and has at least one `SUBSTANTIVE`
content or legal blocker. `publishedMissingReleaseEvidence` separately marks a
published row with one or more `RELEASE_EVIDENCE` blockers; it does not by itself
make the row `unsafePublished`. None of these fields mutate the row.

## Attributable release evidence

Migration `0035_governed_assessment_release_evidence.sql` represents the three
strict release gates that previously had no storage model. Evidence is bound to
the exact `(assessment_id, blueprint_revision)` and is append-only; a changed
blueprint or evidence set requires a new revision rather than an update.

- `RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE` is `RELEASE_EVIDENCE` and clears
  when every in-scope source has an attributable current-revision
  `assessment_rights_role_reviews` row whose reference and SHA-256 exactly
  match the source register.
- `RIGHTS_ROLE_SEPARATION_VIOLATED` is `SUBSTANTIVE` and is emitted when a
  recorded rights reviewer actually overlaps item authorship, content review,
  accessibility, cut-score approval, QA, or publishing. Missing documentation
  is not represented as a proven legal-role conflict.
- `ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED` clears only for a
  current-revision acceptance with an attributable independent reviewer,
  named standard, exact evidence reference, SHA-256, and acceptance time.
- `IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED` clears only for a current-revision
  immutable bundle whose content-manifest digest matches the exact scoped item
  IDs, versions, content/provenance hashes, and blueprint rules. It also requires
  hashed form simulation, authoritative cut score and approval, hashed release
  QA, distinct content/cut-score/QA/publisher users, sign-off timestamps, release
  commit/time, rollback owner, and a hashed takedown procedure.

Partial, stale-revision, mismatched, free-text-only, ticket-only, or
filename-only administrative claims remain `RELEASE_EVIDENCE` blockers and keep
`releaseReady` false. Self-approval or prohibited role overlap is a substantive
violation. Source rights, acquiring entity, evidence hash, provenance, and
commercial/derivative permission gaps are always substantive. The deployment
value `unsafePublished` is therefore narrower than strict `releaseReady` by
design; `--require-release-evidence` is available for an explicitly strict run.

Migration `0036_void_fabricated_release_evidence.sql` adds an immutable,
append-only void record for an exact accessibility acceptance or release bundle.
The original row and attribution remain intact for incident audit; forced
row-level policies hide only voided rows from ordinary application and inventory
reads. The pure evaluator likewise rejects evidence explicitly marked `voided`,
so the assessment returns to the administrative
`ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED` and/or
`IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED` state without becoming a substantive
publication blocker.

The same migration adds append-only `grant`/`revoke` events for the eight named
release roles. `record-assessment-release-evidence.ts` requires a current exact
role grant for the operator, accessibility/content/rights reviewers, cut-score
approver, QA reviewer, publisher, and rollback owner. With no grants it refuses
and tells the administrator to grant roles first. Test/smoke, automation,
service/system, and AI or shared assessment-authoring identities are rejected by
both the CLI and database grant policy. Authorization events and evidence voids
cannot be updated or deleted.

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

After content, provenance, bank, and blueprint blockers are cleared, record the
assessment-level evidence. The command refuses substantive blockers, a
non-admin recording operator, missing users, conflicting immutable evidence,
and any overlap among accessibility/content/rights/cut-score/QA/publisher IDs.
It never changes publication state.

```bash
# 4. Preview only (default):
npx tsx scripts/record-assessment-release-evidence.ts \
  --assessment <slug> --operator "<named operator>" --operator-user-id <admin id> \
  --accessibility-reviewer-user-id <id> --content-reviewer-user-id <id> \
  --rights-reviewer-user-id <id> --cut-score-approver-user-id <id> \
  --qa-reviewer-user-id <id> --publisher-user-id <id> --rollback-owner-user-id <id> \
  --accessibility-standard "WCAG 2.2 AA" \
  --accessibility-reference <vault-reference> --accessibility-sha256 <sha256> \
  --form-simulation-reference <vault-reference> --form-simulation-sha256 <sha256> \
  --cut-score-method "<reviewed method>" \
  --cut-score-approval-reference <vault-reference> --cut-score-approval-sha256 <sha256> \
  --release-qa-reference <vault-reference> --release-qa-sha256 <sha256> \
  --release-commit <git-sha> --takedown-procedure "<reviewed procedure>"

# 5. Repeat the exact command only after review, adding both write guards:
#    --apply --confirm-release-evidence
# 6. Independently verify strict readiness:
npm run --silent assessments:inventory -- --format summary --assessment <slug>
```

Only after step 6 reports `RELEASE_READY` may an authorized admin publish the
bank, wire the blueprint quotas, and publish the assessment through the
governed admin workflow. Publication is still refused while any strict release
blocker remains. Production deployment independently fails for substantive
published content/legal blockers and warns without failing for published
administrative evidence gaps; operators can add `--require-release-evidence`
for a strict evidence-enforcement run.

Do not generate reviewer decisions programmatically, reuse the author as
reviewer, or edit `content/` review metadata to make the gate pass. Doing so
produces an unreviewed exam that only appears approved.

## Published production substantive-governance snapshot (2026-07-28)

Read-only, repeatable-read SQL selected the 61 rows with `product_type=assessment`, `is_active=true`, `visibility=public`, and `review_status=approved`. `Demand` is the sum of blueprint `question_count`; `eligible` counts distinct scoped active/approved items with both `reviewed_by` and `reviewed_at`; `U` is active but unreviewed/non-attributable. Source identifiers resolve in the exact rights register below.

| Assessment | Demand | Eligible | U | Sources |
|---|---:|---:|---:|---|
| `advanced-sql-analytics-skills` | 20 | 80 | 0 | S01 |
| `agile-scrum-delivery-foundations` | 20 | 80 | 0 | S02 |
| `ai-fundamentals-for-work` | 20 | 80 | 0 | S03, S04 |
| `api-design-microservices-foundations` | 16 | 80 | 0 | S05 |
| `application-security-foundations` | 20 | 80 | 0 | S06 |
| `aws-cloud-practitioner-foundations` | 10 | 80 | 0 | S07 |
| `aws-solutions-architecture-skills` | 20 | 80 | 0 | S08 |
| `azure-administration-skills` | 20 | 80 | 0 | S09 |
| `azure-fundamentals-az-900-readiness` | 20 | 80 | 0 | S10 |
| `cloud-security-foundations` | 20 | 80 | 0 | S11 |
| `csharp-dotnet-backend-skills` | 20 | 80 | 0 | S12 |
| `cybersecurity-foundations` | 20 | 80 | 0 | S13 |
| `data-engineering-foundations` | 20 | 80 | 0 | S14 |
| `devops-ci-cd-foundations` | 20 | 80 | 0 | S15 |
| `docker-containerization-foundations` | 20 | 80 | 0 | S16 |
| `generative-ai-application-engineering` | 20 | 80 | 0 | S17 |
| `generative-ai-prompt-engineering-foundations` | 20 | 80 | 0 | S18 |
| `git-linux-developer-workflows` | 20 | 80 | 0 | S19 |
| `ibps-po-english-language-practice` | 30 | 200 | 0 | S20 |
| `ibps-po-quantitative-aptitude-practice` | 35 | 200 | 0 | S21 |
| `ibps-po-reasoning-ability-practice` | 35 | 200 | 0 | S22 |
| `identity-access-management-foundations` | 20 | 80 | 0 | S23 |
| `incident-response-threat-analysis` | 20 | 80 | 0 | S24 |
| `it-support-service-desk-foundations` | 20 | 80 | 0 | S25 |
| `java-spring-boot-backend-skills` | 20 | 80 | 0 | S26 |
| `javascript-react-foundations` | 20 | 80 | 0 | S27 |
| `kubernetes-foundations` | 20 | 80 | 0 | S28 |
| `linux-system-administration-foundations` | 20 | 80 | 0 | S29 |
| `llm-rag-evaluation-foundations` | 20 | 80 | 0 | S30 |
| `machine-learning-foundations` | 20 | 80 | 0 | S31 |
| `networking-support-foundations` | 20 | 80 | 0 | S32 |
| `nodejs-backend-foundations` | 20 | 80 | 0 | S33 |
| `power-bi-data-analyst-skills` | 20 | 80 | 0 | S34 |
| `python-backend-api-foundations` | 20 | 80 | 0 | S35 |
| `python-data-analysis-skills` | 20 | 80 | 0 | S36 |
| `react-application-engineering-skills` | 16 | 80 | 0 | S37 |
| `rrb-group-d-level-1-cbt-general-awareness-practice` | 20 | 200 | 0 | S38 |
| `rrb-group-d-level-1-cbt-general-intelligence-reasoning-practice` | 30 | 200 | 0 | S39 |
| `rrb-group-d-level-1-cbt-general-science-practice` | 25 | 200 | 0 | S40 |
| `rrb-group-d-level-1-cbt-mathematics-practice` | 25 | 200 | 0 | S41 |
| `rrb-ntpc-cbt-1-general-awareness-practice` | 40 | 200 | 0 | S42 |
| `rrb-ntpc-cbt-1-general-intelligence-reasoning-practice` | 30 | 200 | 0 | S43 |
| `rrb-ntpc-cbt-1-mathematics-practice` | 30 | 200 | 0 | S44 |
| `site-reliability-engineering-foundations` | 20 | 80 | 0 | S45 |
| `soc-analyst-foundations` | 20 | 80 | 0 | S46 |
| `software-testing-qa-foundations` | 20 | 100 | 0 | S47 |
| `ssc-cgl-tier-1-english-comprehension-practice` | 25 | 200 | 0 | S48, S49 |
| `ssc-cgl-tier-1-general-awareness-practice` | 25 | 200 | 0 | S50 |
| `ssc-cgl-tier-1-general-intelligence-reasoning-practice` | 25 | 200 | 0 | S51 |
| `ssc-cgl-tier-1-quantitative-aptitude-practice` | 25 | 200 | 0 | S52, S53 |
| `ssc-chsl-tier-1-english-language-practice` | 25 | 200 | 0 | S54 |
| `ssc-chsl-tier-1-general-awareness-practice` | 25 | 200 | 0 | S55 |
| `ssc-chsl-tier-1-general-intelligence-practice` | 25 | 200 | 0 | S56 |
| `ssc-chsl-tier-1-quantitative-aptitude-practice` | 25 | 200 | 0 | S57 |
| `ssc-mts-english-language-comprehension-practice` | 25 | 200 | 0 | S58 |
| `ssc-mts-general-awareness-practice` | 25 | 200 | 0 | S59 |
| `ssc-mts-numerical-mathematical-ability-practice` | 25 | 200 | 0 | S60 |
| `ssc-mts-reasoning-ability-problem-solving-practice` | 25 | 200 | 0 | S61 |
| `technical-project-management-foundations` | 20 | 80 | 0 | S62 |
| `terraform-infrastructure-as-code-foundations` | 20 | 80 | 0 | S63 |
| `typescript-application-development-skills` | 16 | 80 | 0 | S64 |

All 61 have `eligible >= demand` and `U=0`. After the narrowly scoped evidence registration below, every feeding source is verified, allows commercial use and derivatives, has an evidence reference, review time/reviewer, acquiring entity, and evidence SHA-256. No substantive content or source-rights gap remains in this published set.

| ID | Assessment | Source key | Status/C/D | Evidence reference | Rights reviewed at/by | Acquiring entity | Evidence SHA-256 |
|---|---|---|---|---|---|---|---|
| S01 | `advanced-sql-analytics-skills` | `first-party-original:advanced-sql-analytics-skills:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original assessment content. | 2026-07-28 10:46:29.0142 / Codex AI rights provenance recorder | Octamy | `164995757afca812ca73c6fe223c5486e2d65cedf4733a61921e1a798df2d714` |
| S02 | `agile-scrum-delivery-foundations` | `first-party-original:agile-scrum-delivery-foundations:v1` | verified/t/t | agile-scrum-delivery-foundations-v1:source-controlled-original-draft | 2026-07-28 11:45:56.484831 / Codex AI rights provenance recorder | Octamy | `a7686c9291f5f4045b1bf1c377f6a7e1703c2f7bb8613465ad9119d08f635704` |
| S03 | `ai-fundamentals-for-work` | `original:ai-fundamentals-for-work:v1` | verified/t/t | ai-fundamentals-for-work-v1-rights-evidence | 2026-07-28 11:08:48.329758 / Codex AI rights provenance recorder | Octamy | `0a387dd2bf22845185884daa72cd75821da0e295160ebda5413eb7134085580a` |
| S04 | `ai-fundamentals-for-work` | `original:ai-fundamentals-for-work:v2` | verified/t/t | ai-fundamentals-for-work-v2-replacement-rights-evidence | 2026-07-28 11:12:58.521276 / Codex AI rights provenance recorder | Octamy | `db9c24063e830db4c4acf3fe5ab8273546718f2e1f7912871cb9677bfe97dbb4` |
| S05 | `api-design-microservices-foundations` | `octamy-original:api-design-microservices-skills:v1` | verified/t/t | octamy-api-design-microservices-skills-v1:source-controlled-authored-items | 2026-07-28 06:51:54.078264 / Admin User | Octamy | `3d9ef6dbbb423069f7981744b715d137da81838d6de9bdb85395da380c817c73` |
| S06 | `application-security-foundations` | `first-party-original:application-security-foundations:v1` | verified/t/t | application-security-foundations-v1:source-controlled-original-draft | 2026-07-28 11:38:21.515031 / Codex AI rights provenance recorder | Octamy | `ab85af7ec6264779d75658a3632983acc6a8286fbf290070d370c827a9482d9d` |
| S07 | `aws-cloud-practitioner-foundations` | `octamy-original:aws-cloud-foundations-skills:v1` | verified/t/t | Authenticated Octamy product-owner instruction dated 2026-07-28 to author, review, and publish original assessment content. | 2026-07-28 10:12:12.324724 / Codex AI rights provenance recorder | Octamy | `00e9c541141e297134900169a5a4e47e315ed9ff81e2bb6be757e6a3099610e0` |
| S08 | `aws-solutions-architecture-skills` | `first-party-original:aws-solutions-architecture-skills:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, approve, and publish original assessment content. | 2026-07-28 10:55:20.793603 / Codex AI rights provenance recorder | Octamy | `b1489cfa9ceb079db144f4b5cd5c8c2249887b265c6929a9f1da26d7f15a20d1` |
| S09 | `azure-administration-skills` | `first-party-original:azure-administration-skills:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, approve, and publish original assessment content. | 2026-07-28 11:14:19.818655 / Codex AI rights provenance recorder | Octamy | `0698ed2042c2c2e55c199f298174a05422b5924c0390ca5dc661d1b67716fc82` |
| S10 | `azure-fundamentals-az-900-readiness` | `first-party-original:azure-fundamentals-az-900-preparation:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original assessment content. | 2026-07-28 10:39:08.31996 / Codex AI rights provenance recorder | Octamy | `89594ee19ff3d85ecddeccdd5c6aa029b1f37a2e3ed42498eb741d41f941375d` |
| S11 | `cloud-security-foundations` | `first-party-original:cloud-security-foundations:v1` | verified/t/t | cloud-security-foundations-v1:source-controlled-original-draft | 2026-07-28 11:31:37.677097 / Codex AI rights provenance recorder | Octamy | `7e586f31a90a7d21baafe6cf4c3fc79eeceecf99d40abd825da9b0c6541c54a4` |
| S12 | `csharp-dotnet-backend-skills` | `original:csharp-dotnet-backend-skills:v1` | verified/t/t | csharp-dotnet-backend-skills-v1-rights-evidence | 2026-07-28 11:36:20.855352 / Codex AI rights provenance recorder | Octamy | `44d00ee784b0ffa26ff259906b7b65941c75d9e6b9610be9b519ee3fa1e166ec` |
| S13 | `cybersecurity-foundations` | `octamy-original:cybersecurity-foundations:v1` | verified/t/t | octamy-cybersecurity-foundations-v1:source-controlled-original-draft | 2026-07-28 10:18:01.355739 / Codex AI rights provenance recorder | Octamy | `e3348cd248dc52da3208b43efbd648fda633000155608843588e589a9f9677a3` |
| S14 | `data-engineering-foundations` | `original:data-engineering-foundations:v1` | verified/t/t | data-engineering-foundations-v1-rights-evidence | 2026-07-28 10:50:09.469465 / Codex AI rights provenance recorder | Octamy | `cc2793d98e09675e292a3f97b99a20b28067159ca8592bb92a7ae319d7289421` |
| S15 | `devops-ci-cd-foundations` | `first-party-original:devops-ci-cd-foundations:v1` | verified/t/t | devops-ci-cd-foundations-v1:source-controlled-original-draft | 2026-07-28 11:58:24.326627 / Codex AI rights provenance recorder | Octamy | `9bf67bd8173be5449a5d9e024c2fa770804d1f3141da20f743f3be46fcbac6c3` |
| S16 | `docker-containerization-foundations` | `octamy-original:docker-containerization-skills:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original assessment content. | 2026-07-28 10:23:40.751978 / Codex AI rights provenance recorder | Octamy | `4ed4a578275d16b489f3a51c79f1d7a258dba81d43697ed843cfc09dd3cfc8bd` |
| S17 | `generative-ai-application-engineering` | `original:generative-ai-application-engineering:v1` | verified/t/t | generative-ai-application-engineering-v1-rights-evidence | 2026-07-28 10:54:37.840992 / Codex AI rights provenance recorder | Octamy | `42727bb59852de173c5a790da67b491c750f3e71d09deb24b0fbf78e31642611` |
| S18 | `generative-ai-prompt-engineering-foundations` | `original:generative-ai-prompt-engineering-foundations:v1` | verified/t/t | generative-ai-prompt-engineering-foundations-v1-rights-evidence | 2026-07-28 11:13:26.530192 / Codex AI rights provenance recorder | Octamy | `03e05fdac705ce0382261230f71ad26693976204da8384c47ae110e449b62290` |
| S19 | `git-linux-developer-workflows` | `first-party-original:git-linux-developer-workflows:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original assessment content. | 2026-07-28 10:53:01.03035 / Codex AI rights provenance recorder | Octamy | `8042845748c5745fc1b8fa4e2c90105bdba13ad2dac1ea9802b79117d06c1306` |
| S20 | `ibps-po-english-language-practice` | `first-party-adapted:ibps-po-crp-xvi-english-language-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 12:02:46.063254 / Codex AI rights provenance recorder | Octamy | `1c243bfad1c288641c9c2ff7e498cfcfa192d571f495513ef9be4029616c475e` |
| S21 | `ibps-po-quantitative-aptitude-practice` | `first-party-adapted:ibps-po-crp-xvi-quantitative-aptitude-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 12:01:09.651185 / Codex AI rights provenance recorder | Octamy | `6d51247dc68d17f5f45611afbd118e166f2d3eac81045c75c0b0554734b95613` |
| S22 | `ibps-po-reasoning-ability-practice` | `first-party-adapted:ibps-po-crp-xvi-reasoning-ability-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 12:02:14.445431 / Codex AI rights provenance recorder | Octamy | `2ecfabd41cfe3fa0e76b85a1d00aab6629d689c9ef6c37e51740e586bad47664` |
| S23 | `identity-access-management-foundations` | `first-party-original:identity-access-management-foundations:v1` | verified/t/t | identity-access-management-foundations-v1:source-controlled-original-draft | 2026-07-28 11:38:43.800244 / Codex AI rights provenance recorder | Octamy | `afda1610e737b1407474a7b6bb7adf90281ffe2bae5561ba0e8123a1bf51c3ed` |
| S24 | `incident-response-threat-analysis` | `first-party-original:incident-response-threat-analysis:v1` | verified/t/t | incident-response-threat-analysis-v1:related-first-party-original-draft | 2026-07-28 11:45:37.905282 / Codex AI rights provenance recorder | Octamy | `7350de84aca898c575a30b65f38a003ee1f088551aea2279ad5d8ceac674dec3` |
| S25 | `it-support-service-desk-foundations` | `first-party-original:it-support-service-desk-foundations:v1` | verified/t/t | it-support-service-desk-foundations-v1:source-controlled-original-draft | 2026-07-28 11:48:17.721356 / Codex AI rights provenance recorder | Octamy | `2591b3c6f6e8c0a2eb189bc75bbee554cbc13a5641442b0af49812ba04601dc5` |
| S26 | `java-spring-boot-backend-skills` | `original:java-spring-boot-backend-skills:v1` | verified/t/t | java-spring-boot-backend-skills-v1-rights-evidence | 2026-07-28 11:15:01.156112 / Codex AI rights provenance recorder | Octamy | `659dada82d63a36179705a4c76ec1c311c2d6cc8d259d7102bb65ecf7fb6c5b2` |
| S27 | `javascript-react-foundations` | `first-party-original:javascript-react-foundations:v1` | verified/t/t | javascript-react-foundations-v1:source-controlled-original-draft | 2026-07-28 11:54:27.894796 / Codex AI rights provenance recorder | Octamy | `cc8de4504f1c819d4aa1e522602f6314bb00eafbe3a83c78a8f082d645858ee0` |
| S28 | `kubernetes-foundations` | `original:kubernetes-foundations:v1` | verified/t/t | kubernetes-foundations-v1-rights-evidence | 2026-07-28 10:38:27.84034 / Codex AI rights provenance recorder | Octamy | `95064178debf0d45cad6a0b7f45964f58e6bf474915296dd3c1b2064b8c214c9` |
| S29 | `linux-system-administration-foundations` | `first-party-original:linux-system-administration-foundations:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original assessment content. | 2026-07-28 11:04:28.759507 / Codex AI rights provenance recorder | Octamy | `d2668f62ba2ca89e67d29a0c583e41b896753f25cf5741b62af38934c92e0d73` |
| S30 | `llm-rag-evaluation-foundations` | `original:llm-rag-evaluation-foundations:v1` | verified/t/t | llm-rag-evaluation-foundations-v1-rights-evidence | 2026-07-28 10:58:03.623181 / Codex AI rights provenance recorder | Octamy | `19528d271134317d31a8fc0531d13ead6ff143181c9cb72064cad900ec3bc2d8` |
| S31 | `machine-learning-foundations` | `original:machine-learning-foundations:v1` | verified/t/t | machine-learning-foundations-v1-rights-evidence | 2026-07-28 11:08:21.8755 / Codex AI rights provenance recorder | Octamy | `90ebd2ff2803c9754728d29ba9a94450cd0214c353b835b8a0651bf61b75b5d8` |
| S32 | `networking-support-foundations` | `first-party-original:networking-support-foundations:v1` | verified/t/t | networking-support-foundations-v1:source-controlled-original-draft | 2026-07-28 11:54:09.720918 / Codex AI rights provenance recorder | Octamy | `1162d931239225dbe81c9e7429b2955f41144d36786d8a77a09eb0cee68dac54` |
| S33 | `nodejs-backend-foundations` | `first-party-original:nodejs-backend-foundations:v1` | verified/t/t | nodejs-backend-foundations-v1:source-controlled-original-draft | 2026-07-28 11:57:40.568248 / Codex AI rights provenance recorder | Octamy | `ddf2f5c61c6b4719480cfc52f1b5db25494de2af0dbb7f6c0762778471823e64` |
| S34 | `power-bi-data-analyst-skills` | `first-party-original:power-bi-data-analyst-skills:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, approve, and publish original assessment content. | 2026-07-28 10:49:18.518656 / Codex AI rights provenance recorder | Octamy | `abcca3379a018d767511d24fba8bdac86bab4be73ec1da63eae4924fbce0cb77` |
| S35 | `python-backend-api-foundations` | `original:python-backend-api-foundations:v1` | verified/t/t | python-backend-api-foundations-v1-rights-evidence | 2026-07-28 11:13:52.935441 / Codex AI rights provenance recorder | Octamy | `58acffef2c50d1fadda40d8a9a71d9d0dfd1ac15ca45d21ab5b9036fafb5ba1b` |
| S36 | `python-data-analysis-skills` | `original:python-data-analysis-skills:v1` | verified/t/t | python-data-analysis-skills-v1-rights-evidence | 2026-07-28 10:45:36.6574 / Codex AI rights provenance recorder | Octamy | `7eb0724de64d47355a56a74c2a114817eabb6999a2ea311514253ce77e6e2a42` |
| S37 | `react-application-engineering-skills` | `octamy-original:react-application-engineering-skills:v1` | verified/t/t | octamy-react-application-engineering-skills-v1:source-controlled-authored-items | 2026-07-19 02:39:20.383677 / Admin User | Octamy Solutions Private Limited | `7a2ecd2f95cbdb5c19bae15541a9ce660c0317155e692c5ecd19ec2e329f2aa0` |
| S38 | `rrb-group-d-level-1-cbt-general-awareness-practice` | `first-party-adapted:rrb-group-d-level1-cbt-general-awareness-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:57:13.615057 / Codex AI rights provenance recorder | Octamy | `cf4c297be106797a549f0976a4d4eadee25d7d4b1fe223d5c3dcbf796290c1dc` |
| S39 | `rrb-group-d-level-1-cbt-general-intelligence-reasoning-practice` | `first-party-adapted:rrb-group-d-level1-cbt-general-intelligence-reasoning-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:56:49.327107 / Codex AI rights provenance recorder | Octamy | `33f3764785732c9c4f9e5e61ee288f93e9bb5f2f5b674a5f16626ffa8d0c1a53` |
| S40 | `rrb-group-d-level-1-cbt-general-science-practice` | `first-party-original:rrb-group-d-level1-cbt-general-science-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28. | 2026-07-28 11:59:57.390758 / Codex AI rights provenance recorder | Octamy | `a4ce43bb7deaa052194136aaf810845e6972201ebeb1d6ccf032c99bf436ebc2` |
| S41 | `rrb-group-d-level-1-cbt-mathematics-practice` | `first-party-adapted:rrb-group-d-level1-cbt-mathematics-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:55:55.523305 / Codex AI rights provenance recorder | Octamy | `87cf64d6166013b77eebe659b2488a4ce875d94c598a53a5f7c209eadb2dd2ae` |
| S42 | `rrb-ntpc-cbt-1-general-awareness-practice` | `first-party-adapted:rrb-ntpc-cbt1-general-awareness-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:53:45.314781 / Codex AI rights provenance recorder | Octamy | `5d0a3f274bd3a00ea5691951df3762b5c398584d6ac13508ef90c91741794303` |
| S43 | `rrb-ntpc-cbt-1-general-intelligence-reasoning-practice` | `first-party-adapted:rrb-ntpc-cbt1-general-intelligence-reasoning-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:52:19.109963 / Codex AI rights provenance recorder | Octamy | `461658452a531e38581692973b9a464069b6fa504d1624a58830e21d309acda0` |
| S44 | `rrb-ntpc-cbt-1-mathematics-practice` | `first-party-adapted:rrb-ntpc-cbt1-mathematics-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:51:52.988383 / Codex AI rights provenance recorder | Octamy | `a58d66c8577c1ebc66af2e9fbc18294c082f4e9317af1d01dadcb68f50b51239` |
| S45 | `site-reliability-engineering-foundations` | `first-party-original:site-reliability-engineering-foundations:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 authorizing original assessment content. | 2026-07-28 11:23:17.495478 / Codex AI rights provenance recorder | Octamy | `84b568c031ba0b563684767599d32c859facf4d5224f1570a1fb2ba22a9f0711` |
| S46 | `soc-analyst-foundations` | `first-party-original:soc-analyst-foundations:v1` | verified/t/t | soc-analyst-foundations-v1:source-controlled-original-draft | 2026-07-28 11:35:25.428772 / Codex AI rights provenance recorder | Octamy | `6dd9e345ccd48587c56b475ff699f9a5aab8c22518a7dfb1f69aafef648efcfb` |
| S47 | `software-testing-qa-foundations` | `octamy-original:software-testing-qa-skills:v1` | verified/t/t | software-testing-qa-skills-v1:source-controlled-authored-items | 2026-07-28 07:21:10.431009 / Admin User | Octamy | `b359bffce25e30da8cf2e147c019437cbfc5c5d986936b30e33a635eaaf5808a` |
| S48 | `ssc-cgl-tier-1-english-comprehension-practice` | `first-party-original:ssc-cgl-tier1-english-comprehension-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original practice content. | 2026-07-28 11:30:56.655359 / Codex AI rights provenance recorder | Octamy | `c075a3db6960db1062694416cc83260498761e32ddaee9d9148881fcab29a64c` |
| S49 | `ssc-cgl-tier-1-english-comprehension-practice` | `first-party-original:ssc-cgl-tier1-english-comprehension-practice:v2-correction-1` | verified/t/t | Authenticated product-owner production-content instruction and publication-gate correction dated 2026-07-28. | 2026-07-28 11:34:47.164226 / Codex AI rights provenance recorder | Octamy | `65e2e1117d8c43916ff261019179c5c76bdee82234ba151b69f7f075979b48ab` |
| S50 | `ssc-cgl-tier-1-general-awareness-practice` | `first-party-original:ssc-cgl-tier1-general-awareness-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original practice content. | 2026-07-28 11:43:05.571585 / Codex AI rights provenance recorder | Octamy | `c97959801198fa5f62618e127da0494a87bf57011d606b43c22df8d994847823` |
| S51 | `ssc-cgl-tier-1-general-intelligence-reasoning-practice` | `first-party-original:ssc-cgl-tier1-general-intelligence-reasoning-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, validate, review, and publish original practice content. | 2026-07-28 11:30:25.026166 / Codex AI rights provenance recorder | Octamy | `657d68ca782c553adceb1605c39a4388f6f66d64956926457df07558bb02274d` |
| S52 | `ssc-cgl-tier-1-quantitative-aptitude-practice` | `first-party-original:ssc-cgl-tier1-quantitative-aptitude-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, calculate, review, and publish original practice content. | 2026-07-28 11:05:23.669657 / Codex AI rights provenance recorder | Octamy | `30faf9b45471fcc5eb051b20cb81925c2defa6069774c29e24d135b140fb5534` |
| S53 | `ssc-cgl-tier-1-quantitative-aptitude-practice` | `first-party-original:ssc-cgl-tier1-quantitative-aptitude-practice:v2-correction-1` | verified/t/t | Authenticated product-owner production-content instruction and publication-gate correction dated 2026-07-28. | 2026-07-28 11:12:17.609644 / Codex AI rights provenance recorder | Octamy | `a6a80da1bc7c6378d946078e2e44830ab09c68d8a223b8cb5586f27ae7cc5def` |
| S54 | `ssc-chsl-tier-1-english-language-practice` | `first-party-adapted:ssc-chsl-tier1-english-language-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:44:33.026885 / Codex AI rights provenance recorder | Octamy | `5c9dc91f41bae966d172c5fde61e823dbe3f3e01406b924caac6b4605f051d0b` |
| S55 | `ssc-chsl-tier-1-general-awareness-practice` | `first-party-adapted:ssc-chsl-tier1-general-awareness-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:44:56.193166 / Codex AI rights provenance recorder | Octamy | `fa793d1fd2ed710e0f66f7898829a9bcdcc534452e7ea71d5918300326dfd160` |
| S56 | `ssc-chsl-tier-1-general-intelligence-practice` | `first-party-adapted:ssc-chsl-tier1-general-intelligence-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:44:11.180629 / Codex AI rights provenance recorder | Octamy | `61b12a3e8699c5638ffd2e2ab582d0ed5ad2b98951c2dcd0a3ef11c5340ada62` |
| S57 | `ssc-chsl-tier-1-quantitative-aptitude-practice` | `first-party-adapted:ssc-chsl-tier1-quantitative-aptitude-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy SSC quantitative source records. | 2026-07-28 11:39:55.072385 / Codex AI rights provenance recorder | Octamy | `2f9a983757ef3a7a9bbc4111c1c2bc2c31eac2cbc40013f50bb3bccf8de88905` |
| S58 | `ssc-mts-english-language-comprehension-practice` | `first-party-adapted:ssc-mts-english-language-comprehension-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:49:45.95962 / Codex AI rights provenance recorder | Octamy | `0898fd08418691679d5b0dcd64c824caf7a5593bfa044580a634b28f0e2158c7` |
| S59 | `ssc-mts-general-awareness-practice` | `first-party-adapted:ssc-mts-general-awareness-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:50:06.264572 / Codex AI rights provenance recorder | Octamy | `609070ffc13cdeaa024ed2123f9fb92398a144b48fb3d990800cce4a9b9245b9` |
| S60 | `ssc-mts-numerical-mathematical-ability-practice` | `first-party-original:ssc-mts-numerical-mathematical-ability-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 to author, review, and publish original practice content. | 2026-07-28 11:47:24.779714 / Codex AI rights provenance recorder | Octamy | `d97026a6f5facbbd7a97246e8b4b3ec9ce51bbb1f688330c132eb0be11069441` |
| S61 | `ssc-mts-reasoning-ability-problem-solving-practice` | `first-party-adapted:ssc-mts-reasoning-ability-problem-solving-practice:v1` | verified/t/t | Authenticated product-owner instruction dated 2026-07-28 and governed Octamy source records. | 2026-07-28 11:49:23.161786 / Codex AI rights provenance recorder | Octamy | `a901562452f11f5d6a1c4ea08821c19ead6d02fbcfec320d227664e96dd64402` |
| S62 | `technical-project-management-foundations` | `first-party-original:technical-project-management-foundations:v1` | verified/t/t | technical-project-management-foundations-v1:source-controlled-original-draft | 2026-07-28 11:47:59.401047 / Codex AI rights provenance recorder | Octamy | `afc64df4ea317b3c86ca7528f978c5a028d4b732a79845c98c327c80b5b36bc6` |
| S63 | `terraform-infrastructure-as-code-foundations` | `original:terraform-infrastructure-as-code-skills:v1` | verified/t/t | terraform-infrastructure-as-code-foundations-v1-rights-evidence | 2026-07-28 10:37:49.179496 / Codex AI rights provenance recorder | Octamy | `b9eb37a842bc5576a975ce658ff1b8a3d0528b912b00b2676c7773191e576031` |
| S64 | `typescript-application-development-skills` | `octamy-original:typescript-application-development-skills:v1` | verified/t/t | octamy-typescript-application-development-skills-v1:source-controlled-authored-items | 2026-07-18 18:24:56.817882 / Admin User production account 1 | Octamy Solutions Private Limited | `7a2ecd2f95cbdb5c19bae15541a9ce660c0317155e692c5ecd19ec2e329f2aa0` |

### Production evidence repair

Before registration, only `octamy-original:react-application-engineering-skills:v1` and `octamy-original:typescript-application-development-skills:v1` lacked `provenance.rightsReview.acquiringEntity` and `evidenceSha256`; each affected 80 items. Both existing rows state `publisher=Octamy`, `rights_basis=owned`, `acquisitionMethod=first_party`, and chain-of-title that all assessment wording is original first-party Octamy content. The guarded CLI recorded entity `Octamy Solutions Private Limited` and SHA-256 `7a2ecd2f95cbdb5c19bae15541a9ce660c0317155e692c5ecd19ec2e329f2aa0` for the retained server evidence file. It did not alter rights decisions, permissions, content, reviews, or publication.

```bash
npx tsx scripts/register-production-rights-evidence.ts \
  --source octamy-original:react-application-engineering-skills:v1 \
  --source octamy-original:typescript-application-development-skills:v1 \
  --operator octamy-platform-owner \
  --acquiring-entity "Octamy Solutions Private Limited" \
  --evidence-file /var/lib/octamy/rights-evidence/production-original-rights-2026-07-28.txt \
  --apply --confirm-octamy-original-ownership
```

The command is dry-run by default, accepts only unambiguous `octamy-original:*`/owned/Octamy/first-party sources, refuses non-`verified` or conflicting records, and is transactionally idempotent. Accessibility acceptance, rights-role separation, immutable release bundles, and blueprint-revision evidence remain separate release-workstream concerns.

## Production publication/evidence run — 2026-07-29

The production inventory was read through the server-loopback SSH tunnel in a PostgreSQL `REPEATABLE READ READ ONLY` transaction before and after guarded publication work.

- Before: `Assessments: 141; release-ready: 0; blocked: 141; published-with-substantive-blockers: 0; published-missing-release-evidence: 61`
- `grade-3-arithmetic-time-and-perimeter-practice` was published through `scripts/.tmp-publish-reviewed-assessment.ts`, preserving its topic blueprint. The public API returned assessment ID 53, the exact slug/title, and canonical path `/practice/grade-3-arithmetic-time-and-perimeter-practice`. Its 200-item pack test passed all five checks, including five disjoint representative attempts at production quotas.
- `data-analytics-sql-bi-foundations` was not published. The same guarded script rolled its transaction back because question 115709 has a 28-character explanation; only 79 of the required 80 items were eligible. A fresh attributable review is required before correcting that exact item version.
- Release evidence recorded: **0 assessments**. Production has only one administrator and two active institute owners; one owner is explicitly a smoke-test account. The command requires six distinct accessibility/content/rights/cut-score/QA/publisher user IDs, while accessibility and rights must also be independent of every in-scope author/reviewer. No genuine signatory identities or hashed acceptance/form-simulation/cut-score/QA artifacts were fabricated. All 61 assessments in the preceding production table plus the newly published Grade 3 practice remain evidence-blocked.
- The other P1 school/senior-science assessments remain unpublished: Grade 4–10 Mathematics Practice and Grade 11/12 Physics/Chemistry Numerical Practice. Their dedicated production banks are archived with zero questions, and the documented curriculum review rejects their generic shared blueprints. They require grade-specific current-curriculum packs and named independent item-level review before guarded publication.
- After: `Assessments: 141; release-ready: 0; blocked: 141; published-with-substantive-blockers: 0; published-missing-release-evidence: 62`
