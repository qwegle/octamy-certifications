-- Repair the 0041 trigger without weakening release-bundle mode validation.
-- Each trigger function now references only columns present on its attached table.
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_separation()
RETURNS trigger AS $$
DECLARE
  single_officer integer;
  officer_is_admin boolean;
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
       WHERE (question."created_by" = single_officer OR question."reviewed_by" = single_officer)
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
      RAISE EXCEPTION 'Single accountable officer must remain independent from every in-scope item author and reviewer';
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
CREATE OR REPLACE FUNCTION enforce_assessment_accessibility_role_separation()
RETURNS trigger AS $$
DECLARE
  single_officer integer;
BEGIN
  SELECT bundle."accountable_officer_user_id" INTO single_officer
    FROM "assessment_release_bundles" bundle
   WHERE bundle."assessment_id" = NEW."assessment_id"
     AND bundle."blueprint_revision" = NEW."blueprint_revision"
     AND bundle."attestation_mode" = 'single_accountable_officer';

  IF single_officer IS NOT NULL THEN
    IF NEW."reviewer_user_id" <> single_officer THEN
      RAISE EXCEPTION 'Single-officer accessibility artifact must be attributed to the accountable officer';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM "assessment_rights_role_reviews" rights
     WHERE rights."assessment_id" = NEW."assessment_id"
       AND rights."blueprint_revision" = NEW."blueprint_revision"
       AND rights."reviewer_user_id" = NEW."reviewer_user_id"
  ) OR EXISTS (
    SELECT 1 FROM "assessment_release_bundles" bundle
     WHERE bundle."assessment_id" = NEW."assessment_id"
       AND bundle."blueprint_revision" = NEW."blueprint_revision"
       AND NEW."reviewer_user_id" IN (bundle."content_reviewer_user_id", bundle."cut_score_approver_user_id", bundle."qa_reviewer_user_id", bundle."publisher_user_id")
  ) THEN
    RAISE EXCEPTION 'Accessibility reviewer must be independent from content, rights, QA, cut-score, and publisher roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_assessment_rights_role_separation()
RETURNS trigger AS $$
DECLARE
  single_officer integer;
BEGIN
  SELECT bundle."accountable_officer_user_id" INTO single_officer
    FROM "assessment_release_bundles" bundle
   WHERE bundle."assessment_id" = NEW."assessment_id"
     AND bundle."blueprint_revision" = NEW."blueprint_revision"
     AND bundle."attestation_mode" = 'single_accountable_officer';

  IF single_officer IS NOT NULL THEN
    IF NEW."reviewer_user_id" <> single_officer THEN
      RAISE EXCEPTION 'Single-officer rights review must be attributed to the accountable officer';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM "assessment_accessibility_acceptances" accessibility
     WHERE accessibility."assessment_id" = NEW."assessment_id"
       AND accessibility."blueprint_revision" = NEW."blueprint_revision"
       AND accessibility."reviewer_user_id" = NEW."reviewer_user_id"
  ) OR EXISTS (
    SELECT 1 FROM "assessment_release_bundles" bundle
     WHERE bundle."assessment_id" = NEW."assessment_id"
       AND bundle."blueprint_revision" = NEW."blueprint_revision"
       AND NEW."reviewer_user_id" IN (bundle."content_reviewer_user_id", bundle."cut_score_approver_user_id", bundle."qa_reviewer_user_id", bundle."publisher_user_id")
  ) THEN
    RAISE EXCEPTION 'Rights reviewer must be independent from accessibility, content, QA, cut-score, and publisher roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
DROP TRIGGER IF EXISTS assessment_accessibility_acceptances_role_separation ON "assessment_accessibility_acceptances";
--> statement-breakpoint
CREATE TRIGGER assessment_accessibility_acceptances_role_separation
  BEFORE INSERT ON "assessment_accessibility_acceptances"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_accessibility_role_separation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS assessment_rights_role_reviews_role_separation ON "assessment_rights_role_reviews";
--> statement-breakpoint
CREATE TRIGGER assessment_rights_role_reviews_role_separation
  BEFORE INSERT ON "assessment_rights_role_reviews"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_rights_role_separation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS assessment_release_bundles_role_separation ON "assessment_release_bundles";
--> statement-breakpoint
CREATE TRIGGER assessment_release_bundles_role_separation
  BEFORE INSERT ON "assessment_release_bundles"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_separation();

--> statement-breakpoint
-- Record the exact extant blueprint for published assessments that predate the
-- immutable revision ledger. This is an append-only snapshot; live blueprint
-- rows and all course publication fields remain unchanged.
INSERT INTO "course_question_blueprint_versions"
  ("course_id", "revision", "items", "change_note", "changed_by", "created_at")
SELECT course."id", 1,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'bankId', blueprint."bank_id",
           'topicId', blueprint."topic_id",
           'questionCount', blueprint."question_count",
           'difficulty', blueprint."difficulty",
           'marksPerQuestion', blueprint."marks_per_question",
           'negativeMarks', blueprint."negative_marks",
           'sortOrder', blueprint."sort_order"
         ) ORDER BY blueprint."sort_order", blueprint."id")
           FROM "course_question_blueprint" blueprint
          WHERE blueprint."course_id" = course."id"
       ), '[]'::jsonb),
       'Immutable snapshot of unchanged published blueprint recorded by migration 0042; no blueprint fields changed.',
       NULL,
       now()
  FROM "courses" course
 WHERE course."product_type" = 'assessment'
   AND course."is_active" = true
   AND course."visibility" = 'public'
   AND course."review_status" = 'approved'
   AND EXISTS (SELECT 1 FROM "course_question_blueprint" blueprint WHERE blueprint."course_id" = course."id")
   AND NOT EXISTS (SELECT 1 FROM "course_question_blueprint_versions" version WHERE version."course_id" = course."id")
ON CONFLICT ("course_id", "revision") DO NOTHING;

--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "courses" course
     WHERE course."product_type" = 'assessment'
       AND course."is_active" = true
       AND course."visibility" = 'public'
       AND course."review_status" = 'approved'
       AND EXISTS (SELECT 1 FROM "course_question_blueprint" blueprint WHERE blueprint."course_id" = course."id")
       AND NOT EXISTS (SELECT 1 FROM "course_question_blueprint_versions" version WHERE version."course_id" = course."id")
  ) THEN
    RAISE EXCEPTION '0042 blueprint snapshot guard failed: a published assessment with a live blueprint still lacks an immutable revision';
  END IF;
END $$;
