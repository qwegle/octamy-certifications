CREATE TABLE "interview_studio_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL,
  "version" integer NOT NULL,
  "owner_type" text DEFAULT 'admin' NOT NULL,
  "owner_id" integer,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "state" text DEFAULT 'draft' NOT NULL,
  "is_current" boolean DEFAULT false NOT NULL,
  "supported_modes" jsonb NOT NULL,
  "rubric_version" text NOT NULL,
  "blueprint" jsonb NOT NULL,
  "blueprint_hash" text NOT NULL,
  "published_at" timestamp,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_templates_key_version_unique" UNIQUE("template_key", "version"),
  CONSTRAINT "interview_studio_templates_version_check" CHECK ("version" > 0),
  CONSTRAINT "interview_studio_templates_key_check" CHECK ("template_key" ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  CONSTRAINT "interview_studio_templates_owner_check" CHECK (
    ("owner_type" = 'admin' AND "owner_id" IS NULL)
    OR ("owner_type" IN ('creator', 'institute') AND "owner_id" IS NOT NULL)
  ),
  CONSTRAINT "interview_studio_templates_state_check" CHECK ("state" IN ('draft','published','retired')),
  CONSTRAINT "interview_studio_templates_published_check" CHECK (
    ("state" = 'published' AND "published_at" IS NOT NULL)
    OR ("state" <> 'published' AND "is_current" = false)
  ),
  CONSTRAINT "interview_studio_templates_modes_check" CHECK (
    jsonb_typeof("supported_modes") = 'array'
    AND jsonb_array_length("supported_modes") BETWEEN 1 AND 2
    AND "supported_modes" <@ '["practice","verified"]'::jsonb
  ),
  CONSTRAINT "interview_studio_templates_blueprint_check" CHECK (
    jsonb_typeof("blueprint") = 'object'
    AND "blueprint"->>'schemaVersion' = 'interview-studio-blueprint/v1'
    AND "blueprint"->>'templateKey' = "template_key"
    AND ("blueprint"->>'version')::integer = "version"
    AND "blueprint"->>'rubricVersion' = "rubric_version"
  ),
  CONSTRAINT "interview_studio_templates_hash_check" CHECK ("blueprint_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "interview_studio_templates" ADD CONSTRAINT "interview_studio_templates_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
--> statement-breakpoint
CREATE UNIQUE INDEX "interview_studio_templates_current_key_unique"
  ON "interview_studio_templates" ("template_key") WHERE "is_current" = true;
--> statement-breakpoint
CREATE INDEX "interview_studio_templates_owner_state_idx"
  ON "interview_studio_templates" ("owner_type", "owner_id", "state", "created_at");

--> statement-breakpoint
CREATE TABLE "interview_studio_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" integer NOT NULL,
  "template_key" text NOT NULL,
  "template_version" integer NOT NULL,
  "user_id" integer NOT NULL,
  "mode" text NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "blueprint_snapshot" jsonb NOT NULL,
  "blueprint_hash" text NOT NULL,
  "consent_snapshot" jsonb NOT NULL,
  "permission_snapshot" jsonb NOT NULL,
  "server_deadline_at" timestamp,
  "evaluation_status" text DEFAULT 'not_requested' NOT NULL,
  "overall_score" integer,
  "evaluation" jsonb,
  "evaluation_model" text,
  "evaluation_prompt_version" text,
  "evaluation_started_at" timestamp,
  "evaluation_completed_at" timestamp,
  "recruiter_sharing_enabled" boolean DEFAULT false NOT NULL,
  "recruiter_sharing_enabled_at" timestamp,
  "retention_until" timestamp DEFAULT now() + interval '30 days' NOT NULL,
  "started_at" timestamp,
  "submitted_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_sessions_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "interview_studio_sessions_mode_check" CHECK ("mode" IN ('practice','verified')),
  CONSTRAINT "interview_studio_sessions_status_check" CHECK ("status" IN ('ready','in_progress','evaluating','completed','review_required','expired','cancelled')),
  CONSTRAINT "interview_studio_sessions_evaluation_status_check" CHECK ("evaluation_status" IN ('not_requested','pending','in_progress','completed','failed','review_required')),
  CONSTRAINT "interview_studio_sessions_score_check" CHECK ("overall_score" IS NULL OR "overall_score" BETWEEN 0 AND 100),
  CONSTRAINT "interview_studio_sessions_hash_check" CHECK ("blueprint_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "interview_studio_sessions_snapshots_check" CHECK (
    jsonb_typeof("blueprint_snapshot") = 'object'
    AND jsonb_typeof("consent_snapshot") = 'object'
    AND jsonb_typeof("permission_snapshot") = 'object'
    AND "blueprint_snapshot"->>'templateKey' = "template_key"
    AND ("blueprint_snapshot"->>'version')::integer = "template_version"
    AND "consent_snapshot"->>'recruiterSharing' = 'false'
    AND (
      "mode" <> 'practice'
      OR ("consent_snapshot"->>'cameraRecording' = 'false' AND "consent_snapshot"->>'screenRecording' = 'false')
    )
  ),
  CONSTRAINT "interview_studio_sessions_deadline_check" CHECK ("server_deadline_at" IS NULL OR "server_deadline_at" > "created_at"),
  CONSTRAINT "interview_studio_sessions_retention_check" CHECK ("retention_until" > "created_at"),
  CONSTRAINT "interview_studio_sessions_sharing_check" CHECK (
    ("recruiter_sharing_enabled" = false AND "recruiter_sharing_enabled_at" IS NULL)
    OR ("recruiter_sharing_enabled" = true AND "recruiter_sharing_enabled_at" IS NOT NULL AND "mode" = 'verified')
  )
);
--> statement-breakpoint
ALTER TABLE "interview_studio_sessions" ADD CONSTRAINT "interview_studio_sessions_template_id_templates_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "interview_studio_templates"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "interview_studio_sessions" ADD CONSTRAINT "interview_studio_sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "interview_studio_sessions_learner_idx" ON "interview_studio_sessions" ("user_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "interview_studio_sessions_deadline_idx" ON "interview_studio_sessions" ("status", "server_deadline_at");
--> statement-breakpoint
CREATE INDEX "interview_studio_sessions_retention_idx" ON "interview_studio_sessions" ("retention_until");

--> statement-breakpoint
CREATE TABLE "interview_studio_responses" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "item_key" text NOT NULL,
  "item_kind" text NOT NULL,
  "answer_text" text,
  "code" text,
  "language" text,
  "answer_hash" text,
  "sample_test_result" jsonb,
  "final_test_result" jsonb,
  "evaluation_status" text DEFAULT 'not_requested' NOT NULL,
  "evaluation" jsonb,
  "evaluation_model" text,
  "evaluation_prompt_version" text,
  "is_final" boolean DEFAULT false NOT NULL,
  "finalized_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_responses_session_item_unique" UNIQUE("session_id", "item_key"),
  CONSTRAINT "interview_studio_responses_kind_check" CHECK ("item_kind" IN ('structured_response','coding')),
  CONSTRAINT "interview_studio_responses_language_check" CHECK (
    ("item_kind" = 'structured_response' AND "language" IS NULL AND "code" IS NULL)
    OR ("item_kind" = 'coding' AND "language" = 'javascript')
  ),
  CONSTRAINT "interview_studio_responses_answer_check" CHECK ("answer_text" IS NOT NULL OR "code" IS NOT NULL),
  CONSTRAINT "interview_studio_responses_hash_check" CHECK ("answer_hash" IS NULL OR "answer_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "interview_studio_responses_test_results_check" CHECK (
    ("sample_test_result" IS NULL OR jsonb_typeof("sample_test_result") = 'object')
    AND ("final_test_result" IS NULL OR jsonb_typeof("final_test_result") = 'object')
  ),
  CONSTRAINT "interview_studio_responses_evaluation_status_check" CHECK ("evaluation_status" IN ('not_requested','pending','in_progress','completed','failed','review_required')),
  CONSTRAINT "interview_studio_responses_finalized_check" CHECK (
    ("is_final" = false AND "finalized_at" IS NULL) OR ("is_final" = true AND "finalized_at" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "interview_studio_responses" ADD CONSTRAINT "interview_studio_responses_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "interview_studio_sessions"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "interview_studio_responses_session_idx" ON "interview_studio_responses" ("session_id", "created_at");

--> statement-breakpoint
CREATE TABLE "interview_studio_artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "user_id" integer NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "private_manifest" jsonb NOT NULL,
  "original_file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer,
  "sha256" text,
  "duration_seconds" integer,
  "consent_policy_version" text NOT NULL,
  "retention_until" timestamp NOT NULL,
  "uploaded_at" timestamp,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_artifacts_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "interview_studio_artifacts_kind_check" CHECK ("kind" IN ('camera','microphone','screen','combined')),
  CONSTRAINT "interview_studio_artifacts_status_check" CHECK ("status" IN ('pending','uploaded','quarantined','deleted','failed')),
  CONSTRAINT "interview_studio_artifacts_manifest_check" CHECK (
    jsonb_typeof("private_manifest") = 'object'
    AND "private_manifest"->>'access' = 'private'
    AND length(btrim("private_manifest"->>'objectKey')) >= 3
    AND "private_manifest"->>'objectKey' !~* '^[a-z][a-z0-9+.-]*://'
    AND NOT ("private_manifest" ? 'url')
  ),
  CONSTRAINT "interview_studio_artifacts_size_check" CHECK ("size_bytes" IS NULL OR "size_bytes" BETWEEN 1 AND 1073741824),
  CONSTRAINT "interview_studio_artifacts_duration_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" BETWEEN 0 AND 14400),
  CONSTRAINT "interview_studio_artifacts_hash_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "interview_studio_artifacts" ADD CONSTRAINT "interview_studio_artifacts_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "interview_studio_sessions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "interview_studio_artifacts" ADD CONSTRAINT "interview_studio_artifacts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "interview_studio_artifacts_session_idx" ON "interview_studio_artifacts" ("session_id", "kind", "created_at");
--> statement-breakpoint
CREATE INDEX "interview_studio_artifacts_retention_idx" ON "interview_studio_artifacts" ("status", "retention_until");

--> statement-breakpoint
CREATE TABLE "interview_studio_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "user_id" integer,
  "idempotency_key" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_events_session_idempotency_unique" UNIQUE("session_id", "idempotency_key"),
  CONSTRAINT "interview_studio_events_type_check" CHECK (
    "type" IN ('session_started','session_submitted','permission_changed','recording_started','recording_stopped',
      'screen_share_ended','focus_left','focus_returned','network_offline','network_online','response_saved','tests_requested')
  ),
  CONSTRAINT "interview_studio_events_payload_check" CHECK (jsonb_typeof("payload") = 'object')
);
--> statement-breakpoint
ALTER TABLE "interview_studio_events" ADD CONSTRAINT "interview_studio_events_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "interview_studio_sessions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "interview_studio_events" ADD CONSTRAINT "interview_studio_events_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "interview_studio_events_session_time_idx" ON "interview_studio_events" ("session_id", "occurred_at", "id");

--> statement-breakpoint
CREATE TABLE "interview_studio_share_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "learner_user_id" integer NOT NULL,
  "recruiter_id" integer NOT NULL,
  "scopes" jsonb NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "granted_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp,
  "revocation_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_share_grants_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "interview_studio_share_grants_status_check" CHECK ("status" IN ('active','revoked','expired')),
  CONSTRAINT "interview_studio_share_grants_scopes_check" CHECK (
    jsonb_typeof("scopes") = 'array'
    AND jsonb_array_length("scopes") BETWEEN 1 AND 4
    AND "scopes" <@ '["summary","responses","code","artifacts"]'::jsonb
  ),
  CONSTRAINT "interview_studio_share_grants_expiry_check" CHECK ("expires_at" > "granted_at"),
  CONSTRAINT "interview_studio_share_grants_revoked_check" CHECK (
    ("status" = 'revoked' AND "revoked_at" IS NOT NULL) OR ("status" <> 'revoked' AND "revoked_at" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "interview_studio_share_grants" ADD CONSTRAINT "interview_studio_share_grants_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "interview_studio_sessions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "interview_studio_share_grants" ADD CONSTRAINT "interview_studio_share_grants_learner_user_id_users_id_fk"
  FOREIGN KEY ("learner_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "interview_studio_share_grants" ADD CONSTRAINT "interview_studio_share_grants_recruiter_id_recruiters_id_fk"
  FOREIGN KEY ("recruiter_id") REFERENCES "recruiters"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "interview_studio_share_grants_recruiter_idx" ON "interview_studio_share_grants" ("recruiter_id", "status", "expires_at");
--> statement-breakpoint
CREATE INDEX "interview_studio_share_grants_session_idx" ON "interview_studio_share_grants" ("session_id", "status", "expires_at");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_published_interview_studio_template()
RETURNS trigger AS $$
BEGIN
  IF OLD.state = 'published' AND (
    NEW.template_key IS DISTINCT FROM OLD.template_key
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.owner_type IS DISTINCT FROM OLD.owner_type
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.supported_modes IS DISTINCT FROM OLD.supported_modes
    OR NEW.rubric_version IS DISTINCT FROM OLD.rubric_version
    OR NEW.blueprint IS DISTINCT FROM OLD.blueprint
    OR NEW.blueprint_hash IS DISTINCT FROM OLD.blueprint_hash
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
  ) THEN
    RAISE EXCEPTION 'Published Interview Studio templates are immutable; create a new version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_templates_immutable_published
  BEFORE UPDATE ON "interview_studio_templates"
  FOR EACH ROW EXECUTE FUNCTION protect_published_interview_studio_template();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_interview_studio_session_snapshot()
RETURNS trigger AS $$
BEGIN
  IF NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.template_key IS DISTINCT FROM OLD.template_key
    OR NEW.template_version IS DISTINCT FROM OLD.template_version
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.mode IS DISTINCT FROM OLD.mode
    OR NEW.blueprint_snapshot IS DISTINCT FROM OLD.blueprint_snapshot
    OR NEW.blueprint_hash IS DISTINCT FROM OLD.blueprint_hash
    OR NEW.consent_snapshot IS DISTINCT FROM OLD.consent_snapshot
    OR NEW.retention_until IS DISTINCT FROM OLD.retention_until
  THEN
    RAISE EXCEPTION 'Interview Studio session evidence snapshots are immutable';
  END IF;
  IF NEW.permission_snapshot IS DISTINCT FROM OLD.permission_snapshot
    OR NEW.server_deadline_at IS DISTINCT FROM OLD.server_deadline_at
  THEN
    IF NOT (
      OLD.status = 'ready'
      AND NEW.status = 'in_progress'
      AND OLD.server_deadline_at IS NULL
      AND NEW.server_deadline_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Interview Studio readiness snapshot and deadline can only be captured once at session start';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_sessions_immutable_snapshot
  BEFORE UPDATE ON "interview_studio_sessions"
  FOR EACH ROW EXECUTE FUNCTION protect_interview_studio_session_snapshot();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_interview_studio_artifact_policy()
RETURNS trigger AS $$
DECLARE
  parent_mode text;
  parent_user_id integer;
  parent_retention timestamp;
BEGIN
  SELECT mode, user_id, retention_until
    INTO parent_mode, parent_user_id, parent_retention
    FROM interview_studio_sessions
    WHERE id = NEW.session_id;
  IF parent_mode <> 'verified' THEN
    RAISE EXCEPTION 'Practice interviews cannot retain media artifacts';
  END IF;
  IF parent_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Artifact owner must match the interview learner';
  END IF;
  IF NEW.retention_until > parent_retention THEN
    RAISE EXCEPTION 'Artifact retention cannot exceed session retention';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_artifacts_policy
  BEFORE INSERT OR UPDATE ON "interview_studio_artifacts"
  FOR EACH ROW EXECUTE FUNCTION enforce_interview_studio_artifact_policy();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_interview_studio_share_grant()
RETURNS trigger AS $$
DECLARE
  parent_mode text;
  parent_user_id integer;
  parent_sharing boolean;
  parent_retention timestamp;
BEGIN
  SELECT mode, user_id, recruiter_sharing_enabled, retention_until
    INTO parent_mode, parent_user_id, parent_sharing, parent_retention
    FROM interview_studio_sessions
    WHERE id = NEW.session_id;
  IF parent_mode <> 'verified' OR parent_sharing <> true THEN
    RAISE EXCEPTION 'Recruiter sharing is not enabled for this verified session';
  END IF;
  IF parent_user_id IS DISTINCT FROM NEW.learner_user_id THEN
    RAISE EXCEPTION 'Share grant learner must own the interview session';
  END IF;
  IF NEW.expires_at > parent_retention THEN
    RAISE EXCEPTION 'Share grant cannot outlive interview retention';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_share_grants_policy
  BEFORE INSERT OR UPDATE ON "interview_studio_share_grants"
  FOR EACH ROW EXECUTE FUNCTION enforce_interview_studio_share_grant();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_final_interview_studio_response()
RETURNS trigger AS $$
BEGIN
  IF OLD.is_final = true AND (
    NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.item_key IS DISTINCT FROM OLD.item_key
    OR NEW.item_kind IS DISTINCT FROM OLD.item_kind
    OR NEW.answer_text IS DISTINCT FROM OLD.answer_text
    OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.language IS DISTINCT FROM OLD.language
    OR NEW.answer_hash IS DISTINCT FROM OLD.answer_hash
    OR NEW.sample_test_result IS DISTINCT FROM OLD.sample_test_result
    OR NEW.final_test_result IS DISTINCT FROM OLD.final_test_result
    OR NEW.is_final IS DISTINCT FROM OLD.is_final
    OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
  ) THEN
    RAISE EXCEPTION 'Final Interview Studio response evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_responses_immutable_final
  BEFORE UPDATE ON "interview_studio_responses"
  FOR EACH ROW EXECUTE FUNCTION protect_final_interview_studio_response();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_interview_studio_event_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Interview Studio events are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_events_append_only
  BEFORE UPDATE ON "interview_studio_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_interview_studio_event_update();

--> statement-breakpoint
INSERT INTO "interview_studio_templates" (
  "template_key", "version", "owner_type", "owner_id", "title", "summary", "state", "is_current",
  "supported_modes", "rubric_version", "blueprint", "blueprint_hash", "published_at"
)
VALUES (
  'frontend-engineer-foundations',
  1,
  'admin',
  NULL,
  'Frontend Engineer Foundations',
  'A private practice interview covering browser fundamentals, debugging, collaboration, and a deterministic JavaScript task.',
  'published',
  true,
  '["practice"]'::jsonb,
  'frontend-foundations-rubric-v1',
  $blueprint$
  {
    "schemaVersion": "interview-studio-blueprint/v1",
    "templateKey": "frontend-engineer-foundations",
    "version": 1,
    "title": "Frontend Engineer Foundations",
    "summary": "A private practice interview covering browser fundamentals, debugging, collaboration, and a deterministic JavaScript task.",
    "role": "Frontend Engineer",
    "level": "foundation",
    "skills": ["JavaScript", "Browser fundamentals", "React debugging", "Accessibility", "Communication"],
    "allowedModes": ["practice"],
    "estimatedDurationMinutes": 35,
    "rubricVersion": "frontend-foundations-rubric-v1",
    "items": [
      {
        "key": "browser-request-lifecycle",
        "kind": "structured_response",
        "title": "From URL to interactive page",
        "competency": "Browser fundamentals",
        "timeLimitSeconds": 360,
        "instructions": "Answer in a clear sequence and call out one performance trade-off.",
        "prompt": "Explain what happens from the moment a user enters a URL until the page becomes interactive. Include networking, browser parsing, rendering, and JavaScript execution.",
        "responseFormat": "text_or_transient_voice",
        "minimumWords": 80,
        "maximumWords": 450,
        "rubric": [
          {"key":"technical-coverage","label":"Technical coverage","description":"Covers the important networking, parsing, rendering, and execution stages accurately.","weight":60},
          {"key":"communication","label":"Communication","description":"Explains the sequence clearly and identifies a credible performance trade-off.","weight":40}
        ]
      },
      {
        "key": "react-debugging-plan",
        "kind": "structured_response",
        "title": "Debug a slow product list",
        "competency": "React debugging",
        "timeLimitSeconds": 420,
        "instructions": "Describe an evidence-led debugging plan before proposing optimizations.",
        "prompt": "A React product list becomes sluggish after filters and live inventory updates are added. Explain how you would reproduce, measure, isolate, and fix the problem without guessing.",
        "responseFormat": "text_or_transient_voice",
        "minimumWords": 100,
        "maximumWords": 500,
        "rubric": [
          {"key":"diagnostic-method","label":"Diagnostic method","description":"Uses reproducible measurements and narrows the cause before changing code.","weight":60},
          {"key":"risk-control","label":"Risk control","description":"Validates the improvement and protects behavior with appropriate tests or monitoring.","weight":40}
        ]
      },
      {
        "key": "accessible-api-collaboration",
        "kind": "structured_response",
        "title": "Resolve an accessible API design conflict",
        "competency": "Engineering collaboration",
        "timeLimitSeconds": 360,
        "instructions": "Show how you would reach a testable decision while keeping accessibility non-negotiable.",
        "prompt": "Design and frontend teams disagree about an autocomplete interaction, and the current API cannot expose all accessible states. Explain how you would collaborate, document trade-offs, and deliver a safe outcome.",
        "responseFormat": "text_or_transient_voice",
        "minimumWords": 80,
        "maximumWords": 450,
        "rubric": [
          {"key":"accessibility-reasoning","label":"Accessibility reasoning","description":"Identifies user impact and proposes testable accessible behavior.","weight":55},
          {"key":"collaboration","label":"Collaboration","description":"Builds alignment with clear decisions, ownership, and verification steps.","weight":45}
        ]
      },
      {
        "key": "normalize-tags",
        "kind": "coding",
        "title": "Normalize product tags",
        "competency": "JavaScript problem solving",
        "timeLimitSeconds": 900,
        "instructions": "Complete the program. Read standard input and write only the required normalized tags to standard output.",
        "language": "javascript",
        "runtime": "javascript-node20-stdin-stdout-v1",
        "interface": "stdin_stdout",
        "problemStatement": "The first input line is an integer N followed by N tag lines. Normalize each tag by trimming it, converting ASCII letters to lowercase, replacing each run of whitespace with one hyphen, removing duplicates, and sorting the remaining tags lexicographically. Print one normalized tag per line. For N = 0, print nothing.",
        "starterCode": "const fs = require('node:fs');\nconst lines = fs.readFileSync(0, 'utf8').split(/\\r?\\n/);\nconst count = Number(lines[0] || 0);\nconst tags = lines.slice(1, count + 1);\n\nfunction normalizeTags(values) {\n  // Return a sorted array of unique normalized tags.\n}\n\nprocess.stdout.write(normalizeTags(tags).join('\\n'));\n",
        "constraints": ["0 <= N <= 10000", "Each tag contains at most 200 characters", "Input tags contain printable ASCII characters and whitespace"],
        "testCases": [
          {"key":"public-basic","title":"Duplicates and spaces","visibility":"public","input":"5\nReact\n react \nNode JS\nnode js\nTypeScript\n","expectedOutput":"node-js\nreact\ntypescript","weight":15},
          {"key":"public-hyphen","title":"Existing punctuation","visibility":"public","input":"4\n  API Design\nAPI-design\napi   design\nDevOps\n","expectedOutput":"api-design\ndevops","weight":15},
          {"key":"hidden-empty","title":"Empty collection","visibility":"hidden","input":"0\n","expectedOutput":"","weight":15},
          {"key":"hidden-cloud","title":"Case and repeated cloud tags","visibility":"hidden","input":"6\nAWS\nazure\nAWS\nGoogle Cloud\n google   cloud \nAZURE\n","expectedOutput":"aws\nazure\ngoogle-cloud","weight":25},
          {"key":"hidden-whitespace","title":"Mixed whitespace runs","visibility":"hidden","input":"5\nQuality   Engineering\nquality\tengineering\nWeb Performance\nweb  performance\nA11Y\n","expectedOutput":"a11y\nquality-engineering\nweb-performance","weight":30}
        ],
        "rubric": [
          {"key":"correctness","label":"Correctness","description":"Produces the required output across public and hidden deterministic tests.","weight":75},
          {"key":"code-quality","label":"Code quality","description":"Uses clear, bounded, and maintainable JavaScript appropriate for the input limits.","weight":25}
        ]
      }
    ]
  }
  $blueprint$::jsonb,
  'c4de2705399b6796c96952d94b6ecb1aa4ddda9e4295b917e9f66f59ff0490dd',
  now()
)
ON CONFLICT ("template_key", "version") DO NOTHING;
