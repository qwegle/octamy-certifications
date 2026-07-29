-- Archive the remaining audited non-viable certification shells.
--
-- Each target is an inactive/private/pending certification shell with no
-- blueprint, linked bank, direct or bank question, legacy or scheduled attempt,
-- certificate, or payment. The exact ID/slug pairs prevent an ID collision from
-- retiring a different product. No content or learner history is removed.
--
-- The UPDATE is fail-closed and idempotent: an already-archived target is left
-- unchanged, while any existing target that cannot safely transition makes the
-- postcondition abort the transaction. The postcondition examines only target
-- rows that exist, so an empty fresh database or partial restore migrates cleanly.
DO $$
BEGIN
  UPDATE "courses" AS course
  SET "review_status" = 'archived'
  FROM (
    VALUES
      (11, 'business-strategy-fundamentals'),
      (13, 'strategic-leadership'),
      (14, 'innovation-management'),
      (15, 'entrepreneurship'),
      (21, 'design-principles'),
      (23, 'advanced-prototyping'),
      (24, 'design-leadership'),
      (25, 'brand-identity'),
      (29, 'growth-hacking'),
      (40, 'fintech-innovation'),
      (44, 'strategic-pmo'),
      (45, 'digital-transformation'),
      (46, 'software-engineering-internship'),
      (47, 'data-science-internship'),
      (48, 'marketing-internship'),
      (49, 'business-analyst-internship'),
      (50, 'ux-design-internship')
  ) AS target("id", "slug")
  WHERE course."id" = target."id"
    AND course."slug" = target."slug"
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

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        (11, 'business-strategy-fundamentals'),
        (13, 'strategic-leadership'),
        (14, 'innovation-management'),
        (15, 'entrepreneurship'),
        (21, 'design-principles'),
        (23, 'advanced-prototyping'),
        (24, 'design-leadership'),
        (25, 'brand-identity'),
        (29, 'growth-hacking'),
        (40, 'fintech-innovation'),
        (44, 'strategic-pmo'),
        (45, 'digital-transformation'),
        (46, 'software-engineering-internship'),
        (47, 'data-science-internship'),
        (48, 'marketing-internship'),
        (49, 'business-analyst-internship'),
        (50, 'ux-design-internship')
    ) AS target("id", "slug")
    INNER JOIN "courses" course ON course."id" = target."id"
    WHERE course."slug" <> target."slug"
       OR course."product_type" <> 'assessment'
       OR course."assessment_purpose" <> 'certification'
       OR course."is_active" <> false
       OR course."visibility" <> 'private'
       OR course."review_status" <> 'archived'
  ) THEN
    RAISE EXCEPTION '0039 archival guard failed: an existing audited certification shell did not reach the archived disposition';
  END IF;
END $$;
