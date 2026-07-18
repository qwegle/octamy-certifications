# Assessment release acceptance

This is the fail-closed release procedure for every Octamy-owned assessment. A
question being syntactically valid is not evidence that its answer is true.
Automated checks find structural defects; a named subject-matter reviewer owns
the factual decision for the exact version that goes live.

## Per-question evidence contract

Every release candidate must carry all of the following for its latest version:

- a stable syllabus version and competency/objective code;
- an attributable author and a different attributable reviewer;
- a timestamped approval of the exact, unedited version;
- the answer-verification method and a primary/authoritative reference or an
  independently reproduced calculation;
- an explanation showing why the key is correct;
- for MCQs, a reviewer note confirming that distractors are plausible,
  unambiguous, and not alternate correct answers;
- topic, difficulty, provenance, and content identity.

AI generation, an import completing successfully, or a reviewer service account
does not satisfy factual review. An edit invalidates the prior approval.

`evaluateAssessmentContentAcceptance` produces the per-assessment release
report. Store the report with the release record and require zero blockers.

## Bank and blueprint acceptance

1. Freeze the applicable syllabus/official-notification version and map every
   live blueprint row to explicit objectives.
2. Import only to a private, inactive bank. Reject malformed rows before write.
3. Review every stem, key, distractor, explanation, difficulty, language, and
   accessibility concern. Sampling is insufficient for answer correctness.
4. Reject exact duplicates, placeholder language, keyword-swapped questions,
   substitution-template concentration above the gate, and answer-position
   leakage. Numeric variants may remain only when they test meaningfully
   different reasoning and the reviewer records that judgment.
5. Meet each topic and difficulty quota, not merely the bank-wide total.
6. Meet rotation inventory: certification requires `max(80, draw × 4)` and
   practice requires `max(200, draw × 5)`. The multiplier applies at every
   blueprint scope. An 80-question certification exam therefore needs 320
   eligible questions; an 80-question bank supports at most a 20-question draw.
7. Run a representative attempt, scoring, timing, accessibility, mobile, and
   recovery test. Confirm no retired/pending question can be selected.
8. Activate the bank only after evidence is complete, then publish the
   assessment through the guarded mutation. Never update database publication
   fields directly.

## Inventory release order (125 assessments)

No current shell is implicitly approved. Apply the process separately to each
row; sharing a topic bank does not share factual approval.

### P0 — lowest-risk controlled pilots

- **Grade 3 Mathematics Practice:** first practice pilot, using an exact
  age-banded syllabus. Verify vocabulary and cognitive load; 25 questions per
  topic permits a five-question draw per topic, not 25.
- **Git and Linux Developer Workflows:** first certification pilot. Commands
  must be verified against current Git, Bash, GNU/coreutils, systemd and Linux
  manuals. Balance answer positions and shell-platform assumptions.

These pilots prove the evidence/import/review/attempt workflow. They do not
authorize publication of adjacent assessments.

### P1 — school and deterministic numerical practice

- Grade 4, 5, 6, 7, 8, 9 and 10 Mathematics Practice.
- Grade 11 and 12 Physics Numerical Practice.
- Grade 11 and 12 Chemistry Numerical Practice.

Release one grade/subject at a time against the named curriculum edition. Grade
1 and 2 diagnostics remain private until a child-appropriate, untimed blueprint
and accessibility review exist.

### P2 — competitive-exam practice

- SSC CGL Tier I, SSC CHSL Tier I and SSC MTS quantitative/numerical practice.
- RRB NTPC and RRB Group D mathematics practice.
- IBPS PO and IBPS Clerk quantitative aptitude practice.
- NEET (UG) and JEE Main physics numerical practice.
- NEET (UG) and JEE Main chemistry numerical practice.

Each needs its own current official-notification mapping. A shared arithmetic or
science template pool is not proof of exam-specific fit.

### P3 — vendor-neutral career foundations

- AI at Work, prompt engineering, machine learning, SQL/BI, Python data
  analysis, advanced SQL, data engineering, generative-AI application
  engineering, and RAG/evaluation.
- Python, Node.js, Java/Spring, C#/.NET, TypeScript, React, API/microservices,
  software testing/QA, Docker, Terraform and SRE.
- Cybersecurity, cloud security, SOC analysis, application security, IAM, and
  incident response/threat analysis.
- Business analysis, product management, Agile/Scrum, technical project
  management, IT support, Linux administration, and networking support.

Use scenario-based questions and version references. Split broad shells when a
single defensible syllabus cannot cover the title.

### P4 — vendor/platform career assessments

- SAP S/4HANA Finance, MM Procurement, Sales and Distribution, and ABAP.
- Oracle Cloud Financials and Supply Chain.
- Salesforce Administration and ServiceNow Administration.
- AWS Cloud Foundations and Solutions Architecture.
- Azure Foundations and Administration.

These are last because product behavior changes and trademarked exam domains
need a dated authoritative-source review. Octamy wording must not imply official
vendor endorsement or use recalled exam questions.

### P5 — legacy broad shells (redefine or retire, never restore old content)

- AI: Machine Learning Fundamentals; Deep Learning & Neural Networks; Natural
  Language Processing; Computer Vision; AI Ethics & Governance.
- Development: Web Development Basics; Frontend Frameworks; Backend
  Development; DevOps & Cloud; Mobile App Development.
- Business: Business Strategy Fundamentals; Operations Management; Strategic
  Leadership; Innovation Management; Entrepreneurship.
- Data: Data Analytics Basics; Statistical Analysis; Big Data Processing; Data
  Science Architecture; Business Intelligence.
- Design: Design Principles; UI/UX Design; Advanced Prototyping; Design
  Leadership; Brand Identity.
- Marketing: Digital Marketing Basics; Content Marketing; Performance
  Marketing; Growth Hacking; Social Media Strategy.
- Security: Security Fundamentals; Network Security; Ethical Hacking; Security
  Architecture; Incident Response.
- Finance: Financial Fundamentals; Investment Analysis; Corporate Finance; Risk
  Management; Fintech Innovation.
- Delivery: Project Management Basics; Agile Methodology; Program Management;
  Strategic PMO; Digital Transformation.
- Internship-labelled shells: Software Engineering Assessment Program; Data
  Science Internship; Marketing Internship; Business Analyst Internship; UX
  Design Internship.

These 50 titles originated as broad catalogue shells and previously used
keyword-swapped question templates. Before authoring, give each a versioned
syllabus, narrow learning claims, and decide whether it is an assessment at all.
“Internship” titles must not imply work experience when they only deliver a
quiz. Until that product decision is recorded, they remain private and pending.

## Release record

For each assessment retain: assessment slug and revision, bank IDs and content
hashes, blueprint revision, syllabus references, acceptance report, author and
reviewer IDs, review timestamps, rejected-item log, representative-attempt QA,
and the final publisher identity/time. Any question, key, syllabus, blueprint,
or scoring change creates a new release candidate and reruns the full gate.
