# Octamy assessment platform model

This document is the product and engineering contract for assessment ownership,
access, certification, review, and distribution. UI copy and backend rules must
use the same terms.

## 1. Assessment provenance

| Source | Discovery | Who pays | Credential issuer | Reseller eligible |
| --- | --- | --- | --- | --- |
| Octamy in-house (`ownerType=admin`) | Public in-house catalog | Learner purchase or active Octamy All Access pass | Octamy | Yes |
| Creator | Separate creator marketplace | Learner, unless a future commercial agreement sponsors access | Creator by default; Octamy/co-branded only after Octamy approval | No |
| Institute | Private cohort or invite link | Institute | Institute or co-branded under the configured issuer policy | No |

Platform-admin status does not silently grant access to creator or institute
tenant data. Admins use explicit review/admin workflows.

## 2. Learner plans

The proposed **Octamy All Access** plan is ₹1,999 per month and covers active,
subscription-eligible Octamy in-house assessments. It does not include creator
inventory until a creator payout-pool and usage-attribution policy is approved.
Institute assessments are sponsored by the institute and never ask invited
students for assessment or credential payment.

A paid pass must create a server-side entitlement only after a verified payment
provider event. The client never decides price, eligibility, or expiry.

## 3. Certification governance

- `owner`: the creator or institute is the named issuer.
- `octamy`: Octamy is the named issuer; non-admin content requires completed
  Octamy content/assessment review.
- `co_branded`: Octamy and the approved institute/creator are shown together;
  non-admin content requires completed Octamy review.

Selecting an issuer in a form is a request, not approval. Published certificate
copy must derive from the approved server record.

## 4. Audience and taxonomy

Categories are hierarchical. Initial root areas are School, Competitive Exams,
and Professional Skills. Initial audience bands are non-overlapping:

- Grades 1–5
- Grades 6–10
- Grades 11–12
- Undergraduate
- Postgraduate
- Competitive-exam aspirant
- Professional

Subjects/exam families are child categories (for example Mathematics, English,
Physics, Chemistry, SSC, NEET, and UPSC). This taxonomy is extensible; it does
not imply that expert-reviewed content already exists in every category.

## 5. Exam seriousness and review

Every assessment declares its purpose and review policy:

- `practice`: learning-oriented; immediate answer/explanation review is allowed.
- `certification`: scored evidence; review may be after final attempt or delayed.
- `high_stakes`: scheduled/proctored; default is score-only until the exam window
  closes, and the owner may keep the answer key hidden.

Answer review is generated from the server-side attempt snapshot, never from a
client-supplied answer key. Retakes obey maximum-attempt and cooldown rules.
Question and option order are stable within an attempt and rotate between
attempts. Image questions require accessible alt text.

## 6. Question-bank quality

Question banks support image questions, difficulty, explanations, topics,
version history, import preview, and blueprint-based rotation. A publishable
assessment needs enough active, reviewed questions for its configured attempt
size and rotation factor. AI may create draft questions, explanations, tags,
and alt-text suggestions, but a human author must review and explicitly approve
them before they can enter a live bank.

“All subjects” and “all government exams” is an editorial/content-operations
program, not a code-only feature. Octamy needs subject-matter experts, syllabus
versioning, source/licensing records, accuracy review, and scheduled refreshes.

## 7. Institute delivery

Institutes manage cohorts and students, create private scheduled exams, and send
invite links to eligible students. Cohort membership and exam windows are
enforced server-side. Email delivery may use configured SMTP. SMS/WhatsApp must
remain unavailable until a provider, consent wording, templates, and delivery
webhooks are configured.

## 8. Protected ebooks and PDFs

Non-preview PDF lessons require an active server-side entitlement. The viewer
uses short-lived access, inline delivery, user watermarking, and hides ordinary
download/print controls. These measures deter casual redistribution; no web
application can guarantee that a user cannot take screenshots or capture bytes
on a device they control. Product copy must not promise impossible DRM.

## 9. AI and privacy boundaries

OpenAI calls are server-side, schema-constrained, rate-limited, and audited
without storing raw prompts in application logs. Authors are warned not to send
student personal data or confidential material. AI never auto-publishes course
content, scored questions, certificates, recruiter decisions, or misconduct
findings.
