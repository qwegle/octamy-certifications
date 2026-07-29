-- Audited shell rationale and release-role authorization
--
-- Migration 0039 performs the exact guarded transition for the 17 reviewed
-- inactive/private/pending certification shells. This migration records one
-- immutable rationale for every exact target that exists and is archived; no
-- course, content, or learner history is deleted. Exact ID/slug matching and
-- existence-conditional postconditions keep the rationale step portable to a
-- fresh database without those legacy rows.
CREATE TABLE "assessment_shell_archival_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "course_id" integer NOT NULL,
  "rationale_code" text NOT NULL,
  "rationale" text NOT NULL,
  "decision_reference" text NOT NULL,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_shell_archival_records_course_unique" UNIQUE ("course_id"),
  CONSTRAINT "assessment_shell_archival_records_code_check" CHECK (
    "rationale_code" IN ('undefined_certification_claim', 'non_mcq_evidence_required', 'experience_claim_not_assessment')
  ),
  CONSTRAINT "assessment_shell_archival_records_rationale_check" CHECK (length(btrim("rationale")) BETWEEN 20 AND 1000),
  CONSTRAINT "assessment_shell_archival_records_reference_check" CHECK (length(btrim("decision_reference")) BETWEEN 8 AND 200)
);
--> statement-breakpoint
ALTER TABLE "assessment_shell_archival_records" ADD CONSTRAINT "assessment_shell_archival_records_course_fk"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_shell_archival_records_archived_at_idx"
  ON "assessment_shell_archival_records" ("archived_at", "id");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_assessment_shell_archival_record_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Assessment shell archival rationale is append-only and immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_shell_archival_records_immutable
  BEFORE UPDATE OR DELETE ON "assessment_shell_archival_records"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_shell_archival_record_mutation();

--> statement-breakpoint
DO $$
BEGIN
  INSERT INTO "assessment_shell_archival_records"
    ("course_id", "rationale_code", "rationale", "decision_reference")
  SELECT course."id", target.rationale_code, target.rationale, 'governed-shell-triage-2026-07-29'
    FROM "courses" course
    INNER JOIN (VALUES
      (11, 'business-strategy-fundamentals', 'undefined_certification_claim', 'The broad strategy shell has no defined target role, observable competency claim, authoritative syllabus, or defensible assessment blueprint.'),
      (13, 'strategic-leadership', 'non_mcq_evidence_required', 'Strategic leadership cannot be substantiated by this empty quiz shell; a level-specific scenario, behavioural, and multi-rater evidence model is required.'),
      (14, 'innovation-management', 'undefined_certification_claim', 'The shell has no selected innovation framework, target practitioner role, or practical evidence model from which to build a defensible certification.'),
      (15, 'entrepreneurship', 'non_mcq_evidence_required', 'A knowledge-only assessment cannot substantiate entrepreneurship; credible evidence would require attributable venture or project outcomes and human review.'),
      (21, 'design-principles', 'non_mcq_evidence_required', 'The empty shell does not define an objective design and accessibility claim and lacks the portfolio or practical evidence needed for certification.'),
      (23, 'advanced-prototyping', 'non_mcq_evidence_required', 'Advanced prototyping proficiency requires review of interactive artifacts against a defined design-system rubric, not an undefined empty MCQ shell.'),
      (24, 'design-leadership', 'non_mcq_evidence_required', 'Design leadership requires a target leadership level plus scenario, portfolio, and rubric evidence that this empty certification shell cannot provide.'),
      (25, 'brand-identity', 'non_mcq_evidence_required', 'Brand strategy and identity design require attributable portfolio artifacts and a reviewed rubric; the empty shell has no defensible scored claim.'),
      (29, 'growth-hacking', 'undefined_certification_claim', 'The label and scope do not define an ethical, durable competency claim, experimentation standard, or authoritative assessment syllabus.'),
      (40, 'fintech-innovation', 'undefined_certification_claim', 'The shell has no stable role-based competency scope, regulatory jurisdiction, or refresh policy for rapidly changing fintech products and rules.'),
      (44, 'strategic-pmo', 'undefined_certification_claim', 'The shell does not identify a PMO framework, organizational maturity context, leadership level, or observable certification claim.'),
      (45, 'digital-transformation', 'undefined_certification_claim', 'The shell lacks a target practitioner role, change-management framework, and measurable transformation outcomes needed for a valid certification.'),
      (46, 'software-engineering-internship', 'experience_claim_not_assessment', 'An Octamy quiz cannot prove internship participation or completion; the claim requires an identified employer or institution and verified workplace evidence.'),
      (47, 'data-science-internship', 'experience_claim_not_assessment', 'An Octamy quiz cannot prove internship participation or completion; the claim requires an identified employer or institution and verified workplace evidence.'),
      (48, 'marketing-internship', 'experience_claim_not_assessment', 'An Octamy quiz cannot prove internship participation or completion; the claim requires an identified employer or institution and verified workplace evidence.'),
      (49, 'business-analyst-internship', 'experience_claim_not_assessment', 'An Octamy quiz cannot prove internship participation or completion; the claim requires an identified employer or institution and verified workplace evidence.'),
      (50, 'ux-design-internship', 'experience_claim_not_assessment', 'An Octamy quiz cannot prove internship participation or completion; the claim requires an identified employer or institution and verified workplace evidence.')
    ) AS target(id, slug, rationale_code, rationale)
      ON course."id" = target.id AND course."slug" = target.slug
   WHERE course."product_type" = 'assessment'
     AND course."assessment_purpose" = 'certification'
     AND course."review_status" = 'archived'
  ON CONFLICT ("course_id") DO NOTHING;

  IF EXISTS (
    SELECT 1
      FROM "courses" course
      INNER JOIN (VALUES
        (11, 'business-strategy-fundamentals'), (13, 'strategic-leadership'),
        (14, 'innovation-management'), (15, 'entrepreneurship'), (21, 'design-principles'),
        (23, 'advanced-prototyping'), (24, 'design-leadership'), (25, 'brand-identity'),
        (29, 'growth-hacking'), (40, 'fintech-innovation'), (44, 'strategic-pmo'),
        (45, 'digital-transformation'), (46, 'software-engineering-internship'),
        (47, 'data-science-internship'), (48, 'marketing-internship'),
        (49, 'business-analyst-internship'), (50, 'ux-design-internship')
      ) AS target(id, slug) ON course."id" = target.id AND course."slug" = target.slug
     WHERE course."product_type" = 'assessment'
       AND course."assessment_purpose" = 'certification'
       AND (course."review_status" <> 'archived' OR NOT EXISTS (
         SELECT 1 FROM "assessment_shell_archival_records" record WHERE record."course_id" = course."id"
       ))
  ) THEN
    RAISE EXCEPTION '0040 archival guard failed: an audited shell was unsafe or lacks immutable rationale';
  END IF;
