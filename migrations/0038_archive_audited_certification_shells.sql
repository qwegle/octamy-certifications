-- Audited certification-shell archival
--
-- `archived` is the honest lifecycle disposition for retired duplicate and
-- legacy-empty shells. Reusing `rejected` would imply failed review, while
-- `suspended` would imply a potentially temporary operational hold. This
-- migration therefore extends the existing check with one explicit state;
-- every prior allowed value remains enforced. PostgreSQL requires replacing a
-- CHECK constraint to extend its value set, but no table, column, index, row,
-- content, or learner history is removed.
--
-- The UPDATE is fail-closed and idempotent. It can change only the 14 audited
-- inactive/private/pending certification shells while they still have no
-- blueprint, linked bank, direct or bank question, attempt, certificate, or
-- payment. The postcondition accepts already-archived targets on a replay, but
-- aborts the transaction if any target is missing or cannot safely transition.
ALTER TABLE "courses"
  DROP CONSTRAINT IF EXISTS "courses_review_status_check";
--> statement-breakpoint
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_review_status_check"
  CHECK ("review_status" IN ('draft','pending','approved','rejected','suspended','archived'))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "courses"
  VALIDATE CONSTRAINT "courses_review_status_check";
--> statement-breakpoint
DO $$
BEGIN
  UPDATE "courses" AS course
  SET "review_status" = 'archived'
  WHERE course."id" = ANY (ARRAY[1,6,7,8,9,16,18,19,20,31,32,35,41,42])
    AND course."product_type" = 'assessment'
    AND course."assessment_purpose" = 'certification'
    AND course."is_active" = false
    AND course."visibility" = 'private'
    AND course."review_status" = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM "course_question_blueprint" blueprint
      WHERE blueprint."course_id" = course."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "question_banks" bank
      INNER JOIN "course_question_blueprint" blueprint ON blueprint."bank_id" = bank."id"
      WHERE blueprint."course_id" = course."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "questions" question
      WHERE question."course_id" = course."id"
        OR question."bank_id" IN (
          SELECT blueprint."bank_id"
          FROM "course_question_blueprint" blueprint
          WHERE blueprint."course_id" = course."id"
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "exam_attempts" attempt
      WHERE attempt."course_id" = course."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "exam_instance_attempts" attempt
      INNER JOIN "exam_instances" instance ON instance."id" = attempt."instance_id"
      WHERE instance."course_id" = course."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "certificates" certificate
      WHERE certificate."course_id" = course."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "payments" payment
      LEFT JOIN "certificates" certificate ON certificate."id" = payment."certificate_id"
      WHERE payment."course_id" = course."id"
         OR certificate."course_id" = course."id"
    );

  -- Verify only the audited rows that exist in this database. A fresh or
  -- restored database has no legacy shells yet, and this migration must still
  -- run there (CI, disposable test databases, disaster recovery). The check
  -- therefore fails closed on any audited shell that exists but did not reach
  -- the archived disposition, and is a no-op when none of them exist.
  IF EXISTS (
       SELECT 1
       FROM "courses"
       WHERE "id" = ANY (ARRAY[1,6,7,8,9,16,18,19,20,31,32,35,41,42])
         AND "product_type" = 'assessment'
         AND "assessment_purpose" = 'certification'
         AND "is_active" = false
         AND "visibility" = 'private'
         AND "review_status" <> 'archived'
     ) THEN
    RAISE EXCEPTION '0038 archival guard failed: an audited certification shell did not reach the archived disposition';
  END IF;
END $$;
