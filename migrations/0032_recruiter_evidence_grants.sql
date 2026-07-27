-- Recruiter evidence authorization is intentionally independent from the
-- learner's global profile_visibility discovery preference. A prior exact
-- profile interaction establishes the recruiter/learner relationship, while
-- this grant alone authorizes the selected evidence disclosure.
CREATE TABLE "candidate_evidence_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_user_id" integer NOT NULL,
  "target_recruiter_id" integer NOT NULL,
  "source_profile_access_log_id" integer NOT NULL,
  "purpose" text NOT NULL,
  "job_reference" text,
  "consent_version" text NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revocation_reason" text,
  "creation_request_id" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "candidate_evidence_grants_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "candidate_evidence_grants_purpose_check" CHECK (length(btrim("purpose")) BETWEEN 3 AND 500),
  CONSTRAINT "candidate_evidence_grants_job_reference_check" CHECK ("job_reference" IS NULL OR length(btrim("job_reference")) BETWEEN 1 AND 200),
  CONSTRAINT "candidate_evidence_grants_consent_check" CHECK ("consent_version" = 'candidate-evidence-consent.v1'),
  CONSTRAINT "candidate_evidence_grants_expiry_check" CHECK ("expires_at" > "granted_at" AND "expires_at" <= "granted_at" + interval '30 days'),
  CONSTRAINT "candidate_evidence_grants_revocation_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "granted_at"),
  CONSTRAINT "candidate_evidence_grants_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grants" ADD CONSTRAINT "candidate_evidence_grants_learner_user_id_users_id_fk"
  FOREIGN KEY ("learner_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grants" ADD CONSTRAINT "candidate_evidence_grants_target_recruiter_id_recruiters_id_fk"
  FOREIGN KEY ("target_recruiter_id") REFERENCES "recruiters"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grants" ADD CONSTRAINT "candidate_evidence_grants_source_access_id_profile_access_logs_id_fk"
  FOREIGN KEY ("source_profile_access_log_id") REFERENCES "profile_access_logs"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "candidate_evidence_grants_learner_idx"
  ON "candidate_evidence_grants" ("learner_user_id", "granted_at");
--> statement-breakpoint
CREATE INDEX "candidate_evidence_grants_recruiter_learner_idx"
  ON "candidate_evidence_grants" ("target_recruiter_id", "learner_user_id", "expires_at")
  WHERE "revoked_at" IS NULL;

--> statement-breakpoint
CREATE TABLE "candidate_evidence_grant_certificates" (
  "grant_id" text NOT NULL,
  "certificate_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "candidate_evidence_grant_certificates_unique" UNIQUE ("grant_id", "certificate_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grant_certificates" ADD CONSTRAINT "candidate_evidence_grant_certificates_grant_id_fk"
  FOREIGN KEY ("grant_id") REFERENCES "candidate_evidence_grants"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grant_certificates" ADD CONSTRAINT "candidate_evidence_grant_certificates_certificate_id_fk"
  FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "candidate_evidence_grant_certificates_certificate_idx"
  ON "candidate_evidence_grant_certificates" ("certificate_id", "grant_id");

--> statement-breakpoint
CREATE TABLE "candidate_evidence_grant_practice_summaries" (
  "grant_id" text NOT NULL,
  "exam_attempt_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "candidate_evidence_grant_practice_summaries_unique" UNIQUE ("grant_id", "exam_attempt_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grant_practice_summaries" ADD CONSTRAINT "candidate_evidence_grant_practice_summaries_grant_id_fk"
  FOREIGN KEY ("grant_id") REFERENCES "candidate_evidence_grants"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "candidate_evidence_grant_practice_summaries" ADD CONSTRAINT "candidate_evidence_grant_practice_summaries_attempt_id_fk"
  FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "candidate_evidence_grant_practice_summaries_attempt_idx"
  ON "candidate_evidence_grant_practice_summaries" ("exam_attempt_id", "grant_id");

--> statement-breakpoint
CREATE TABLE "candidate_evidence_access_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "grant_id" text NOT NULL,
  "learner_user_id" integer NOT NULL,
  "recruiter_id" integer NOT NULL,
  "action" text NOT NULL,
  "scopes" text[] NOT NULL,
  "selected_certificate_ids" integer[] NOT NULL,
  "selected_practice_summary_ids" integer[] NOT NULL,
  "request_id" text NOT NULL,
  "policy_version" text NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "candidate_evidence_access_events_action_check" CHECK ("action" = 'evidence_disclosed'),
  CONSTRAINT "candidate_evidence_access_events_policy_check" CHECK ("policy_version" = 'candidate-evidence-policy.v1'),
  CONSTRAINT "candidate_evidence_access_events_scopes_check" CHECK ("scopes" <@ ARRAY['certification','practice_summary']::text[])
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence_access_events" ADD CONSTRAINT "candidate_evidence_access_events_grant_id_fk"
  FOREIGN KEY ("grant_id") REFERENCES "candidate_evidence_grants"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "candidate_evidence_access_events" ADD CONSTRAINT "candidate_evidence_access_events_learner_user_id_fk"
  FOREIGN KEY ("learner_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "candidate_evidence_access_events" ADD CONSTRAINT "candidate_evidence_access_events_recruiter_id_fk"
  FOREIGN KEY ("recruiter_id") REFERENCES "recruiters"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "candidate_evidence_access_events_learner_time_idx"
  ON "candidate_evidence_access_events" ("learner_user_id", "occurred_at", "id");
--> statement-breakpoint
CREATE INDEX "candidate_evidence_access_events_grant_time_idx"
  ON "candidate_evidence_access_events" ("grant_id", "occurred_at", "id");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_candidate_evidence_grant_target()
RETURNS trigger AS $$
DECLARE
  source_recruiter_id integer;
  source_learner_id integer;
  source_access_type text;
  recruiter_active boolean;
  recruiter_kyc text;
BEGIN
  SELECT "recruiter_id", "user_id", "access_type"
    INTO source_recruiter_id, source_learner_id, source_access_type
    FROM "profile_access_logs"
    WHERE "id" = NEW."source_profile_access_log_id";
  SELECT "is_active", "kyc_status"
    INTO recruiter_active, recruiter_kyc
    FROM "recruiters"
    WHERE "id" = NEW."target_recruiter_id";
  IF source_recruiter_id IS DISTINCT FROM NEW."target_recruiter_id"
    OR source_learner_id IS DISTINCT FROM NEW."learner_user_id"
    OR source_access_type IS DISTINCT FROM 'profile_view'
  THEN
    RAISE EXCEPTION 'Evidence grant must use an exact recruiter/learner profile interaction';
  END IF;
  IF recruiter_active IS DISTINCT FROM true OR recruiter_kyc IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Evidence grant target must be an active, KYC-approved recruiter';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grants_target_policy
  BEFORE INSERT ON "candidate_evidence_grants"
  FOR EACH ROW EXECUTE FUNCTION enforce_candidate_evidence_grant_target();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_candidate_evidence_grant()
RETURNS trigger AS $$
BEGIN
  IF NEW."learner_user_id" IS DISTINCT FROM OLD."learner_user_id"
    OR NEW."target_recruiter_id" IS DISTINCT FROM OLD."target_recruiter_id"
    OR NEW."source_profile_access_log_id" IS DISTINCT FROM OLD."source_profile_access_log_id"
    OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."job_reference" IS DISTINCT FROM OLD."job_reference"
    OR NEW."consent_version" IS DISTINCT FROM OLD."consent_version"
    OR NEW."granted_at" IS DISTINCT FROM OLD."granted_at"
    OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"
    OR NEW."creation_request_id" IS DISTINCT FROM OLD."creation_request_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION 'Evidence grant creation metadata is immutable';
  END IF;
  IF OLD."revoked_at" IS NOT NULL
    OR NEW."revoked_at" IS NULL
    OR NEW."version" <> OLD."version" + 1
  THEN
    RAISE EXCEPTION 'Evidence grant permits exactly one versioned revocation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grants_immutable
  BEFORE UPDATE ON "candidate_evidence_grants"
  FOR EACH ROW EXECUTE FUNCTION protect_candidate_evidence_grant();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_candidate_evidence_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Candidate evidence authorization records are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grants_no_delete
  BEFORE DELETE ON "candidate_evidence_grants"
  FOR EACH ROW EXECUTE FUNCTION prevent_candidate_evidence_delete();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_candidate_evidence_certificate_item()
RETURNS trigger AS $$
DECLARE
  grant_learner_id integer;
  grant_revoked_at timestamp with time zone;
  certificate_eligible boolean;
BEGIN
  SELECT "learner_user_id", "revoked_at"
    INTO grant_learner_id, grant_revoked_at
    FROM "candidate_evidence_grants"
    WHERE "id" = NEW."grant_id";
  SELECT (
      certificate."user_id" = grant_learner_id
      AND certificate."is_active" = true
      AND certificate."is_paid" = true
      AND certificate."expires_at" > now()
      AND course."product_type" = 'assessment'
      AND course."assessment_purpose" = 'certification'
      AND course."certification_mode" <> 'none'
      AND course."is_active" = true
      AND course."review_status" = 'approved'
    ) INTO certificate_eligible
    FROM "certificates" certificate
    INNER JOIN "courses" course ON course."id" = certificate."course_id"
    WHERE certificate."id" = NEW."certificate_id";
  IF grant_revoked_at IS NOT NULL OR certificate_eligible IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Selected certificate is not current learner-owned certification evidence';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grant_certificates_policy
  BEFORE INSERT ON "candidate_evidence_grant_certificates"
  FOR EACH ROW EXECUTE FUNCTION enforce_candidate_evidence_certificate_item();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_candidate_evidence_practice_item()
RETURNS trigger AS $$
DECLARE
  grant_learner_id integer;
  grant_revoked_at timestamp with time zone;
  practice_eligible boolean;
BEGIN
  SELECT "learner_user_id", "revoked_at"
    INTO grant_learner_id, grant_revoked_at
    FROM "candidate_evidence_grants"
    WHERE "id" = NEW."grant_id";
  SELECT (
      attempt."user_id" = grant_learner_id
      AND course."product_type" = 'assessment'
      AND course."assessment_purpose" = 'practice'
      AND course."is_active" = true
      AND course."review_status" = 'approved'
    ) INTO practice_eligible
    FROM "exam_attempts" attempt
    INNER JOIN "courses" course ON course."id" = attempt."course_id"
    WHERE attempt."id" = NEW."exam_attempt_id";
  IF grant_revoked_at IS NOT NULL OR practice_eligible IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Selected summary is not learner-owned non-Interview practice evidence';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grant_practice_summaries_policy
  BEFORE INSERT ON "candidate_evidence_grant_practice_summaries"
  FOR EACH ROW EXECUTE FUNCTION enforce_candidate_evidence_practice_item();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_candidate_evidence_certificate_selection()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "candidate_evidence_grant_certificates"
    WHERE "grant_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Evidence grant requires at least one selected certification';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER candidate_evidence_grants_require_certificate
  AFTER INSERT ON "candidate_evidence_grants"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_candidate_evidence_certificate_selection();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_candidate_evidence_item_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Evidence grant selections are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grant_certificates_immutable
  BEFORE UPDATE OR DELETE ON "candidate_evidence_grant_certificates"
  FOR EACH ROW EXECUTE FUNCTION prevent_candidate_evidence_item_mutation();
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_grant_practice_summaries_immutable
  BEFORE UPDATE OR DELETE ON "candidate_evidence_grant_practice_summaries"
  FOR EACH ROW EXECUTE FUNCTION prevent_candidate_evidence_item_mutation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_candidate_evidence_access_event()
RETURNS trigger AS $$
DECLARE
  grant_learner_id integer;
  grant_recruiter_id integer;
BEGIN
  SELECT "learner_user_id", "target_recruiter_id"
    INTO grant_learner_id, grant_recruiter_id
    FROM "candidate_evidence_grants"
    WHERE "id" = NEW."grant_id";
  IF grant_learner_id IS DISTINCT FROM NEW."learner_user_id"
    OR grant_recruiter_id IS DISTINCT FROM NEW."recruiter_id"
  THEN
    RAISE EXCEPTION 'Access event actors must match the evidence grant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_access_events_policy
  BEFORE INSERT ON "candidate_evidence_access_events"
  FOR EACH ROW EXECUTE FUNCTION enforce_candidate_evidence_access_event();
--> statement-breakpoint
CREATE TRIGGER candidate_evidence_access_events_append_only
  BEFORE UPDATE OR DELETE ON "candidate_evidence_access_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_candidate_evidence_delete();
