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

## Production certification-shell triage — 2026-07-29

### Method and evidence legend

Production was inspected through the requested `127.0.0.1:15443` SSH tunnel in a PostgreSQL `REPEATABLE READ READ ONLY` transaction with a 30-second statement timeout. The cohort predicate was `product_type='assessment' AND assessment_purpose='certification' AND is_active=false AND visibility='private' AND review_status='pending'`; it returned exactly 61 rows. Evidence below is `created; B=blueprint rows; K=referenced banks; Q=bank/direct questions; A=legacy+scheduled attempts; C=certificates; P=payments`. The live comparison cohort was active/public/approved certification assessments and contained 39 rows. Counts are `DUPLICATE_OF_LIVE=8`, `LEGACY_EMPTY=6`, `ENTERPRISE_CANDIDATE=10`, `NEEDS_DECISION=37`.

### Exhaustive 61-shell decision table

| ID / shell | Read-only evidence | Classification and evidence or missing decision |
|---|---|---|
| 23 `advanced-prototyping` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide whether advanced design-system/prototyping proficiency is a certification claim worth a blueprint and SME budget. |
| 42 `agile-methodology` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `agile-scrum-delivery-foundations`; both cover Agile/Scrum, sprint planning/events and iterative delivery; the live replacement has an 80-item governed bank. |
| 5 `ai-ethics-governance` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide standalone responsible-AI governance certification versus treating this as a domain inside `ai-fundamentals-for-work`. |
| 8 `backend-development` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **LEGACY_EMPTY** — broad language-neutral shell superseded by governed Node.js, Python, Java/Spring, C#/.NET and API/microservices certifications. |
| 18 `big-data-processing` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `data-engineering-foundations`; both claim Spark/distributed processing and data pipelines; live bank has 80 items. |
| 25 `brand-identity` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide whether subjective brand-strategy/design evidence can support a defensible scored certification and rubric. |
| 112 `business-analyst-digital-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct BA claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 49 `business-analyst-internship` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide whether “internship” means completion/placement evidence rather than certification; define issuer and claim before content. |
| 20 `business-intelligence` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `power-bi-data-analyst-skills`; dashboards, reporting, analysis and data-driven decisions overlap; live bank has 80 items. |
| 11 `business-strategy-fundamentals` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide target role, observable strategy competencies and whether this broad claim belongs in the portfolio. |
| 4 `computer-vision` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide vendor-neutral CV theory versus implementation skill and required practical evidence. |
| 27 `content-marketing` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide measurable competency claim, platform neutrality and assessment format. |
| 38 `corporate-finance` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide jurisdiction, target role and authoritative finance syllabus before blueprinting. |
| 16 `data-analytics-basics` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **LEGACY_EMPTY** — broad umbrella superseded by governed Python analysis, Power BI and advanced SQL products plus the narrower pending SQL/BI foundation. |
| 106 `data-analytics-sql-bi-foundations` | 2026-07-15; B1 K1 Q80 A0 C0 P0 | **NEEDS_DECISION** — preserve content; release owner must resolve the known governance/content blocker and decide guarded release versus remediation, never archive as empty. |
| 19 `data-science-architecture` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **LEGACY_EMPTY** — overly broad pipeline/MLOps/engineering shell superseded by governed Data Engineering, ML, SRE and GenAI engineering claims. |
| 47 `data-science-internship` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define whether internship completion is institution-issued experience evidence or an Octamy skills assessment. |
| 2 `deep-learning-neural-networks` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide theory versus framework implementation scope and advanced prerequisites. |
| 24 `design-leadership` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide target leadership level and whether scenario/rubric evidence, not MCQ-only evidence, is required. |
| 21 `design-principles` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide objective foundation claim, accessibility scope and portfolio/practical evidence model. |
| 9 `devops-cloud` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `devops-ci-cd-foundations`; CI/CD, containers and cloud delivery overlap; live bank has 80 items. |
| 26 `digital-marketing-basics` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide channel-neutral foundation scope and source-refresh cadence. |
| 45 `digital-transformation` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide practitioner role, change-management framework and measurable transformation claim. |
| 15 `entrepreneurship` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide whether knowledge testing can substantiate entrepreneurship or whether this should be a course/project review. |
| 33 `ethical-hacking` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide legal lab boundary, hands-on evidence and distinction from live application-security coverage. |
| 36 `financial-fundamentals` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide personal, accounting or corporate-finance scope and jurisdiction. |
| 40 `fintech-innovation` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide durable competency scope versus rapidly changing product/trend knowledge and regulatory jurisdiction. |
| 7 `frontend-frameworks` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **LEGACY_EMPTY** — broad React/Vue/Angular umbrella superseded by narrower governed JavaScript/React and React engineering certifications. |
| 29 `growth-hacking` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide ethical claim wording, measurable experimentation skills and whether to retire the “hacking” label. |
| 35 `incident-response` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `incident-response-threat-analysis`; direct response/forensics/recovery overlap; live bank has 80 items. |
| 14 `innovation-management` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — choose an authoritative innovation framework, target role and practical evidence model. |
| 37 `investment-analysis` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide jurisdiction, advisory disclaimer, target role and approved finance syllabus. |
| 1 `machine-learning-fundamentals` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `machine-learning-foundations`; both cover supervised/unsupervised learning and model evaluation; live bank has 80 items. |
| 48 `marketing-internship` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define experience issuer, completion evidence and whether any scored assessment is appropriate. |
| 10 `mobile-app-development` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — choose iOS, Android or cross-platform claim and practical build evidence. |
| 3 `natural-language-processing` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define classical NLP versus LLM scope and distinction from live GenAI/RAG products. |
| 32 `network-security` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **LEGACY_EMPTY** — broad old shell is split across governed Networking Support, Cloud Security, Application Security and IAM certifications. |
| 12 `operations-management` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide industry, operations framework and distinction from ERP supply-chain candidates. |
| 185 `oracle-cloud-supply-chain-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct Oracle SCM claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 97 `oracle-erp-cloud-financials-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct Oracle Financials claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 28 `performance-marketing` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — choose platforms, attribution assumptions and refresh policy before making a durable claim. |
| 113 `product-management-tech-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct technical-product claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 43 `program-management` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide framework, seniority and distinction from live technical project management. |
| 41 `project-management-basics` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `technical-project-management-foundations`; lifecycle/planning/resources/stakeholders overlap; live bank has 80 items. |
| 39 `risk-management` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — choose financial versus enterprise risk, jurisdiction and target role. |
| 98 `salesforce-crm-admin-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct Salesforce admin claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 184 `sap-abap-development-skills` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct ABAP/clean-core claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 96 `sap-mm-procurement-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct SAP procurement claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 95 `sap-s4hana-finance-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct SAP Finance claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 183 `sap-s4hana-sales-distribution-skills` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct SAP sales/distribution claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 34 `security-architecture` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define architect seniority, framework and distinction from live cloud/application/IAM certifications. |
| 31 `security-fundamentals` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **DUPLICATE_OF_LIVE** → `cybersecurity-foundations`; both claim basic threats, risk, policy and controls; live bank has 80 items. |
| 186 `servicenow-administration-foundations` | 2026-07-15; B1 K1 Q0 A0 C0 P0 | **ENTERPRISE_CANDIDATE** — distinct ServiceNow admin claim; draft 10-item-draw blueprint/bank exists but contains no items. |
| 30 `social-media-strategy` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — choose platforms, commercial-use sources and mandatory update cadence. |
| 46 `software-engineering-internship` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define institution/employer completion evidence; do not imply an internship from a quiz. |
| 17 `statistical-analysis` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide applied-statistics depth, prerequisites, tooling and calculation evidence. |
| 13 `strategic-leadership` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define level and scenario/360-degree evidence rather than an unsupported knowledge-only claim. |
| 44 `strategic-pmo` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — decide PMO framework, organization maturity level and target leadership role. |
| 22 `ui-ux-design` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define research/design/accessibility scope and portfolio-based evidence requirement. |
| 50 `ux-design-internship` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **NEEDS_DECISION** — define experience issuer and artifact review; a certification attempt cannot prove internship completion. |
| 6 `web-development-basics` | 2026-05-08; B0 K0 Q0 A0 C0 P0 | **LEGACY_EMPTY** — broad old web shell superseded by governed JavaScript/React, React engineering and TypeScript certifications. |

No shell has learner history: every row has A0/C0/P0. If later revalidation finds any attempt, certificate or payment, that row must be removed from archival scope and preserved permanently.

### Enterprise candidate build queue

Every candidate currently draws 10, so 4× rotation is 40; the certification-program floor is higher. Build **80 independently reviewed active items per candidate** (8× current draw), with versioned topic-level blueprint rules, source register, rationales and all governance gates. Recommended effort order reflects source clarity, reusable reviewer availability and broad employer demand.

| Order / candidate | Required topic breakdown (80-item target) | Existing authoritative syllabus/reference anchor |
|---|---|---|
| 1 `salesforce-crm-admin-foundations` | Setup/configuration; Object Manager/App Builder; sales/service apps; users/access/security; data management; reports/dashboards; automation (about 10–12 each). | Salesforce [Platform Administrator credential and official prep](https://trailhead.salesforce.com/en/credentials/administrator). |
| 2 `servicenow-administration-foundations` | UI/navigation; instance configuration; application configuration; self-service/automation; database/data management; migration/integration; access/security. | ServiceNow [CSA Mainline Exam Blueprint](https://nowlearning.servicenow.com/kb?id=kb_article_view&sysparm_article=KB0011554). |
| 3 `business-analyst-digital-foundations` | planning/monitoring; elicitation/collaboration; requirements lifecycle; strategy analysis; requirements/design analysis; solution evaluation; agile/process/acceptance practice. | IIBA [ECBA exam blueprint](https://www.iiba.org/globalassets/certification/ecba/files/ecba-exam-blueprint.pdf) and BABOK Guide v3. |
| 4 `product-management-tech-foundations` | discovery/market evidence; strategy/business case; prioritisation/roadmaps; requirements/outcomes; delivery collaboration; metrics/experiments; launch/lifecycle. | AIPMM [Certified Product Manager competency scope](https://aipmm.com/cpm) and ProdBOK. |
| 5 `sap-s4hana-finance-foundations` | organization/master data; universal journal/GL; AP; AR; assets; close/reporting; controls/integration. | SAP [Implementing Financial Accounting in SAP S/4HANA Cloud](https://learning.sap.com/learning-journeys/implementing-financial-accounting-in-sap-s4hana-cloud). |
| 6 `sap-mm-procurement-foundations` | org/material/business-partner data; requisition/sourcing; purchasing documents; goods movements/inventory; invoice verification; analytics/controls/integration. | SAP official [Source-to-Pay learning units](https://learning.sap.com/learning-journeys/explore-integrated-business-processes-in-sap-s-4hana). |
| 7 `sap-s4hana-sales-distribution-skills` | sales org/master data; presales/order processing; pricing; availability; delivery/shipping; billing/returns; integration/analytics. | SAP official [Lead-to-Cash learning units](https://learning.sap.com/learning-journeys/explore-integrated-business-processes-in-sap-s-4hana). |
| 8 `sap-abap-development-skills` | language/types; Open SQL/CDS; OO ABAP; services/RAP; testing/debugging; authorization/security; clean-core extensions. | SAP [Acquiring Core ABAP Skills](https://learning.sap.com/learning-journeys/acquiring-core-abap-skills). |
| 9 `oracle-erp-cloud-financials-foundations` | enterprise structures/ledgers; GL; payables; receivables; assets/cash; accounting/close; reporting/security. | Oracle Financials 26B, [Getting Started with Your Financials Implementation](https://docs.oracle.com/en/cloud/saas/financials/26b/facsf/getting-started-with-your-financials-implementation.pdf). |
| 10 `oracle-cloud-supply-chain-foundations` | product/org data; procurement; inventory; order management; costing/orchestration; planning/fulfilment; analytics/security. | Oracle [Supply Chain & Manufacturing 26B documentation](https://docs.oracle.com/en/cloud/saas/supply-chain-management/26b/index.html). |

These sources establish topic scope, not rights to copy vendor questions. Items must be original and must not claim vendor endorsement or official exam equivalence.

### Safe disposition execution record — blocked, no rows changed

At **2026-07-29 11:21:43 +0530**, the authorized production disposition was attempted through the dedicated `127.0.0.1:15455` tunnel. A single `REPEATABLE READ READ ONLY` pre-check returned all 14 intended IDs and confirmed every row was inactive/private/pending with `B0 K0 Q0 A0 C0 P0`; the aggregate guard result was `target_rows=14`, `safe_rows=14`, `all_14_safe=true`.

The exact prepared statement below was then run inside an explicit transaction. PostgreSQL rejected it before any commit because production constraint `courses_review_status_check` permits only `draft`, `pending`, `approved`, `rejected`, and `suspended`, not `archived`. The transaction aborted and **rows changed = 0**. The constraint was not altered because doing so would create unreviewed production schema drift outside this task's ownership boundary.

A post-attempt read-only check confirmed `archived_targets=0`, all 14 targets remain inactive/private/pending, and the published assessment cohort remained 81 rows with identical fingerprint `db9022f18d5cc4e99e0a8fc409097722`. Public curl comparisons were byte-identical: certification assessments **40 → 40** (`sha256 af7d14d22985290895317e97a53671de3f05fa198e7300201b6738da0193ebdd`) and Practice assessments **41 → 41** (`sha256 c52c26ca0320f9543ea7af2dcb7e1175221bf0f8573ee8516f405381d4127aa7`). The 10 enterprise candidates remain inactive/private/pending; `data-analytics-sql-bi-foundations` remains active/public/approved; no `NEEDS_DECISION` row was targeted. A reviewed migration that adds `archived` to the constraint is required before this exact disposition can succeed.

Do not delete rows. The attempted idempotent, history-failing statement was:

```sql
UPDATE courses AS c
   SET review_status = 'archived'
 WHERE c.id = ANY (ARRAY[42,18,20,9,35,1,41,31,8,16,19,7,32,6])
   AND c.product_type = 'assessment'
   AND c.assessment_purpose = 'certification'
   AND c.is_active = false AND c.visibility = 'private'
   AND c.review_status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM course_question_blueprint b WHERE b.course_id=c.id)
   AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.course_id=c.id)
   AND NOT EXISTS (SELECT 1 FROM exam_attempts a WHERE a.course_id=c.id)
   AND NOT EXISTS (
     SELECT 1 FROM exam_instance_attempts a
     JOIN exam_instances i ON i.id=a.instance_id WHERE i.course_id=c.id
   )
   AND NOT EXISTS (SELECT 1 FROM certificates x WHERE x.course_id=c.id)
   AND NOT EXISTS (
     SELECT 1 FROM payments p LEFT JOIN certificates x ON x.id=p.certificate_id
      WHERE p.course_id=c.id OR x.course_id=c.id
   )