END $$;

--> statement-breakpoint
-- These tables supersede the legacy action stream from 0036. A grant names its
-- principal, exact role, granting administrator, grant time, optional expiry,
-- and any exceptional role consolidation. Revocation is a separate immutable
-- event, so neither grants nor their audit history can be rewritten.
CREATE TABLE "assessment_release_role_grants" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "release_role" text NOT NULL,
  "granted_by_user_id" integer NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "reason" text NOT NULL,
  "single_officer_exception" boolean DEFAULT false NOT NULL,
  "single_officer_exception_reason" text,
  CONSTRAINT "assessment_release_role_grants_role_check" CHECK (
    "release_role" IN ('release_operator', 'accessibility_reviewer', 'content_reviewer', 'rights_reviewer', 'cut_score_approver', 'qa_reviewer', 'publisher', 'rollback_owner')
  ),
  CONSTRAINT "assessment_release_role_grants_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "granted_at"),
  CONSTRAINT "assessment_release_role_grants_reason_check" CHECK (length(btrim("reason")) BETWEEN 20 AND 1000),
  CONSTRAINT "assessment_release_role_grants_exception_check" CHECK (
    ("single_officer_exception" = false AND "single_officer_exception_reason" IS NULL)
    OR ("single_officer_exception" = true AND length(btrim("single_officer_exception_reason")) BETWEEN 20 AND 1000)
  )
);
--> statement-breakpoint
ALTER TABLE "assessment_release_role_grants" ADD CONSTRAINT "assessment_release_role_grants_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_role_grants" ADD CONSTRAINT "assessment_release_role_grants_granted_by_fk"
  FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_release_role_grants_principal_idx"
  ON "assessment_release_role_grants" ("user_id", "release_role", "granted_at", "id");

