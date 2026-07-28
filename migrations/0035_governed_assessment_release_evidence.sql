-- Attributable assessment release evidence is bound to an exact immutable
-- blueprint revision. These records are additive and append-only: a changed
-- blueprint or evidence set requires a new revision and new evidence records.
CREATE TABLE "assessment_accessibility_acceptances" (
  "id" serial PRIMARY KEY NOT NULL,
  "assessment_id" integer NOT NULL,
  "blueprint_revision" integer NOT NULL,
  "reviewer_user_id" integer NOT NULL,
  "standard" text NOT NULL,
  "evidence_reference" text NOT NULL,
  "evidence_sha256" text NOT NULL,
  "accepted_at" timestamp with time zone NOT NULL,
  "operator" text NOT NULL,
  "recorded_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_accessibility_acceptances_revision_unique" UNIQUE ("assessment_id", "blueprint_revision"),
  CONSTRAINT "assessment_accessibility_acceptances_revision_check" CHECK ("blueprint_revision" >= 1),
  CONSTRAINT "assessment_accessibility_acceptances_standard_check" CHECK (length(btrim("standard")) BETWEEN 3 AND 120),
  CONSTRAINT "assessment_accessibility_acceptances_reference_check" CHECK (length(btrim("evidence_reference")) BETWEEN 8 AND 500),
  CONSTRAINT "assessment_accessibility_acceptances_hash_check" CHECK ("evidence_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "assessment_accessibility_acceptances_operator_check" CHECK (length(btrim("operator")) BETWEEN 3 AND 200)
);
--> statement-breakpoint
ALTER TABLE "assessment_accessibility_acceptances" ADD CONSTRAINT "assessment_accessibility_acceptances_revision_fk"
  FOREIGN KEY ("assessment_id", "blueprint_revision") REFERENCES "course_question_blueprint_versions"("course_id", "revision") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_accessibility_acceptances" ADD CONSTRAINT "assessment_accessibility_acceptances_reviewer_fk"
  FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_accessibility_acceptances" ADD CONSTRAINT "assessment_accessibility_acceptances_recorded_by_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_accessibility_acceptances_assessment_idx"
  ON "assessment_accessibility_acceptances" ("assessment_id", "blueprint_revision", "accepted_at");

--> statement-breakpoint
CREATE TABLE "assessment_rights_role_reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "assessment_id" integer NOT NULL,
  "blueprint_revision" integer NOT NULL,
  "source_id" integer NOT NULL,
  "reviewer_user_id" integer NOT NULL,
  "evidence_reference" text NOT NULL,
  "evidence_sha256" text NOT NULL,
  "reviewed_at" timestamp with time zone NOT NULL,
  "operator" text NOT NULL,
  "recorded_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_rights_role_reviews_source_unique" UNIQUE ("assessment_id", "blueprint_revision", "source_id"),
  CONSTRAINT "assessment_rights_role_reviews_revision_check" CHECK ("blueprint_revision" >= 1),
  CONSTRAINT "assessment_rights_role_reviews_reference_check" CHECK (length(btrim("evidence_reference")) BETWEEN 8 AND 500),
  CONSTRAINT "assessment_rights_role_reviews_hash_check" CHECK ("evidence_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "assessment_rights_role_reviews_operator_check" CHECK (length(btrim("operator")) BETWEEN 3 AND 200)
);
--> statement-breakpoint
ALTER TABLE "assessment_rights_role_reviews" ADD CONSTRAINT "assessment_rights_role_reviews_revision_fk"
  FOREIGN KEY ("assessment_id", "blueprint_revision") REFERENCES "course_question_blueprint_versions"("course_id", "revision") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_rights_role_reviews" ADD CONSTRAINT "assessment_rights_role_reviews_source_fk"
  FOREIGN KEY ("source_id") REFERENCES "question_pack_sources"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_rights_role_reviews" ADD CONSTRAINT "assessment_rights_role_reviews_reviewer_fk"
  FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_rights_role_reviews" ADD CONSTRAINT "assessment_rights_role_reviews_recorded_by_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_rights_role_reviews_assessment_idx"
  ON "assessment_rights_role_reviews" ("assessment_id", "blueprint_revision", "source_id");

--> statement-breakpoint
CREATE TABLE "assessment_release_bundles" (
  "id" serial PRIMARY KEY NOT NULL,
  "assessment_id" integer NOT NULL,
  "blueprint_revision" integer NOT NULL,
  "content_manifest_sha256" text NOT NULL,
  "form_simulation_reference" text NOT NULL,
  "form_simulation_sha256" text NOT NULL,
  "cut_score" integer NOT NULL,
  "cut_score_method" text NOT NULL,
  "cut_score_approval_reference" text NOT NULL,
  "cut_score_approval_sha256" text NOT NULL,
  "cut_score_approver_user_id" integer NOT NULL,
  "cut_score_approved_at" timestamp with time zone NOT NULL,
  "release_qa_reference" text NOT NULL,
  "release_qa_sha256" text NOT NULL,
  "qa_reviewer_user_id" integer NOT NULL,
  "qa_accepted_at" timestamp with time zone NOT NULL,
  "content_reviewer_user_id" integer NOT NULL,
  "publisher_user_id" integer NOT NULL,
  "publisher_signed_at" timestamp with time zone NOT NULL,
  "release_commit" text NOT NULL,
  "released_at" timestamp with time zone NOT NULL,
  "rollback_owner_user_id" integer NOT NULL,
  "takedown_procedure" text NOT NULL,
  "takedown_procedure_sha256" text NOT NULL,
  "bundle_sha256" text NOT NULL,
  "operator" text NOT NULL,
  "recorded_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_release_bundles_revision_unique" UNIQUE ("assessment_id", "blueprint_revision"),
  CONSTRAINT "assessment_release_bundles_revision_check" CHECK ("blueprint_revision" >= 1),
  CONSTRAINT "assessment_release_bundles_hashes_check" CHECK (
    "content_manifest_sha256" ~ '^[0-9a-f]{64}$'
    AND "form_simulation_sha256" ~ '^[0-9a-f]{64}$'
    AND "cut_score_approval_sha256" ~ '^[0-9a-f]{64}$'
    AND "release_qa_sha256" ~ '^[0-9a-f]{64}$'
    AND "takedown_procedure_sha256" ~ '^[0-9a-f]{64}$'
    AND "bundle_sha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "assessment_release_bundles_references_check" CHECK (
    length(btrim("form_simulation_reference")) BETWEEN 8 AND 500
    AND length(btrim("cut_score_approval_reference")) BETWEEN 8 AND 500
    AND length(btrim("release_qa_reference")) BETWEEN 8 AND 500
  ),
  CONSTRAINT "assessment_release_bundles_cut_score_check" CHECK ("cut_score" BETWEEN 0 AND 100),
  CONSTRAINT "assessment_release_bundles_cut_score_method_check" CHECK (length(btrim("cut_score_method")) BETWEEN 3 AND 500),
  CONSTRAINT "assessment_release_bundles_commit_check" CHECK ("release_commit" ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
  CONSTRAINT "assessment_release_bundles_takedown_check" CHECK (length(btrim("takedown_procedure")) BETWEEN 20 AND 4000),
  CONSTRAINT "assessment_release_bundles_operator_check" CHECK (length(btrim("operator")) BETWEEN 3 AND 200),
  CONSTRAINT "assessment_release_bundles_time_order_check" CHECK (
    "cut_score_approved_at" <= "released_at"
    AND "qa_accepted_at" <= "released_at"
    AND "publisher_signed_at" <= "released_at"
  ),
  CONSTRAINT "assessment_release_bundles_internal_separation_check" CHECK (
    "content_reviewer_user_id" <> "cut_score_approver_user_id"
    AND "content_reviewer_user_id" <> "qa_reviewer_user_id"
    AND "content_reviewer_user_id" <> "publisher_user_id"
    AND "cut_score_approver_user_id" <> "qa_reviewer_user_id"
    AND "cut_score_approver_user_id" <> "publisher_user_id"
    AND "qa_reviewer_user_id" <> "publisher_user_id"
  )
);
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_revision_fk"
  FOREIGN KEY ("assessment_id", "blueprint_revision") REFERENCES "course_question_blueprint_versions"("course_id", "revision") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_cut_score_approver_fk"
  FOREIGN KEY ("cut_score_approver_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_qa_reviewer_fk"
  FOREIGN KEY ("qa_reviewer_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_content_reviewer_fk"
  FOREIGN KEY ("content_reviewer_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_publisher_fk"
  FOREIGN KEY ("publisher_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_rollback_owner_fk"
  FOREIGN KEY ("rollback_owner_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_recorded_by_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_release_bundles_assessment_idx"
  ON "assessment_release_bundles" ("assessment_id", "blueprint_revision", "released_at");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_separation()
RETURNS trigger AS $$
DECLARE
  assessment integer;
  revision integer;
  reviewer integer;
BEGIN
  assessment := NEW."assessment_id";
  revision := NEW."blueprint_revision";
  IF TG_TABLE_NAME = 'assessment_accessibility_acceptances' THEN
    reviewer := NEW."reviewer_user_id";
    IF EXISTS (
      SELECT 1 FROM "assessment_rights_role_reviews" rights
      WHERE rights."assessment_id" = assessment
        AND rights."blueprint_revision" = revision
        AND rights."reviewer_user_id" = reviewer
    ) OR EXISTS (
      SELECT 1 FROM "assessment_release_bundles" bundle
      WHERE bundle."assessment_id" = assessment
        AND bundle."blueprint_revision" = revision
        AND reviewer IN (bundle."content_reviewer_user_id", bundle."cut_score_approver_user_id", bundle."qa_reviewer_user_id", bundle."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Accessibility reviewer must be independent from content, rights, QA, cut-score, and publisher roles';
    END IF;
  ELSIF TG_TABLE_NAME = 'assessment_rights_role_reviews' THEN
    reviewer := NEW."reviewer_user_id";
    IF EXISTS (
      SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
      WHERE accessibility."assessment_id" = assessment
        AND accessibility."blueprint_revision" = revision
        AND accessibility."reviewer_user_id" = reviewer
    ) OR EXISTS (
      SELECT 1 FROM "assessment_release_bundles" bundle
      WHERE bundle."assessment_id" = assessment
        AND bundle."blueprint_revision" = revision
        AND reviewer IN (bundle."content_reviewer_user_id", bundle."cut_score_approver_user_id", bundle."qa_reviewer_user_id", bundle."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Rights reviewer must be independent from accessibility, content, QA, cut-score, and publisher roles';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
      WHERE accessibility."assessment_id" = assessment
        AND accessibility."blueprint_revision" = revision
        AND accessibility."reviewer_user_id" IN (NEW."content_reviewer_user_id", NEW."cut_score_approver_user_id", NEW."qa_reviewer_user_id", NEW."publisher_user_id")
    ) OR EXISTS (
      SELECT 1 FROM "assessment_rights_role_reviews" rights
      WHERE rights."assessment_id" = assessment
        AND rights."blueprint_revision" = revision
        AND rights."reviewer_user_id" IN (NEW."content_reviewer_user_id", NEW."cut_score_approver_user_id", NEW."qa_reviewer_user_id", NEW."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Release sign-off roles must be independent from accessibility and rights reviewers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_accessibility_acceptances_role_separation
  BEFORE INSERT ON "assessment_accessibility_acceptances"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_separation();
--> statement-breakpoint
CREATE TRIGGER assessment_rights_role_reviews_role_separation
  BEFORE INSERT ON "assessment_rights_role_reviews"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_separation();
--> statement-breakpoint
CREATE TRIGGER assessment_release_bundles_role_separation
  BEFORE INSERT ON "assessment_release_bundles"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_separation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_assessment_release_evidence_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Assessment release evidence is append-only and immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_accessibility_acceptances_immutable
  BEFORE UPDATE OR DELETE ON "assessment_accessibility_acceptances"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_rights_role_reviews_immutable
  BEFORE UPDATE OR DELETE ON "assessment_rights_role_reviews"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_release_bundles_immutable
  BEFORE UPDATE OR DELETE ON "assessment_release_bundles"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_evidence_mutation();
