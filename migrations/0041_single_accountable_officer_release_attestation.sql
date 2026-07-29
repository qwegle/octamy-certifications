-- Honest release-attestation modes for organisations of different sizes.
-- Existing evidence is classified as multi-party. New single-officer evidence
-- remains visibly distinct and must carry three exact machine-artifact digests.
ALTER TABLE "assessment_release_bundles"
  ADD COLUMN "attestation_mode" text DEFAULT 'multi_party' NOT NULL,
  ADD COLUMN "accountable_officer_user_id" integer,
  ADD COLUMN "single_officer_attestation" text;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_accountable_officer_fk"
  FOREIGN KEY ("accountable_officer_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" ADD CONSTRAINT "assessment_release_bundles_attestation_mode_check" CHECK (
  ("attestation_mode" = 'multi_party'
    AND "accountable_officer_user_id" IS NULL
    AND "single_officer_attestation" IS NULL
    AND "content_reviewer_user_id" <> "cut_score_approver_user_id"
    AND "content_reviewer_user_id" <> "qa_reviewer_user_id"
    AND "content_reviewer_user_id" <> "publisher_user_id"
    AND "cut_score_approver_user_id" <> "qa_reviewer_user_id"
    AND "cut_score_approver_user_id" <> "publisher_user_id"
    AND "qa_reviewer_user_id" <> "publisher_user_id")
  OR
  ("attestation_mode" = 'single_accountable_officer'
    AND "accountable_officer_user_id" IS NOT NULL
    AND length(btrim("single_officer_attestation")) BETWEEN 20 AND 1000
    AND "content_reviewer_user_id" = "accountable_officer_user_id"
    AND "cut_score_approver_user_id" = "accountable_officer_user_id"
    AND "qa_reviewer_user_id" = "accountable_officer_user_id"
    AND "publisher_user_id" = "accountable_officer_user_id"
    AND "rollback_owner_user_id" = "accountable_officer_user_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles"
  DROP CONSTRAINT "assessment_release_bundles_internal_separation_check";

--> statement-breakpoint
-- Single-officer mode is accepted only for a real administrator with a current
-- release_operator grant. The compact artifact envelopes and their exact hashes
-- remain mandatory in the original immutable evidence columns; the application
-- evaluator verifies their type, result, revision, assessment and SHA-256.
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_separation()
RETURNS trigger AS $$
DECLARE
  assessment integer;
  revision integer;
  reviewer integer;
  single_officer integer;
  officer_is_admin boolean;
BEGIN
  assessment := NEW."assessment_id";
  revision := NEW."blueprint_revision";

  SELECT bundle."accountable_officer_user_id" INTO single_officer
    FROM "assessment_release_bundles" bundle
   WHERE bundle."assessment_id" = assessment
     AND bundle."blueprint_revision" = revision
     AND bundle."attestation_mode" = 'single_accountable_officer';

  IF TG_TABLE_NAME = 'assessment_release_bundles'
     AND NEW."attestation_mode" = 'single_accountable_officer' THEN
    single_officer := NEW."accountable_officer_user_id";
    SELECT "is_admin" INTO officer_is_admin FROM "users" WHERE "id" = single_officer;
    IF officer_is_admin IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Single accountable officer must be a platform administrator';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "assessment_release_role_grants" grant_row
       WHERE grant_row."user_id" = single_officer
         AND grant_row."release_role" = 'release_operator'
         AND grant_row."granted_at" <= NEW."released_at"
         AND (grant_row."expires_at" IS NULL OR grant_row."expires_at" > NEW."released_at")
         AND NOT EXISTS (
           SELECT 1 FROM "assessment_release_role_revocations" revocation
            WHERE revocation."grant_id" = grant_row."id"
              AND revocation."revoked_at" <= NEW."released_at"
         )
    ) THEN
      RAISE EXCEPTION 'Single accountable officer requires a current release_operator grant';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'assessment_accessibility_acceptances' THEN
    reviewer := NEW."reviewer_user_id";
    IF single_officer IS NOT NULL THEN
      IF reviewer <> single_officer THEN
        RAISE EXCEPTION 'Single-officer accessibility artifact must be attributed to the accountable officer';
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM "assessment_rights_role_reviews" rights
       WHERE rights."assessment_id" = assessment AND rights."blueprint_revision" = revision
         AND rights."reviewer_user_id" = reviewer
    ) OR EXISTS (
      SELECT 1 FROM "assessment_release_bundles" bundle
       WHERE bundle."assessment_id" = assessment AND bundle."blueprint_revision" = revision
         AND reviewer IN (bundle."content_reviewer_user_id", bundle."cut_score_approver_user_id", bundle."qa_reviewer_user_id", bundle."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Accessibility reviewer must be independent from content, rights, QA, cut-score, and publisher roles';
    END IF;
  ELSIF TG_TABLE_NAME = 'assessment_rights_role_reviews' THEN
    reviewer := NEW."reviewer_user_id";
    IF single_officer IS NOT NULL THEN
      IF reviewer <> single_officer THEN
        RAISE EXCEPTION 'Single-officer rights review must be attributed to the accountable officer';
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
       WHERE accessibility."assessment_id" = assessment AND accessibility."blueprint_revision" = revision
         AND accessibility."reviewer_user_id" = reviewer
    ) OR EXISTS (
      SELECT 1 FROM "assessment_release_bundles" bundle
       WHERE bundle."assessment_id" = assessment AND bundle."blueprint_revision" = revision
         AND reviewer IN (bundle."content_reviewer_user_id", bundle."cut_score_approver_user_id", bundle."qa_reviewer_user_id", bundle."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Rights reviewer must be independent from accessibility, content, QA, cut-score, and publisher roles';
    END IF;
  ELSIF NEW."attestation_mode" = 'multi_party' THEN
    IF EXISTS (
      SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
       WHERE accessibility."assessment_id" = assessment AND accessibility."blueprint_revision" = revision
         AND accessibility."reviewer_user_id" IN (NEW."content_reviewer_user_id", NEW."cut_score_approver_user_id", NEW."qa_reviewer_user_id", NEW."publisher_user_id")
    ) OR EXISTS (
      SELECT 1 FROM "assessment_rights_role_reviews" rights
       WHERE rights."assessment_id" = assessment AND rights."blueprint_revision" = revision
         AND rights."reviewer_user_id" IN (NEW."content_reviewer_user_id", NEW."cut_score_approver_user_id", NEW."qa_reviewer_user_id", NEW."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Release sign-off roles must be independent from accessibility and rights reviewers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
