# Octamy enterprise product and assessment model

This is the product and engineering contract for Octamy. Runtime behavior,
admin workflows, database design, public copy, and operational processes must
preserve these domain boundaries.

## 1. What Octamy is

Octamy is a multi-sided learning, examination, certification, and talent
discovery platform:

- learners take practice exams, governed certification exams, courses, and AI
  interviews;
- learners may earn verifiable Octamy, creator, or institute credentials after
  satisfying the relevant assessment and commercial rules;
- recruiters discover learners and access only evidence the learner is allowed
  to share;
- creators publish and sell courses, videos, and other supported learning
  products;
- institutes, coaching centres, companies, and individual exam owners create
  exams, use eligible question banks, maintain private banks, import questions,
  and invite their learners to participate.

Octamy is not only a course marketplace and not only an assessment site.
Course commerce, examinations, credentials, interview practice, and recruiter
evidence are related domains with different authorization and fulfillment
rules.

## 2. Domain boundaries

| Domain | Primary records | Main actors | Fulfillment |
| --- | --- | --- | --- |
| Learner identity and progress | users, attempts, progress, achievements | learner | account-scoped history |
| Practice | practice assessments, blueprints, attempts, Practice Pass | learner, Octamy | preparation and answer review; no recruiter credential |
| Certification | certification assessments, attempts, certificates | learner, issuer | governed exam followed by eligible credential activation |
| Institute exam delivery | exam instances, cohorts, invitations, private banks | institute, instructor, student | scheduled/private exam participation and results |
| Creator learning commerce | courses, videos, lessons, entitlements, orders | creator, learner | paid/free content access |
| Question governance | banks, questions, versions, provenance, reviews | author, reviewer, institute | approved content selected through a blueprint |
| AI Interview Studio | templates, sessions, responses, evaluation jobs | learner, authorized reviewer | practice or verified rubric-based interview evidence |
| Recruiter discovery | recruiter profile, wallet, saved search, evidence grants | recruiter, learner | consent-bound discovery and contact |
| Leaderboards and evidence | achievements, eligible scores, grants, access logs | learner, recruiter | policy-controlled visibility; practice remains separate |
| Commercial offers | plans, prices, entitlements, coupons, payments | learner, creator, institute, recruiter | server-priced and provider-verified access |

A generic database record may be shared where useful, but domain behavior must
not be inferred from a page label. Server-side purpose, ownership, issuer,
visibility, and entitlement fields are authoritative.

## 3. Database authority

The production database is the source of truth for:

- assessment, course, interview-template, and commercial-offer names;
- categories, subcategories, audience bands, ordering, descriptions, and SEO
  metadata;
- syllabus versions, topics, blueprints, question pools, questions, answer
  options, correct answers, explanations, difficulty, provenance, and review
  state;
- prices, original/list prices, sale state, plan duration, entitlements,
  availability, and publication state;
- issuer, owner, tenant, reviewer, approval, and audit information.

Application files may contain validation rules, state machines, generic UI
components, and historical append-only migrations. Production deployment must
never synchronize or overwrite catalog data from source-controlled arrays.
Changing catalog business data must not require an application deployment.

## 4. Assessment types and ownership

### Octamy certification

- Public, job-relevant exam.
- Questions rotate from an assessment-specific approved bank and blueprint.
- Passing may make the learner eligible to activate a verifiable credential.
- Recruiter evidence is disclosed only under the applicable visibility and
  consent policy.

### Octamy practice

- Learner preparation product accessed through Practice Pass where configured.
- Repeated attempts and answer review are expected.
- Practice results and badges must not be represented as Octamy certification
  evidence.
- Grade 1–10 school assessments are outside the current first-party Octamy
  practice portfolio and remain unpublished through database publication
  state, not title-matching application code.

### Creator assessment or course

- Owned by its creator tenant.
- Creator courses and videos are commerce products, not Practice Pass exams.
- Creator-issued credentials are clearly attributed; Octamy co-certification
  requires an explicit governed approval record.

### Institute exam

- Owned by the institute or authorized individual workspace.
- May use banks made available to that workspace and its own private banks.
- Supports question entry, governed import, blueprint selection, cohorts,
  invitations, exam windows, attempts, and reporting.
- Invited learners are not asked to buy an Octamy credential unless a separate,
  explicit eligible offer applies.

## 5. Question and publication governance

Every live assessment must have:

1. a confirmed, versioned syllabus;
2. an assessment-specific question bank;
3. professional wording, answer options, correct answer, explanation, topic,
   difficulty, and relevance;
4. attributable review and rights/provenance evidence;
5. an approved blueprint with a rotation pool larger than the attempt draw;
6. immutable attempt snapshots and server-side scoring;
7. a successful publication gate and operational verification.

Recommended minimum rotation ratios remain format-dependent:

- draw 10 from approximately 50;
- draw 25 from approximately 100;
- draw 50 from approximately 200.

Questions cannot be activated merely because they were generated or imported.
AI output is draft content until a qualified human approves it. Retired content
may be reused only after correction, relevance review, and attachment to the
proper bank.

## 6. Commercial offers and sale pricing

Commercial plan names, features, prices, durations, availability, and purchase
rules are database-managed.

For an item with a current price and optional original/list price:

- `original_price > price` means the current price is a sale price;
- the database derives `is_on_sale`;
- `original_price < price` is invalid;
- strike-through price and savings are shown only when both amounts make the
  discount truthful;
- code never invents an original price.

Practice Pass is a learner examination product. The learner sees plans before
login or registration, then chooses an account action after selecting a plan.
It does not appear as a creator course.

## 7. Language and public experience

- Assessment and exam pages use “exam” or “assessment,” not “course.”
- Creator learning products may use “course,” “video,” “lesson,” or their real
  product type.
- Public names are the exact approved database names; UI code does not rewrite
  them with suffix or slug rules.
- Public category navigation is built from the live database hierarchy and
  shows only taxonomy relevant to the current catalog.
- Cards and checkout show the current price, truthful original price/savings
  when applicable, and the allowed login, registration, or guest action.

## 8. Recruiter, leaderboard, and AI boundaries

- Recruiter discovery uses eligible learner profile and certification evidence,
  not private practice answers or institute-only results.
- Evidence access is purpose-bound, expires, can be revoked, and is audited.
- Leaderboards state exactly which governed event or evidence qualifies a
  learner; practice repetition must not masquerade as certification rank.
- AI Interview Studio separates practice sessions from verified sessions.
- AI does not auto-publish questions, issue credentials, make hiring decisions,
  or infer protected traits, honesty, emotion, accent quality, or culture fit.
- Test-case-based coding practice uses the controlled compiler runtime, resource
  limits, deterministic test cases, and persisted evaluation evidence.

## 9. Enterprise refinement order

1. Remove remaining hardcoded commercial plans, prices, features, and credit
   packs from runtime code and manage them through database/admin contracts.
2. Split the oversized legacy route modules into assessment, institute,
   commerce, subscription, recruiter, and learner services without changing
   public API contracts.
3. Introduce explicit product/offer and assessment detail boundaries so course
   fields are not the universal model for every product.
4. Centralize tenant authorization, RBAC, audit events, publication state
   machines, payment idempotency, and entitlement fulfillment.
5. Replace historical catalog import utilities with generic, database-targeted
   admin import workflows; retain immutable migrations only as history.
6. Complete assessment content operations one assessment at a time and publish
   only after the release contract above is satisfied.