RETURNING c.id, c.slug;
```

If a reviewed schema change permits `archived`, this statement remains idempotent because only unchanged `pending` rows qualify; a second successful run would return none. Its guards preserve invisibility and reject any row that gains content or learner history. `NEEDS_DECISION`, enterprise, and data-analytics rows remain deliberately excluded.

### Safe disposition execution record — applied by migration 0038

At **2026-07-29 11:47 +0530**, `0038_archive_audited_certification_shells` extended `courses_review_status_check` with the truthful `archived` state while retaining every prior allowed state. The guarded migration then archived exactly IDs `1,6,7,8,9,16,18,19,20,31,32,35,41,42`; all remained inactive/private and had zero blueprints, linked banks, questions, legacy or scheduled attempts, certificates, and payments. No rows were deleted.

The production runner verified all 39 journal hashes. Read-only post-checks found exactly those 14—and no other course rows—with `review_status='archived'`. The active/public/approved assessment cohort remained 91 rows with unchanged fingerprint `8b8566136e3b03df7e2d733feaf83a66`. Public curl totals and payload hashes were unchanged: certification assessments **50 → 50** (`8cc0328cd8e9af725ae91e25de0e1f6f03eacd24d3d08521ae19c1e046480735`) and Practice assessments **41 → 41** (`901895bd6705ca068c5f4c456ce00a2f1a57504e1c93dac511c5222e8497079c`). The read-only governed inventory gate exited successfully with `published-with-substantive-blockers: 0`.
