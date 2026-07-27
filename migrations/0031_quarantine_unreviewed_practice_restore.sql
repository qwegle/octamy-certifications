-- Migration 0030 was an incident-availability override that restored a source
-- whose signed content review rejected publication. Capture only rows still in
-- the exact unreviewed state written by 0030; never clear a later attributable
-- review or touch unrelated banks that happen to share source provenance.
CREATE TEMP TABLE "octamy_0031_quarantined_banks" (
  "bank_id" integer PRIMARY KEY
) ON COMMIT DROP;
--> statement-breakpoint
WITH quarantined AS (
  UPDATE "questions" question
  SET
    "is_active" = false,
    "review_status" = 'retired',
    "updated_at" = now()
  WHERE question."is_active" = true
    AND question."review_status" = 'approved'
    AND question."reviewed_by" IS NULL
    AND question."reviewed_at" IS NULL
    AND EXISTS (
      SELECT 1
      FROM "question_provenance" provenance
      INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
      WHERE provenance."question_id" = question."id"
        AND source."source_key" = 'octamy-original:quant-science:v1'
    )
    AND EXISTS (
      SELECT 1
      FROM "question_banks" bank
      INNER JOIN "course_question_blueprint" blueprint ON blueprint."bank_id" = bank."id"
      INNER JOIN "courses" course ON course."id" = blueprint."course_id"
      WHERE bank."id" = question."bank_id"
        AND bank."bank_purpose" = 'practice'
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
    )
  RETURNING question."bank_id"
)
INSERT INTO "octamy_0031_quarantined_banks" ("bank_id")
SELECT DISTINCT "bank_id" FROM quarantined
WHERE "bank_id" IS NOT NULL
ON CONFLICT ("bank_id") DO NOTHING;
--> statement-breakpoint
-- Reconcile only pools in which this migration actually quarantined a row.
UPDATE "question_banks" bank
SET
  "question_count" = (
    SELECT count(*)::integer
    FROM "questions" question
    WHERE question."bank_id" = bank."id"
      AND question."review_status" <> 'retired'
  ),
  "status" = CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM "questions" question
      WHERE question."bank_id" = bank."id"
        AND question."review_status" <> 'retired'
    ) THEN 'archived'
    ELSE bank."status"
  END,
  "visibility" = 'private',
  "updated_at" = now()
WHERE bank."id" IN (
  SELECT quarantined_bank."bank_id"
  FROM "octamy_0031_quarantined_banks" quarantined_bank
);
--> statement-breakpoint
-- An approved public shell containing a newly quarantined blueprint pool is no
-- longer release-ready. Already-private shells and courses whose rows were not
-- changed above are left untouched.
UPDATE "courses" course
SET
  "is_active" = false,
  "visibility" = 'private',
  "review_status" = 'pending',
  "subscription_eligible" = false,
  "reseller_eligible" = false,
  "featured_at" = NULL
WHERE course."product_type" = 'assessment'
  AND course."assessment_purpose" = 'practice'
  AND course."is_active" = true
  AND course."visibility" = 'public'
  AND course."review_status" = 'approved'
  AND EXISTS (
    SELECT 1
    FROM "course_question_blueprint" blueprint
    INNER JOIN "octamy_0031_quarantined_banks" quarantined_bank
      ON quarantined_bank."bank_id" = blueprint."bank_id"
    WHERE blueprint."course_id" = course."id"
  );
