# Octamy 100+/100+ Assessment Content Program

## Purpose

Scale to at least 100 certification exams and 100 realistic Practice exams without bulk approval, fabricated review evidence, or copied/recalled third-party questions. A catalog shell is not a released assessment. Every released exam is an independently governed product with traceable rights, content, technical, accessibility, and measurement evidence.

## Non-negotiable release rules

- Publication fails closed. Only an active, public, approved assessment with a purpose-compatible, active bank and deeply release-ready questions can be sold or attempted.
- Certification and Practice banks remain separate. Practice attempts never issue credentials or become recruiter evidence by default.
- Author and reviewer are different people. Rights approval is separate from content approval.
- Correct answers alone do not prove item quality. Every item needs rationale, blueprint alignment, distractor review, accessibility review, and version history.
- No leaked, recalled, memorized, confidential, or copyrighted vendor/company question collection may be copied or adapted.
- AI output is draft material only. A human author and independent qualified reviewer remain accountable.
- No bulk publish endpoint or direct SQL publication workflow is permitted.

## Portfolio architecture

### Certification exams

Each certification makes a narrow, vendor-neutral, evidence-backed claim. A launchable pool contains at least `max(80, draw × 4)` independently reviewed items. An 80-item pool supports no more than a 20-item form at the required 4× rotation ratio.

Each certification release bundle contains:

1. Claim statement, target learner, prerequisites, exclusions, and renewal period.
2. Versioned domain blueprint with weights, cognitive levels, and form constraints.
3. Source register with exact rights evidence, citations, acquisition entity, and approved uses.
4. Exact item IDs, versions, canonical hashes, author, reviewer, and review timestamps.
5. SME accuracy, rationale, distractor, bias, language, and accessibility attestations.
6. Simulated forms proving coverage, difficulty balance, overlap limits, and answer distribution.
7. Standard-setting rationale and passing-score approval.
8. Pilot/field evidence when the claim warrants it, plus item-analysis and exposure decisions.
9. Publisher sign-off, release commit, release time, rollback owner, and takedown procedure.

### Practice exams

Each Practice product is a realistic preparation experience, not a credential. A launchable pool contains at least `max(200, draw × 5)` reviewed items to support repetition and lower exposure. Practice may provide explanations, retry recommendations, and private mastery summaries. It must not imply employer endorsement or reproduce live tests.

Practice release bundles use the same rights and review controls as certification, plus:

- explicit preparation objective and non-credential disclaimer;
- answer explanations and source-grounded learning references;
- retry/rotation and item-exposure thresholds;
- accessibility-friendly mode with no forced fullscreen or clipboard blocking;
- checks that no certificate, verification, activation, or recruiter-evidence path is reachable.

## Company-oriented preparation

Prefer track names such as **Campus Hiring Readiness — IT Services Track**. Employer names may appear only as secondary factual references when current, dated, counsel-reviewed, unaffiliated, and unendorsed. Do not use logos, trade dress, confidential materials, or claims that Octamy predicts a specific employer's selection decision.

Build clean-room competencies instead: quantitative reasoning, communication, debugging, coding fundamentals, role scenarios, workplace judgment, and interview explanation. SMEs write from public competency descriptions and original blueprints; reviewers check for suspicious similarity before release.

## Workflow and roles

1. Portfolio council approves the claim and blueprint budget.
2. Rights lead approves sources and permitted use before drafting.
3. Qualified author drafts versioned items against assigned blueprint cells.
4. Independent SME reviews accuracy and rationale.
5. Assessment editor reviews construction, distractors, language, and duplication.
6. Accessibility reviewer checks reading burden, keyboard/screen-reader behavior, media alternatives, and accommodations.
7. Measurement lead simulates forms, sets provisional cut scores, and defines pilot metrics.
8. Publisher performs the guarded single-assessment release and archives the immutable release bundle.
9. Operations monitors disputes, exposure, drift, takedowns, and scheduled refresh.

No person may self-approve their authored item. Reviewer identity, timestamps, source evidence, and hashes are recorded by the system, not asserted in free text after release.

## Quality and measurement gates

Before release: zero unresolved rights issues; zero known answer defects; full blueprint coverage; required pool ratio; duplicate/similarity review; form simulations; accessibility acceptance; documented cut-score decision; rollback/takedown owner.

After release: monitor completion, omission, item difficulty, discrimination, distractor performance, timing, exposure, complaints, and differential performance where sample size permits responsible analysis. Quarantine suspicious items immediately; do not silently rewrite released items. Create a new version and preserve prior evidence.

## Delivery phases

- **0–4 weeks — control system:** release-bundle schema, role separation, provenance tooling, single-assessment guarded publication, JSONL conversion, similarity checks, and review queues.
- **6–10 weeks — pilots:** no more than two certification pilots and two Practice dry runs. Validate operational review and takedown before scaling.
- **3–6 months — initial portfolio:** 10–20 narrow vendor-neutral releases, only at the rate qualified review and pilot evidence support.
- **6–12 months — measured expansion:** expand domains with stable reviewer benches, calibrated templates, exposure controls, and quarterly refresh.
- **12–24 months — 100+/100+:** reach scale only after release throughput, dispute handling, psychometrics, and rights operations have demonstrated reliability.

Planning assumption: approximately 24–32 FTE-equivalents across assessment design, SMEs, editorial, rights, accessibility, measurement, engineering, and operations, plus a qualified external SME bench. This is capacity guidance, not a reason to lower gates.

## Current repository/data status

The previously audited configured database was local development, not production. It had 23 public active approved rows and 52 pending/inactive rows, including 6,000 dummy questions; those figures do not establish launch readiness. Generated or legacy inventory must remain quarantined until each release bundle passes the controls above. Downloaded third-party documents remain topic/citation-only or quarantined and must not be imported or published without exact entity-level rights.
