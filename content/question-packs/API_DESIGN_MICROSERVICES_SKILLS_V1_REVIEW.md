# API Design and Microservices Skills v1 Review

Status: approval-ready candidate after local independent item-level review.

Scope:

- 80 original MCQ items.
- 8 topics x 10 items.
- Per topic difficulty: 3 easy, 5 medium, 2 hard.
- Blueprint draw target: 2 questions per topic, 16 total, 5x rotation depth.
- Primary references: RFC 9110, RFC 9111, RFC 6585, OpenAPI Specification 3.1.1, OWASP API Security Top 10 2023, Twelve-Factor App, Kubernetes documentation.

Validation completed:

- Generator audit passed: 80 rows, 80 unique prompts, 80 unique semantic prompts, 80 unique content hashes.
- Answer positions are balanced 20/20/20/20.
- Each topic has 3 easy, 5 medium, and 2 hard questions.
- Import validator accepted all 80 rows with zero invalid rows and zero duplicate source/content rows.
- TypeScript validation passed with `./node_modules/.bin/tsc --noEmit`.
- Direct JSONL reproducibility assertion passed against the exact generated artifact.
- Additional local review check found no placeholders, no duplicate options, valid keyed answers, and matching release-evidence/source references.

Known test caveat:

- The Jest process hung before reporting results in this workspace. The same assertions were run directly with `npx tsx` and passed.

Production release rule:

Do not import, approve, activate, or publish until the generated JSONL exactly matches the generator, the focused tests pass, TypeScript passes, and every item has an independent review decision tied to the exact content hash/version.
