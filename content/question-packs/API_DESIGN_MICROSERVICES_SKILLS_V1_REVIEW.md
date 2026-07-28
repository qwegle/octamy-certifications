# API Design and Microservices Skills v1 Review

Status: approval-ready candidate after deterministic validation and blocker review.

Scope:

- 80 original MCQ items.
- 8 topics x 10 items.
- Per topic difficulty: 3 easy, 5 medium, 2 hard.
- Blueprint draw target: 2 questions per topic, 16 total, 5x rotation depth.
- Primary references: RFC 9110, RFC 9111, OpenAPI Specification latest v3.2.0, OWASP API Security Top 10 2023, Twelve-Factor App, Kubernetes documentation.

Exact artifact:

- JSONL SHA-256: `f2e7122f110fc8ca2bae7e9b684b5dc47e46c2774d0834321464ac12050ebbce`
- Manifest SHA-256: `244f1bee0a7ba87980d537ae721f9ab8ce6b344ff383800836cd943834f451f6`
- Generator audit digest: `38079f8e62aef1e36905acdb020e49d82155077996aed7bc7266660d21fe67a8`
- Syllabus: `OCT-ADMS-2026.1 (HTTP, OpenAPI 3.2, OWASP API 2023, 12-Factor, Kubernetes; 2026-07-28)`

Validation completed:

- Generator audit passed: 80 rows, 80 unique prompts, 80 unique semantic prompts, 80 unique content hashes.
- Blueprint pool: 8 topics x 10 questions, proposed draw 2 per topic, 16 total, 5x rotation depth.
- Answer positions are balanced 20/20/20/20.
- Each topic has 3 easy, 5 medium, and 2 hard questions.
- Focused Jest passed: `tests/unit/api-design-microservices-skills-v1.test.ts` passed 3/3.
- TypeScript validation passed with `./node_modules/.bin/tsc --noEmit`.
- Exact reproduction passed: regenerated JSONL byte-for-byte matched the committed JSONL.
- Additional blocker review found no placeholders, no duplicate options, and valid keyed answers.
- Source-support blockers in the first review pass were fixed for retry/idempotency, service-process design, disposability, logs, dependencies, and codebase items by rewriting them to stay within the cited primary sources.
- OpenAPI metadata was updated from stale 3.1 wording to current OpenAPI latest v3.2.0 before release.

Production release rule:

Do not approve or publish a different artifact under this review. If any prompt, option, answer, explanation, source URL, topic, difficulty, syllabus, or metadata changes, rerun review and attach a new artifact hash before production approval.
