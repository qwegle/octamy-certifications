-- Align single-accountable-officer item-authorship enforcement with the
-- recorder and governed inventory evaluator. Item-level review independence is
-- still absolute: an officer who reviewed any in-scope item is refused. An
-- officer who authored an in-scope item may attest only when the exact canonical
-- disclosure is present in both the immutable attestation and the separately
-- hashed takedown evidence.
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_separation()
RETURNS trigger AS $$
DECLARE
  single_officer integer;
  officer_is_admin boolean;
  officer_item_authorship_disclosure constant text := 'ACCOUNTABLE_OFFICER_ITEM_AUTHORSHIP_DISCLOSURE: The accountable officer authored one or more in-scope items; every such item has a different attributable reviewer bound to its exact content hash and version; no independent multi-party release review occurred.';
BEGIN
  IF NEW."attestation_mode" = 'single_accountable_officer' THEN
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
    IF EXISTS (
      SELECT 1 FROM "questions" question
       WHERE question."reviewed_by" = single_officer
         AND question."review_status" = 'approved'
         AND question."is_active" = true
         AND EXISTS (
           SELECT 1 FROM "course_question_blueprint" blueprint
            WHERE blueprint."course_id" = NEW."assessment_id"
              AND blueprint."bank_id" = question."bank_id"
              AND (blueprint."topic_id" IS NULL OR blueprint."topic_id" = question."topic_id")
              AND (blueprint."difficulty" = 'mixed' OR blueprint."difficulty" = question."difficulty")
         )
    ) THEN
      RAISE EXCEPTION 'Single accountable officer cannot be the recorded independent reviewer for an in-scope item';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "questions" question
       WHERE question."created_by" = single_officer
         AND question."review_status" = 'approved'
         AND question."is_active" = true
         AND EXISTS (
           SELECT 1 FROM "course_question_blueprint" blueprint
            WHERE blueprint."course_id" = NEW."assessment_id"
              AND blueprint."bank_id" = question."bank_id"
              AND (blueprint."topic_id" IS NULL OR blueprint."topic_id" = question."topic_id")
              AND (blueprint."difficulty" = 'mixed' OR blueprint."difficulty" = question."difficulty")
         )
    ) AND (
      position(officer_item_authorship_disclosure IN COALESCE(NEW."single_officer_attestation", '')) = 0
      OR position(officer_item_authorship_disclosure IN COALESCE(NEW."takedown_procedure", '')) = 0
    ) THEN
      RAISE EXCEPTION 'Officer item authorship requires the canonical disclosure in both the immutable attestation and hashed takedown evidence';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
       WHERE accessibility."assessment_id" = NEW."assessment_id"
         AND accessibility."blueprint_revision" = NEW."blueprint_revision"
         AND accessibility."reviewer_user_id" <> single_officer
    ) OR EXISTS (
      SELECT 1 FROM "assessment_rights_role_reviews" rights
       WHERE rights."assessment_id" = NEW."assessment_id"
         AND rights."blueprint_revision" = NEW."blueprint_revision"
         AND rights."reviewer_user_id" <> single_officer
    ) THEN
      RAISE EXCEPTION 'Single-officer release evidence must be attributed to the accountable officer';
    END IF;
  ELSIF NEW."attestation_mode" = 'multi_party' THEN
    IF EXISTS (
      SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
       WHERE accessibility."assessment_id" = NEW."assessment_id"
         AND accessibility."blueprint_revision" = NEW."blueprint_revision"
         AND accessibility."reviewer_user_id" IN (NEW."content_reviewer_user_id", NEW."cut_score_approver_user_id", NEW."qa_reviewer_user_id", NEW."publisher_user_id")
    ) OR EXISTS (
      SELECT 1 FROM "assessment_rights_role_reviews" rights
       WHERE rights."assessment_id" = NEW."assessment_id"
         AND rights."blueprint_revision" = NEW."blueprint_revision"
         AND rights."reviewer_user_id" IN (NEW."content_reviewer_user_id", NEW."cut_score_approver_user_id", NEW."qa_reviewer_user_id", NEW."publisher_user_id")
    ) THEN
      RAISE EXCEPTION 'Release sign-off roles must be independent from accessibility and rights reviewers';
    END IF;
  ELSE
    RAISE EXCEPTION 'Release attestation mode must be multi_party or single_accountable_officer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
DROP TRIGGER IF EXISTS assessment_release_bundles_role_separation ON "assessment_release_bundles";
--> statement-breakpoint
CREATE TRIGGER assessment_release_bundles_role_separation
  BEFORE INSERT ON "assessment_release_bundles"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_separation();
