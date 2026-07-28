# Software Testing and QA Skills Bank v1 review

Purpose: release a scenario-based certification question bank for `software-testing-qa-foundations`.

Public-facing exam name: Software Testing and QA Skills.

Internal source key: `octamy-original:software-testing-qa-skills:v1`.

Coverage:

- 100 original MCQ single-choice questions.
- 10 topics x 10 questions.
- Difficulty mix per topic: 3 easy, 5 medium, 2 hard.
- Proposed certification draw: 25 questions.
- Rotation depth: 4x.
- Balanced answer positions: 25/25/25/25.

Reference basis:

- ISTQB CTFL v4.0 certification/syllabus page.
- OWASP Web Security Testing Guide.
- W3C WCAG 2.2.
- Playwright assertions and timeout documentation.
- OpenAPI latest specification.
- RFC 9110 HTTP semantics.

Author review checklist:

- No placeholder, lorem, dummy, random, or copied exam text.
- All prompts are scenario-based or work-practice based.
- Every question has one keyed answer.
- Distractors are plausible but incorrect.
- Explanations are original and tied to cited source evidence.
- No learner-facing answer-key fields are present outside the governed import answer payload.
- Public-facing exam and bank labels are generic; Octamy appears only as internal publisher/source ownership.

Local validation:

- Generator audit: expected 100 rows, 100 unique prompts, 100 unique semantic prompts, 100 unique content hashes.
- Topic distribution: 10 topics x 10.
- Difficulty distribution: 3 easy, 5 medium, 2 hard per topic.
- Answer position distribution: 25/25/25/25.
- Proposed draw: 25.
- Rotation depth: 4.

Production release requirement:

- Register source manifest with rights evidence.
- Import into the existing `software-testing-qa-foundations-bank` production bank only after validation.
- Review decisions must be applied by a reviewer distinct from source rights reviewer and author/import operator.
- Activate bank, save 10-topic blueprint with 25 total draw, publish course 203, then smoke test public catalog and question draw.
