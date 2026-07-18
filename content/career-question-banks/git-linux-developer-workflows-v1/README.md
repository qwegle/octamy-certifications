# Git and Linux Developer Workflows — question bank v1

Assessment slug: `git-linux-developer-workflows`

Syllabus version: `OCT-GLDW-2026.1`

Status: content-complete draft. Do not activate or publish until a named, independent subject-matter reviewer has reviewed the imported rows and recorded approval through the assessment-governance workflow.

## Scope and blueprint

This bank measures practical, entry-level developer use of Git and a Linux command-line environment. It deliberately excludes distribution-specific package management, advanced kernel administration, and trivia that does not predict safe day-to-day work.

| Topic | Questions |
| --- | ---: |
| Git snapshots and inspection | 10 |
| Git branches and integration | 10 |
| Git collaboration and recovery | 10 |
| Shell execution and redirection | 10 |
| Files and permissions | 10 |
| Processes and services | 10 |
| Text, search and pipelines | 10 |
| Operational troubleshooting | 10 |
| Total | 80 |

Objective-code prefixes for per-item release evidence are `GLDW-GSI` (snapshots/inspection), `GLDW-GBI` (branches/integration), `GLDW-GCR` (collaboration/recovery), `GLDW-SER` (shell execution/redirection), `GLDW-FPR` (files/permissions), `GLDW-PSV` (processes/services), `GLDW-TSP` (text/search/pipelines), and `GLDW-OTR` (operational troubleshooting). Each topic's ten rows are numbered `01` through `10`; the validator requires that exact topic-to-objective mapping.

Every CSV row includes the five first-party release-evidence columns required by the importer: `syllabusVersion`, `objectiveCode`, `answerValidationMethod`, `answerValidationReference`, and `distractorReviewNote`. The references are item-specific primary Git, GNU, Linux man-pages, or systemd documentation. These fields record author verification only. They do not represent independent review, do not name a reviewer, and must never be used to synthesize approval.

The intended live exam draws 20 mixed-difficulty questions from the full 80-question bank. This is exactly four-times rotation depth at bank level. Topic coverage should be checked in every generated form during release testing; a future v2 should expand each topic and use topic-level blueprint quotas. Treat v1 as a coherent minimum release candidate, not a mature high-rotation pool.

## Primary syllabus references

- Git reference documentation: https://git-scm.com/docs
- Git user manual: https://git-scm.com/docs/user-manual
- Bash Reference Manual: https://www.gnu.org/software/bash/manual/
- GNU Coreutils manual: https://www.gnu.org/software/coreutils/manual/coreutils.html
- Linux man-pages project: https://man7.org/linux/man-pages/
- systemctl manual: https://man7.org/linux/man-pages/man1/systemctl.1.html
- journalctl manual: https://man7.org/linux/man-pages/man1/journalctl.1.html

All prompts and explanations in `questions.csv` are original Octamy wording. The references define the tested behavior; their prose is not copied into the questions.

## Import and release procedure

1. Import `questions.csv` into the private bank for the assessment using the existing question-bank CSV dry-run endpoint.
2. Confirm the dry run reports 80 valid rows and no errors.
3. Run `node scripts/validate-career-bank-csv.mjs content/career-question-banks/git-linux-developer-workflows-v1/questions.csv 20`. This performs PapaParse shape validation, exact objective mapping, primary-source evidence checks, duplicate checks, answer-position leakage checks, and rotation validation.
4. Have an independent Git/Linux SME review every prompt, option, answer and explanation in the admin workflow.
5. Record the real reviewer identity and review timestamp; do not bulk-approve under a service or seed identity.
6. Replace the current 10-question placeholder blueprint row with one mixed blueprint row drawing 20 questions from this bank. Do not configure a draw above 20 until the inventory grows beyond 80, because that would violate the four-times rotation requirement.
7. Run the repository readiness checks before changing the assessment from private/pending.