--> statement-breakpoint
CREATE TABLE "assessment_release_role_revocations" (
  "id" serial PRIMARY KEY NOT NULL,
  "grant_id" integer NOT NULL,
  "revoked_by_user_id" integer NOT NULL,
  "revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reason" text NOT NULL,
  CONSTRAINT "assessment_release_role_revocations_grant_unique" UNIQUE ("grant_id"),
  CONSTRAINT "assessment_release_role_revocations_reason_check" CHECK (length(btrim("reason")) BETWEEN 20 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "assessment_release_role_revocations" ADD CONSTRAINT "assessment_release_role_revocations_grant_fk"
  FOREIGN KEY ("grant_id") REFERENCES "assessment_release_role_grants"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_role_revocations" ADD CONSTRAINT "assessment_release_role_revocations_revoked_by_fk"
  FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_release_role_revocations_revoked_at_idx"
  ON "assessment_release_role_revocations" ("revoked_at", "id");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_grant()
RETURNS trigger AS $$
DECLARE
  grantor_is_admin boolean;
  principal_identity text;
  conflicting_roles text[] := ARRAY['accessibility_reviewer','content_reviewer','rights_reviewer','cut_score_approver','qa_reviewer','publisher'];
  has_conflicting_grant boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(7362, NEW."user_id");
  SELECT "is_admin" INTO grantor_is_admin FROM "users" WHERE "id" = NEW."granted_by_user_id";
  IF grantor_is_admin IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Release-role grants must be issued by a platform administrator';
  END IF;

  SELECT lower(concat_ws(' ', "name", "email")) INTO principal_identity FROM "users" WHERE "id" = NEW."user_id";
  IF principal_identity IS NULL THEN
    RAISE EXCEPTION 'Release-role principal does not exist';
  END IF;
  IF principal_identity ~ '(^|[^a-z0-9])(smoke|test|testing|automation|automated|bot|robot|system|service account)([^a-z0-9]|$)'
    OR principal_identity ~ '\m(ai|artificial intelligence)\M.*\m(author|authoring|generated|automation)\M'
    OR principal_identity ~ '\massessment authoring\M'
  THEN
    RAISE EXCEPTION 'Automation, AI-authoring, test, and smoke identities cannot receive release roles';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "assessment_release_role_grants" grant_row
     WHERE grant_row."user_id" = NEW."user_id" AND grant_row."release_role" = NEW."release_role"
       AND (grant_row."expires_at" IS NULL OR grant_row."expires_at" > NEW."granted_at")
       AND NOT EXISTS (SELECT 1 FROM "assessment_release_role_revocations" revocation WHERE revocation."grant_id" = grant_row."id")
  ) THEN
    RAISE EXCEPTION 'A current grant already exists for this release principal and role';
  END IF;

  SELECT NEW."release_role" = ANY(conflicting_roles) AND EXISTS (
    SELECT 1 FROM "assessment_release_role_grants" grant_row
     WHERE grant_row."user_id" = NEW."user_id"
       AND grant_row."release_role" = ANY(conflicting_roles)
       AND grant_row."release_role" <> NEW."release_role"
       AND (grant_row."expires_at" IS NULL OR grant_row."expires_at" > NEW."granted_at")
       AND NOT EXISTS (SELECT 1 FROM "assessment_release_role_revocations" revocation WHERE revocation."grant_id" = grant_row."id")
  ) INTO has_conflicting_grant;

  IF has_conflicting_grant AND NEW."single_officer_exception" IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Conflicting release roles require an explicit audited single-officer exception';
  END IF;
  IF NOT has_conflicting_grant AND NEW."single_officer_exception" IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Single-officer exception may be recorded only for an actual conflicting-role consolidation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_release_role_grants_policy
  BEFORE INSERT ON "assessment_release_role_grants"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_grant();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_revocation()
RETURNS trigger AS $$
DECLARE
  revoker_is_admin boolean;
  original_granted_at timestamp with time zone;
BEGIN
  SELECT "is_admin" INTO revoker_is_admin FROM "users" WHERE "id" = NEW."revoked_by_user_id";
  IF revoker_is_admin IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Release-role revocations must be issued by a platform administrator';
  END IF;
  SELECT "granted_at" INTO original_granted_at FROM "assessment_release_role_grants" WHERE "id" = NEW."grant_id";
  IF original_granted_at IS NULL OR NEW."revoked_at" < original_granted_at THEN
    RAISE EXCEPTION 'Release-role revocation must follow the exact grant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_release_role_revocations_policy
  BEFORE INSERT ON "assessment_release_role_revocations"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_revocation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_assessment_release_role_authorization_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Assessment release-role authorization is append-only and immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_release_role_grants_immutable
  BEFORE UPDATE OR DELETE ON "assessment_release_role_grants"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_role_authorization_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_release_role_revocations_immutable
  BEFORE UPDATE OR DELETE ON "assessment_release_role_revocations"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_role_authorization_mutation();
