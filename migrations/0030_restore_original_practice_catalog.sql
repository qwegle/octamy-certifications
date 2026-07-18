-- Incident recovery: migration 0029 retired every question from the verified
-- Octamy original quantitative/science source and consequently removed all
-- eleven Practice Pass assessments from the public catalogue. No rows were
-- deleted. Restore only the exact source-controlled inventory that was live in
-- the 2026-07-18T03:00:01Z pre-incident backup. Smoke, test and career filler
-- inventories remain retired.
UPDATE "questions" question
SET
  "is_active" = true,
  "review_status" = 'approved',
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "question_provenance" provenance
  INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
  WHERE provenance."question_id" = question."id"
    AND source."source_key" = 'octamy-original:quant-science:v1'
    AND source."rights_review_status" = 'verified'
)
AND EXISTS (
  SELECT 1
  FROM "course_question_blueprint" blueprint
  INNER JOIN "courses" course ON course."id" = blueprint."course_id"
  WHERE blueprint."bank_id" = question."bank_id"
    AND course."slug" IN (
      'ssc-cgl-tier-1-quantitative-aptitude-practice',
      'ssc-chsl-tier-1-quantitative-aptitude-practice',
      'ssc-mts-numerical-aptitude-practice',
      'rrb-ntpc-mathematics-practice',
      'rrb-group-d-mathematics-practice',
      'ibps-po-quantitative-aptitude-practice',
      'ibps-clerk-quantitative-aptitude-practice',
      'neet-ug-physics-numerical-practice',
      'jee-main-physics-numerical-practice',
      'neet-ug-chemistry-numerical-practice',
      'jee-main-chemistry-numerical-practice'
    )
);
--> statement-breakpoint
UPDATE "question_banks" bank
SET
  "status" = 'active',
  "visibility" = 'private',
  "bank_purpose" = 'practice',
  "question_count" = (
    SELECT count(*)::integer
    FROM "questions" question
    WHERE question."bank_id" = bank."id"
      AND question."is_active" = true
      AND question."review_status" = 'approved'
  ),
  "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "course_question_blueprint" blueprint
  INNER JOIN "courses" course ON course."id" = blueprint."course_id"
  WHERE blueprint."bank_id" = bank."id"
    AND course."slug" IN (
      'ssc-cgl-tier-1-quantitative-aptitude-practice',
      'ssc-chsl-tier-1-quantitative-aptitude-practice',
      'ssc-mts-numerical-aptitude-practice',
      'rrb-ntpc-mathematics-practice',
      'rrb-group-d-mathematics-practice',
      'ibps-po-quantitative-aptitude-practice',
      'ibps-clerk-quantitative-aptitude-practice',
      'neet-ug-physics-numerical-practice',
      'jee-main-physics-numerical-practice',
      'neet-ug-chemistry-numerical-practice',
      'jee-main-chemistry-numerical-practice'
    )
);
--> statement-breakpoint
UPDATE "courses" course
SET
  "is_active" = true,
  "visibility" = 'public',
  "review_status" = 'approved',
  "subscription_eligible" = true,
  "reseller_eligible" = true,
  "default_review_policy" = 'immediate',
  "use_blueprint_engine" = true
WHERE course."product_type" = 'assessment'
  AND course."assessment_purpose" = 'practice'
  AND course."slug" IN (
    'ssc-cgl-tier-1-quantitative-aptitude-practice',
    'ssc-chsl-tier-1-quantitative-aptitude-practice',
    'ssc-mts-numerical-aptitude-practice',
    'rrb-ntpc-mathematics-practice',
    'rrb-group-d-mathematics-practice',
    'ibps-po-quantitative-aptitude-practice',
    'ibps-clerk-quantitative-aptitude-practice',
    'neet-ug-physics-numerical-practice',
    'jee-main-physics-numerical-practice',
    'neet-ug-chemistry-numerical-practice',
    'jee-main-chemistry-numerical-practice'
  )
  AND EXISTS (
    SELECT 1
    FROM "course_question_blueprint" blueprint
    INNER JOIN "question_banks" bank ON bank."id" = blueprint."bank_id"
    WHERE blueprint."course_id" = course."id"
      AND EXISTS (
        SELECT 1
        FROM "questions" question
        INNER JOIN "question_provenance" provenance ON provenance."question_id" = question."id"
        INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
        WHERE question."bank_id" = bank."id"
          AND source."source_key" = 'octamy-original:quant-science:v1'
          AND source."rights_review_status" = 'verified'
      )
  );
