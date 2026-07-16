-- Interview Studio stores server deadlines, retention boundaries and evidence
-- timestamps from more than one process. Use absolute instants so PostgreSQL's
-- session timezone cannot make a valid deadline appear earlier than creation.
ALTER TABLE "interview_studio_templates"
  ALTER COLUMN "published_at" TYPE timestamptz USING "published_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE current_setting('TimeZone');
--> statement-breakpoint
ALTER TABLE "interview_studio_sessions"
  ALTER COLUMN "server_deadline_at" TYPE timestamptz USING "server_deadline_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "evaluation_started_at" TYPE timestamptz USING "evaluation_started_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "evaluation_completed_at" TYPE timestamptz USING "evaluation_completed_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "recruiter_sharing_enabled_at" TYPE timestamptz USING "recruiter_sharing_enabled_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "retention_until" TYPE timestamptz USING "retention_until" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "started_at" TYPE timestamptz USING "started_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "submitted_at" TYPE timestamptz USING "submitted_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "completed_at" TYPE timestamptz USING "completed_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE current_setting('TimeZone');
--> statement-breakpoint
ALTER TABLE "interview_studio_responses"
  ALTER COLUMN "finalized_at" TYPE timestamptz USING "finalized_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE current_setting('TimeZone');
--> statement-breakpoint
ALTER TABLE "interview_studio_artifacts"
  ALTER COLUMN "retention_until" TYPE timestamptz USING "retention_until" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "uploaded_at" TYPE timestamptz USING "uploaded_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "deleted_at" TYPE timestamptz USING "deleted_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');
--> statement-breakpoint
ALTER TABLE "interview_studio_events"
  ALTER COLUMN "occurred_at" TYPE timestamptz USING "occurred_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "received_at" TYPE timestamptz USING "received_at" AT TIME ZONE current_setting('TimeZone');
--> statement-breakpoint
ALTER TABLE "interview_studio_share_grants"
  ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "granted_at" TYPE timestamptz USING "granted_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "revoked_at" TYPE timestamptz USING "revoked_at" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE current_setting('TimeZone');

--> statement-breakpoint
ALTER TABLE "interview_studio_templates"
  ADD CONSTRAINT "interview_studio_templates_mode_snapshot_check" CHECK (
    "supported_modes" @> ("blueprint"->'allowedModes')
    AND "supported_modes" <@ ("blueprint"->'allowedModes')
  );

--> statement-breakpoint
ALTER TABLE "interview_studio_sessions" DROP CONSTRAINT "interview_studio_sessions_snapshots_check";
--> statement-breakpoint
ALTER TABLE "interview_studio_sessions" ADD CONSTRAINT "interview_studio_sessions_snapshots_check" CHECK (
  jsonb_typeof("blueprint_snapshot") = 'object'
  AND jsonb_typeof("consent_snapshot") = 'object'
  AND jsonb_typeof("permission_snapshot") = 'object'
  AND "blueprint_snapshot"->>'templateKey' = "template_key"
  AND ("blueprint_snapshot"->>'version')::integer = "template_version"
  AND "consent_snapshot"->>'recruiterSharing' IN ('true','false')
  AND (
    "mode" <> 'practice'
    OR (
      "consent_snapshot"->>'recruiterSharing' = 'false'
      AND "consent_snapshot"->>'cameraRecording' = 'false'
      AND "consent_snapshot"->>'screenRecording' = 'false'
    )
  )
);
--> statement-breakpoint
ALTER TABLE "interview_studio_sessions" DROP CONSTRAINT "interview_studio_sessions_sharing_check";
--> statement-breakpoint
ALTER TABLE "interview_studio_sessions" ADD CONSTRAINT "interview_studio_sessions_sharing_check" CHECK (
  ("recruiter_sharing_enabled" = false AND "recruiter_sharing_enabled_at" IS NULL)
  OR (
    "recruiter_sharing_enabled" = true
    AND "recruiter_sharing_enabled_at" IS NOT NULL
    AND "mode" = 'verified'
    AND "status" = 'completed'
    AND "consent_snapshot"->>'recruiterSharing' = 'true'
  )
);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_interview_studio_response_state()
RETURNS trigger AS $$
DECLARE
  parent_status text;
  candidate_content_changed boolean;
  evaluation_content_changed boolean;
