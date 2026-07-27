# Recruiter-Selected Evidence Grants

## Status

Implemented in migration `0032_recruiter_evidence_grants`, Drizzle schema, learner/recruiter APIs, learner UI, append-only access history, and focused policy tests. Production release remains subject to applying the migration through the guarded deploy and verifying readiness against the production database. Global `profileVisibility` remains discovery consent only; it does not authorize evidence disclosure. Practice answers and Interview Studio sessions remain private and excluded.

## Privacy contract

A recruiter may receive only evidence a learner selected for that recruiter and purpose. A grant is purpose-bound, expiring, revocable, tenant-isolated, and auditable. Profile unlock/credits do not create consent. Withdrawing discovery visibility stops discovery, but grant revocation is independently authoritative for evidence access.

Never return answers, question IDs/content, IP address, user agent, raw integrity events, recordings, transcripts, hidden tests, device data, candidate-wide activity, global last-active time, or Interview Practice.

## Implemented data model

`candidate_evidence_grants`

- `id` (opaque UUID)
- `learner_user_id`
- `target_recruiter_id`
- `purpose` and optional `job_reference`
- `scopes`: `certification`, `practice_summary`, optional reviewed `integrity_summary`
- selected `certificate_ids`
- selected `attempt_ids`
- `consent_version`
- `granted_at`, `expires_at`, `revoked_at`
- immutable creation metadata and optimistic version

`candidate_evidence_access_events` (append-only)

- grant, learner, recruiter, action, occurred time
- selected evidence identifiers/scope summary only
- request/audit correlation and policy version
- no raw evidence payload or unnecessary network/device identifiers

Use normalized grant-item rows rather than JSON arrays if operational querying or referential enforcement requires it. Database constraints must enforce valid statuses/times; indexes must support active grant lookup by recruiter/learner and learner access history.

## Learner APIs/UI

- List active recruiters eligible to receive a grant only after a legitimate recruiter/job interaction.
- Preview exact fields that will be shared.
- Create a grant with selected current certification credentials and, only when released, selected non-Interview Practice summaries.
- Default expiry to a short period; cap duration by policy.
- List, revoke, and inspect access history.
- Show recruiter company, purpose/job reference, exact selected evidence, granted/expiry/revoked times, and every access.
- Revocation takes effect on the next read; no cached recruiter payload may outlive grant policy.

## Recruiter API/UI

The selected-candidate endpoint revalidates on every request:

1. recruiter token, active workspace, and approved KYC;
2. recruiter/candidate profile access policy;
3. active, unexpired, unrevoked grant targeting this exact recruiter;
4. each selected item is still learner-owned and eligible;
5. certificate is active, paid, unexpired, and certification-purpose;
6. any Practice summary is from a Practice-purpose assessment and is explicitly in scope;
7. institute restrictions and learner discovery state where applicable.

Return only selected summaries. Do not return evidence from another grant, recruiter, tenant, or candidate. Record a learner-visible append-only access event after authorized disclosure.

## Minimum test gate

- cross-recruiter, cross-learner, and cross-tenant denial;
- expiry and immediate revocation;
- withdrawn profile visibility behavior;
- certificate ownership, purpose, active/paid/expiry revalidation;
- Practice answer/raw-event exclusion;
- Interview Studio exclusion;
- empty grant returns no evidence;
- access history append-only and learner-visible;
- cache headers prevent stale disclosure;
- concurrent revoke/read behavior fails closed;
- no global activity or `lastActive` fields.

Production disclosure remains gated on successfully applying migration `0032`, preserving the no-store/access-history transaction invariants, and passing deployment readiness. Legacy recruiter search/profile APIs continue to expose no certificate, Practice, Interview, or global activity evidence through `profileVisibility` or profile-unlock records.
