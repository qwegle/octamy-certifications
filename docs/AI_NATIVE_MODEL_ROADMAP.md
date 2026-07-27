# Octamy AI and Native-Model Roadmap

## Principles

AI assists people; it does not approve assessment content, publish products, activate payments, issue credentials, or make irreversible hiring decisions. Every AI feature has a named owner, bounded purpose, approved data classes, versioned prompts/models, offline evaluation, runtime monitoring, kill switch, and human escalation path.

Do not train on learner answers, CVs, recordings, interviews, or recruiter activity without separate informed consent, a documented lawful purpose, retention limits, opt-out, and deletion propagation. Never infer emotion, personality, honesty, accent quality, protected traits, culture fit, or employability from face, voice, text, or behavior.

## Phase 1 — AI control plane

Build a server-only gateway before adding more product features:

- provider/model allowlists and environment-specific routing;
- prompt, policy, model, and evaluation-set versions on every run;
- per-workspace quotas, budgets, timeouts, retries, and circuit breakers;
- PII/secret detection and data-class policy before outbound calls;
- minimum necessary payload construction and configurable zero-retention providers;
- privacy-safe telemetry without raw learner content by default;
- deterministic fallbacks and visible unavailable states;
- feature/workspace kill switches;
- offline gold sets, regression thresholds, red-team cases, and release approvals;
- human-review queues and immutable decision/audit records.

Keys stay server-side and never use `VITE_` variables. Provider return values are untrusted and schema-validated. Prompt injection in uploaded or retrieved sources cannot alter system policy or authorize tools.

## Phase 2 — low-risk, high-value assistance

1. **Assessment-quality copilot:** drafts blueprint-aligned items, rationales, distractor critiques, duplicate warnings, and accessibility suggestions grounded only in approved source passages. It cannot mark rights/review complete or publish.
2. **Mastery recommendations:** deterministic competency gaps select approved resources; an optional model may rewrite the explanation but cannot change the underlying recommendation.
3. **Support assist:** retrieves cited internal policy/product passages, drafts a response, and requires a human to send it.
4. **Content operations:** classify incoming material, detect likely duplicates/PII, and route review tasks. Human reviewers decide disposition.

Required metrics include citation support, unsupported-claim rate, reviewer acceptance/edit rate, subgroup error checks where appropriate, latency, cost, and safe-fallback rate.

## Phase 3 — controlled medium-risk features

- **Grant-bound recruiter requirement parser:** turn a recruiter's role description into transparent competency requirements, then compare only evidence the selected learner explicitly granted to that recruiter. Return coverage and gaps, never a hire/rank/culture-fit score.
- **Interview Studio calibration:** evaluate private Practice responses against SME gold sets. Show rubric-grounded feedback and uncertainty. Escalate low confidence; keep Practice unshareable.
- **Integrity anomaly assistance:** explain deterministic anomalies to authorized human reviewers. Never auto-fail based on model inference and never use emotion, gaze, face, or accent scoring.
- **Authoring retrieval:** retrieve only approved, rights-cleared source chunks with citations and source/version filters. Drafts remain unpublished.

## Selective self-hosted/native models

Do not build a foundation model. Adopt narrowly where privacy, latency, or unit economics justify operational ownership:

- multilingual embeddings and rerankers for approved-source retrieval;
- PII/secret classifiers and deterministic redaction pipelines;
- narrow speech-to-text models for consented transcription with immediate audio deletion;
- duplicate/similarity detection for item governance;
- operational forecasting for review queues, support load, and inventory refresh.

Candidate models must pass license, provenance, security, language, latency, hardware, and quality review. Pin exact model artifacts and hashes. Run inference in isolated services with resource limits, no arbitrary code execution, and no internet egress unless explicitly required.

## Evaluation and release gates

Every feature ships through: threat model → data protection review → gold-set definition → baseline comparison → subgroup and adversarial evaluation → human workflow trial → limited rollout → monitored expansion.

Block release when any of these is missing: model/prompt versioning, representative gold set, unsupported-output threshold, privacy review, user disclosure, opt-out where applicable, human escalation, cost cap, rollback, or deletion behavior.

For hiring-adjacent features, additionally require purpose-specific candidate consent, recruiter tenant isolation, evidence-grant enforcement, access logs visible to the learner, expiry/revocation tests, and an explicit prohibition on automated final decisions.

## Current-state priorities

The repository currently uses OpenAI for generation/evaluation/transcription but has no general product RAG, embeddings stack, classical ML platform, self-hosted model platform, or foundation model. Priority order is therefore:

1. control plane and evaluation harness;
2. grounded assessment-quality copilot;
3. deterministic learner recommendations with optional wording assistance;
4. cited human-sent support assist;
5. grant-bound recruiter requirement coverage;
6. calibrated Interview Studio feedback;
7. selective self-hosted retrieval, PII, speech, and operations models.

No new high-risk AI feature should precede the recruiter evidence-grant model or the content release controls.
