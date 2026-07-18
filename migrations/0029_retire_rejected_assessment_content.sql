-- The full content audit rejected the legacy, smoke/test and original
-- quantitative packs. They are repeated templates rather than independently
-- authored, syllabus-aligned assessment questions. Preserve every row for
-- audit/export history, but remove the misleading pending-review state.
UPDATE "questions" question
SET
  "is_active" = false,
  "review_status" = 'retired',
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "updated_at" = now()
FROM "question_banks" bank
WHERE question."bank_id" = bank."id"
  AND question."review_status" <> 'retired'
  AND (
    bank."slug" IN ('legacy', 'smoke-test-bank', 'test-bank')
    OR EXISTS (
      SELECT 1
      FROM "question_provenance" provenance
      INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
      WHERE provenance."question_id" = question."id"
        AND source."source_key" = 'octamy-original:quant-science:v1'
    )
  );
--> statement-breakpoint
-- Reconcile all affected bank counters from the immutable question history and
-- archive empty pools so they cannot be selected by future assessment shells.
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
  "visibility" = CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM "questions" question
      WHERE question."bank_id" = bank."id"
        AND question."review_status" <> 'retired'
    ) THEN 'private'
    ELSE bank."visibility"
  END,
  "updated_at" = now()
WHERE bank."slug" IN ('legacy', 'smoke-test-bank', 'test-bank')
   OR EXISTS (
     SELECT 1
     FROM "questions" question
     INNER JOIN "question_provenance" provenance ON provenance."question_id" = question."id"
     INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
     WHERE question."bank_id" = bank."id"
       AND source."source_key" = 'octamy-original:quant-science:v1'
   );
--> statement-breakpoint
-- Keep assessment shells for future authoring, but never advertise a shell
-- whose audited bank was rejected and archived.
UPDATE "courses" course
SET
  "is_active" = false,
  "visibility" = 'private',
  "review_status" = 'pending',
  "subscription_eligible" = false,
  "featured_at" = NULL
WHERE course."product_type" = 'assessment'
  AND (
    EXISTS (
      SELECT 1
      FROM "course_question_blueprint" blueprint
      INNER JOIN "question_banks" bank ON bank."id" = blueprint."bank_id"
      WHERE blueprint."course_id" = course."id"
        AND bank."status" = 'archived'
    )
    OR EXISTS (
      SELECT 1
      FROM "questions" question
      INNER JOIN "question_banks" bank ON bank."id" = question."bank_id"
      WHERE question."course_id" = course."id"
        AND bank."slug" = 'legacy'
    )
  );
