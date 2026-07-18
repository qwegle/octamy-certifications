# TypeScript Application Development Skills v1

Assessment slug: `typescript-application-development-skills`

Bank slug: `typescript-application-development-skills-bank-v1`

Syllabus: `OCT-TSAD-2026.1 (TypeScript 5.6.3; Handbook snapshot 2026-07-18)`

Status: content-complete release candidate. It is neither independently reviewed nor approved, imported, active, or published.

## Scope and blueprint

This version narrows the shell to vendor-neutral TypeScript application-development skills that are stable in TypeScript 5.6.3. It does not claim framework expertise, runtime-specific Node.js expertise, or mastery of every compiler feature.

The intended form draws 16 questions: two from each topic. Every topic has 10 candidates, giving five-times rotation depth per blueprint scope and exceeding the four-times certification requirement.

| Topic | Pool | Draw | Rotation |
| --- | ---: | ---: | ---: |
| Language foundations | 10 | 2 | 5x |
| Object and API modelling | 10 | 2 | 5x |
| Control-flow narrowing | 10 | 2 | 5x |
| Generics and type operators | 10 | 2 | 5x |
| Modules and declarations | 10 | 2 | 5x |
| Async and error boundaries | 10 | 2 | 5x |
| Compiler configuration | 10 | 2 | 5x |
| JavaScript integration and quality | 10 | 2 | 5x |
| Total | 80 | 16 | 5x |

Difficulty is intentionally foundation/intermediate weighted: 37 easy, 33 medium, and 10 hard questions. Each generated form should draw a controlled mix rather than relying on an unconstrained random selection.

## Evidence and authorship

Every item is original wording and carries:

- an item ID and content hash;
- a topic and `TSAD-*` objective code;
- the exact syllabus version;
- an official `typescriptlang.org` factual reference;
- an explanation and author answer-evidence note;
- a release-evidence-shaped answer-validation record;
- a distractor screening note that explicitly does not impersonate independent review.

Primary reference families are the official TypeScript Handbook, module/declaration guidance, project-reference guidance, and TSConfig option reference. Source URLs are item-specific in the JSONL.

## Reproducible checks

```sh
npx tsx scripts/generate-typescript-application-development-skills-v1.ts /tmp/octamy-typescript-application-development-skills-v1.jsonl
cmp /tmp/octamy-typescript-application-development-skills-v1.jsonl content/question-packs/octamy-typescript-application-development-skills-v1.jsonl
npx tsx scripts/import-question-pack.ts --file content/question-packs/octamy-typescript-application-development-skills-v1.jsonl --source octamy-original:typescript-application-development-skills:v1 --bank typescript-application-development-skills-bank-v1 --operator release-reviewer
npm test -- --runInBand tests/unit/typescript-application-development-skills-v1.test.ts
```

The importer command is validation-only unless its explicit commit flag is supplied. Do not commit an import during author review.

## Release blockers

1. An attributable TypeScript SME other than the author must review all 80 exact item versions, correct or reject them, and record timestamps.
2. The JSONL contract now validates `metadata.releaseEvidence` and promotes it into `questions.answer_metadata.releaseEvidence`; the validation-only import must confirm that mapping before any committed import.
3. The source manifest must be rights-verified and registered by an authorised operator.
4. Create or reconcile the versioned private bank and map these eight exact topics. Do not overwrite a differently versioned bank.
5. Replace the seed's generic blueprint with eight rows drawing two mixed-difficulty items per topic, then verify difficulty distribution across representative forms.
6. Run the guarded acceptance report with zero blockers, plus scoring, timing, keyboard/mobile accessibility, recovery, and retired/pending exclusion tests.
7. A separate authorised publisher must activate the reviewed bank and publish the assessment through guarded mutations. No direct database-field publication is acceptable.

Any edit to a stem, option, answer, explanation, objective, source, syllabus, or blueprint creates a new release candidate and invalidates the prior item approval.
