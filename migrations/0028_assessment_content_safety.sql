-- Assessment content safety repair. The career-catalog bootstrap briefly
-- created the same generic ten-question
-- pattern for every domain. These rows were never independently reviewed and
-- cannot support a credible certification. Preserve them for audit/history,
-- but keep them out of authoring queues and assessment readiness counts.
UPDATE "questions" question
SET
  "is_active" = false,
  "review_status" = 'retired',
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "updated_at" = now()
FROM "question_banks" bank
WHERE question."bank_id" = bank."id"
  AND bank."exam_family" = 'career-certification'
  AND question."created_by" IS NULL
  AND question."reviewed_by" IS NULL
  AND question."review_status" NOT IN ('approved', 'retired')
  AND (
    question."answer_metadata"->>'source' = 'career-catalog-starter'
    -- The earliest bootstrap rows predate the source marker. Match their full
    -- generator fingerprint rather than retiring human content by a natural
    -- language stem alone.
    OR (
      question."answer_metadata" IS NULL
      AND question."generation_source" = 'imported'
      AND question."tags"::jsonb @> '["career-certification"]'::jsonb
      AND question."explanation" LIKE
        'This checks whether the learner can apply % knowledge in a practical workplace context.'
      AND (
        question."question" LIKE 'Which outcome best shows practical readiness in %'
        OR question."question" LIKE 'A team is adopting %. What should be validated first?'
        OR question."question" LIKE 'Which risk is most common when teams implement % without governance?'
        OR question."question" LIKE 'What makes an assessment answer job-relevant for %?'
        OR question."question" LIKE 'When troubleshooting a % workflow, what is the strongest first step?'
        OR question."question" LIKE 'Which practice improves enterprise adoption of %?'
        OR question."question" LIKE 'A candidate claims % experience. Which signal is strongest?'
        OR question."question" LIKE 'Which metric is usually most useful after deploying % changes?'
        OR question."question" LIKE 'What should be documented before scaling %?'
        OR question."question" LIKE 'Why should Octamy separate practice exams from % certifications?'
      )
    )
  );
--> statement-breakpoint
UPDATE "question_banks" bank
SET
  "question_count" = (
    SELECT count(*)::integer
    FROM "questions" question
    WHERE question."bank_id" = bank."id"
      AND question."review_status" <> 'retired'
  ),
  "updated_at" = now()
WHERE bank."exam_family" = 'career-certification';
--> statement-breakpoint
-- The original quantitative pack is a generator output awaiting the syllabus,
-- subject-matter, language and representative-attempt reviews declared in its
-- own manifest. It was bulk-labelled approved without an attributable reviewer.
-- Preserve every row and its provenance, but return it to the review queue.
UPDATE "questions" question
SET
  "is_active" = false,
  "review_status" = 'pending',
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "updated_at" = now()
FROM "question_banks" bank
WHERE question."bank_id" = bank."id"
  AND question."generation_source" = 'imported'
  AND question."review_status" = 'approved'
  AND question."reviewed_by" IS NULL
  AND (
    bank."slug" = 'octamy-original-quantitative-and-numerical-v1'
    OR EXISTS (
      SELECT 1
      FROM "question_provenance" provenance
      INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
      WHERE provenance."question_id" = question."id"
        AND source."source_key" = 'octamy-original:quant-science:v1'
    )
  );
--> statement-breakpoint
-- The source is practice material even when a previous segregation run moved
-- it into per-assessment pools created before bank_purpose was explicit.
UPDATE "question_banks" bank
SET
  "bank_purpose" = 'practice',
  "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "questions" question
  INNER JOIN "question_provenance" provenance ON provenance."question_id" = question."id"
  INNER JOIN "question_pack_sources" source ON source."id" = provenance."source_id"
  WHERE question."bank_id" = bank."id"
    AND source."source_key" = 'octamy-original:quant-science:v1'
);
--> statement-breakpoint
-- Older admin endpoints could stamp the author as reviewer. Certification
-- banks require an independent reviewer, so preserve those rows but return
-- them to review instead of treating self-approval as publication evidence.
UPDATE "questions" question
SET
  "is_active" = false,
  "review_status" = 'pending',
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "updated_at" = now()
FROM "question_banks" bank
WHERE question."bank_id" = bank."id"
  AND bank."owner_type" = 'admin'
  AND bank."bank_purpose" = 'certification'
  AND question."review_status" = 'approved'
  AND question."created_by" IS NOT NULL
  AND question."reviewed_by" = question."created_by";