BEGIN
  SELECT status INTO parent_status
    FROM interview_studio_sessions
    WHERE id = NEW.session_id
    FOR SHARE;
  IF parent_status IS NULL THEN
    RAISE EXCEPTION 'Interview Studio response requires an existing session';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF parent_status <> 'in_progress' THEN
      RAISE EXCEPTION 'Interview Studio responses can only be added while a session is in progress';
    END IF;
    RETURN NEW;
  END IF;

  candidate_content_changed :=
    NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.item_key IS DISTINCT FROM OLD.item_key
    OR NEW.item_kind IS DISTINCT FROM OLD.item_kind
    OR NEW.answer_text IS DISTINCT FROM OLD.answer_text
    OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.language IS DISTINCT FROM OLD.language
    OR NEW.answer_hash IS DISTINCT FROM OLD.answer_hash
    OR NEW.sample_test_result IS DISTINCT FROM OLD.sample_test_result;
  evaluation_content_changed :=
    NEW.final_test_result IS DISTINCT FROM OLD.final_test_result
    OR NEW.evaluation_status IS DISTINCT FROM OLD.evaluation_status
    OR NEW.evaluation IS DISTINCT FROM OLD.evaluation
    OR NEW.evaluation_model IS DISTINCT FROM OLD.evaluation_model
    OR NEW.evaluation_prompt_version IS DISTINCT FROM OLD.evaluation_prompt_version
    OR NEW.is_final IS DISTINCT FROM OLD.is_final
    OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at;

  IF candidate_content_changed AND parent_status <> 'in_progress' THEN
    RAISE EXCEPTION 'Candidate response evidence is closed after submission starts';
  END IF;
  IF evaluation_content_changed AND parent_status NOT IN ('evaluating','review_required') THEN
    RAISE EXCEPTION 'Evaluation evidence can only be written during evaluation or review';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER interview_studio_responses_parent_state
  BEFORE INSERT OR UPDATE ON "interview_studio_responses"
  FOR EACH ROW EXECUTE FUNCTION enforce_interview_studio_response_state();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_interview_studio_artifact_policy()
RETURNS trigger AS $$
DECLARE
  parent_mode text;
  parent_user_id integer;
  parent_retention timestamptz;
  parent_consent jsonb;
BEGIN
  SELECT mode, user_id, retention_until, consent_snapshot
    INTO parent_mode, parent_user_id, parent_retention, parent_consent
    FROM interview_studio_sessions
    WHERE id = NEW.session_id;
  IF parent_mode <> 'verified' THEN
    RAISE EXCEPTION 'Practice interviews cannot retain media artifacts';
  END IF;
  IF parent_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Artifact owner must match the interview learner';
  END IF;
  IF NEW.consent_policy_version IS DISTINCT FROM parent_consent->>'policyVersion' THEN
    RAISE EXCEPTION 'Artifact consent version must match the immutable session consent';
  END IF;
  IF NEW.kind IN ('camera','microphone') AND parent_consent->>'cameraRecording' <> 'true' THEN
    RAISE EXCEPTION 'Camera or microphone artifact requires recording consent';
  END IF;
  IF NEW.kind = 'screen' AND parent_consent->>'screenRecording' <> 'true' THEN
    RAISE EXCEPTION 'Screen artifact requires screen-recording consent';
  END IF;
  IF NEW.kind = 'combined' AND (
    parent_consent->>'cameraRecording' <> 'true' OR parent_consent->>'screenRecording' <> 'true'
  ) THEN
    RAISE EXCEPTION 'Combined artifact requires camera and screen recording consent';
  END IF;
  IF NEW.retention_until > parent_retention THEN
    RAISE EXCEPTION 'Artifact retention cannot exceed session retention';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_interview_studio_share_grant()
RETURNS trigger AS $$
DECLARE
  parent_mode text;
  parent_status text;
  parent_user_id integer;
  parent_sharing boolean;
  parent_retention timestamptz;
  parent_consent jsonb;
BEGIN
  SELECT mode, status, user_id, recruiter_sharing_enabled, retention_until, consent_snapshot
    INTO parent_mode, parent_status, parent_user_id, parent_sharing, parent_retention, parent_consent
    FROM interview_studio_sessions
    WHERE id = NEW.session_id;
  IF parent_mode <> 'verified'
    OR parent_status <> 'completed'
    OR parent_sharing <> true
    OR parent_consent->>'recruiterSharing' <> 'true'
  THEN
    RAISE EXCEPTION 'Recruiter sharing requires completed, consented verified evidence';
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
CREATE OR REPLACE FUNCTION prevent_interview_studio_event_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Interview Studio events are append-only';
  END IF;
  IF EXISTS (SELECT 1 FROM interview_studio_sessions WHERE id = OLD.session_id) THEN
    RAISE EXCEPTION 'Interview Studio events can only be deleted with their parent session';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER interview_studio_events_append_only ON "interview_studio_events";
--> statement-breakpoint
CREATE TRIGGER interview_studio_events_append_only
  BEFORE UPDATE OR DELETE ON "interview_studio_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_interview_studio_event_mutation();
--> statement-breakpoint
DROP FUNCTION prevent_interview_studio_event_update();