--> statement-breakpoint
-- Normalize every remaining bank question whose approval label has incomplete
-- review evidence. This removes the misleading state where authoring says
-- "approved" while publication correctly counts zero.
UPDATE "questions"
SET
  "is_active" = false,
  "review_status" = 'pending',
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "updated_at" = now()
WHERE "bank_id" IS NOT NULL
  AND "review_status" = 'approved'
  AND ("reviewed_by" IS NULL OR "reviewed_at" IS NULL);
--> statement-breakpoint
-- Publication is fail-closed. Any live assessment whose blueprint lacks
-- attributable, active, runtime-compatible reviewed inventory returns to
-- private pending review. No assessment, question, attempt or learner record
-- is deleted.
UPDATE "courses" course
SET
  "is_active" = false,
  "visibility" = 'private',
  "review_status" = 'pending',
  "subscription_eligible" = false,
  "featured_at" = NULL
WHERE course."product_type" = 'assessment'
  AND course."is_active" = true
  AND course."visibility" = 'public'
  AND course."review_status" = 'approved'
  AND (
    course."use_blueprint_engine" = false
    OR NOT EXISTS (
      SELECT 1
      FROM "course_question_blueprint" blueprint
      WHERE blueprint."course_id" = course."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "course_question_blueprint" blueprint
      LEFT JOIN "question_banks" bank ON bank."id" = blueprint."bank_id"
      WHERE blueprint."course_id" = course."id"
        AND (
          bank."bank_purpose" IS DISTINCT FROM course."assessment_purpose"
          OR bank."status" IS DISTINCT FROM 'active'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM "course_question_blueprint" blueprint
      WHERE blueprint."course_id" = course."id"
        AND (
          SELECT count(*)
          FROM "questions" question
          WHERE question."bank_id" = blueprint."bank_id"
            AND (blueprint."topic_id" IS NULL OR question."topic_id" = blueprint."topic_id")
            AND question."is_active" = true
            AND question."review_status" = 'approved'
            AND question."reviewed_by" IS NOT NULL
            AND question."reviewed_at" IS NOT NULL
            AND question."question_format" IN ('mcq_single', 'true_false')
            AND json_typeof(question."options") = 'array'
            AND question."correct_answer" >= 0
            AND question."correct_answer" < json_array_length(question."options")
            AND (blueprint."difficulty" = 'mixed' OR question."difficulty" = blueprint."difficulty")
        ) < blueprint."question_count"
          * CASE WHEN course."assessment_purpose" = 'practice' THEN 5 ELSE 4 END
    )
    OR (
      SELECT count(DISTINCT question."id")
      FROM "course_question_blueprint" blueprint
      INNER JOIN "questions" question
        ON question."bank_id" = blueprint."bank_id"
       AND (blueprint."topic_id" IS NULL OR question."topic_id" = blueprint."topic_id")
       AND (blueprint."difficulty" = 'mixed' OR question."difficulty" = blueprint."difficulty")
      WHERE blueprint."course_id" = course."id"
        AND question."is_active" = true
        AND question."review_status" = 'approved'
        AND question."reviewed_by" IS NOT NULL
        AND question."reviewed_at" IS NOT NULL
        AND question."question_format" IN ('mcq_single', 'true_false')
        AND json_typeof(question."options") = 'array'
        AND question."correct_answer" >= 0
        AND question."correct_answer" < json_array_length(question."options")
    ) < GREATEST(
      CASE WHEN course."assessment_purpose" = 'practice' THEN 200 ELSE 80 END,
      COALESCE((
        SELECT sum(blueprint."question_count")
        FROM "course_question_blueprint" blueprint
        WHERE blueprint."course_id" = course."id"
      ), 0) * CASE WHEN course."assessment_purpose" = 'practice' THEN 5 ELSE 4 END
    )
  );
