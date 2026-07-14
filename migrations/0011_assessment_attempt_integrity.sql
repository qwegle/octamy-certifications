ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "excluded_question_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "deadline_at" timestamp;
--> statement-breakpoint
ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "passing_score_snapshot" integer;
--> statement-breakpoint
ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "question_snapshot_source" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exam_instance_attempt_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "attempt_id" integer NOT NULL,
  "question_id" integer NOT NULL,
  "position" integer NOT NULL,
  "question_version" integer DEFAULT 1 NOT NULL,
  "question" text NOT NULL,
  "options" jsonb NOT NULL,
  "question_type" text DEFAULT 'multiple_choice' NOT NULL,
  "question_format" text DEFAULT 'mcq_single' NOT NULL,
  "image_url" text,
  "code_language" text,
  "time_limit_sec" integer,
  "max_points" integer DEFAULT 1 NOT NULL,
  "negative_marks" integer DEFAULT 0 NOT NULL,
  "correct_answer" integer NOT NULL,
  "expected_answer" text,
  "explanation" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "exam_instance_attempt_items_attempt_id_exam_instance_attempts_id_fk"
    FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_instance_attempts"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "exam_instance_attempt_items_attempt_question_unique" UNIQUE("attempt_id", "question_id"),
  CONSTRAINT "exam_instance_attempt_items_attempt_position_unique" UNIQUE("attempt_id", "position"),
  CONSTRAINT "exam_instance_attempt_items_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
-- Preserve resumability for attempts that were already running when this
-- migration was deployed. This is the best-available reconstruction of the
-- legacy deterministic set; every new attempt is materialised transactionally
-- by the application at start time.
WITH reconstructed AS (
  SELECT
    attempt.id AS attempt_id,
    source.id AS question_id,
    (row_number() OVER (
      PARTITION BY attempt.id
      ORDER BY md5(source.id::text || attempt.id::text), source.id
    ) - 1)::integer AS position,
    COALESCE(source.version, 1) AS question_version,
    source.question,
    source.options::jsonb AS options,
    source.question_type,
    source.question_format,
    source.image_url,
    source.code_language,
    source.time_limit_sec,
    source.max_points,
    source.negative_marks,
    source.correct_answer,
    source.expected_answer,
    source.explanation,
    attempt.started_at AS created_at
  FROM exam_instance_attempts attempt
  JOIN exam_instances instance ON instance.id = attempt.instance_id
  CROSS JOIN LATERAL (
    SELECT question.*
    FROM questions question
    WHERE question.bank_id = instance.bank_id
      AND question.is_active = true
      AND question.question_format IN ('mcq_single', 'true_false')
      AND question.max_points > 0
      AND question.negative_marks BETWEEN 0 AND question.max_points
      AND CASE
        WHEN json_typeof(question.options) = 'array' THEN
          json_array_length(question.options) >= 2
          AND question.correct_answer >= 0
          AND question.correct_answer < json_array_length(question.options)
        ELSE false
      END
    ORDER BY md5(question.id::text || attempt.id::text), question.id
    LIMIT 50
  ) source
  WHERE attempt.submitted_at IS NULL
    AND attempt.status = 'in_progress'
    AND NOT EXISTS (
      SELECT 1 FROM exam_instance_attempt_items item WHERE item.attempt_id = attempt.id
    )
)
INSERT INTO exam_instance_attempt_items (
  attempt_id,
  question_id,
  position,
  question_version,
  question,
  options,
  question_type,
  question_format,
  image_url,
  code_language,
  time_limit_sec,
  max_points,
  negative_marks,
  correct_answer,
  expected_answer,
  explanation,
  created_at
)
SELECT
  attempt_id,
  question_id,
  position,
  question_version,
  question,
  options,
  question_type,
  question_format,
  image_url,
  code_language,
  time_limit_sec,
  max_points,
  negative_marks,
  correct_answer,
  expected_answer,
  explanation,
  created_at
FROM reconstructed
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE exam_instance_attempts attempt
SET
  total_questions = snapshot.item_count,
  question_snapshot_source = COALESCE(attempt.question_snapshot_source, 'legacy_reconstructed')
FROM (
  SELECT attempt_id, COUNT(*)::integer AS item_count
  FROM exam_instance_attempt_items
  GROUP BY attempt_id
) snapshot
WHERE attempt.id = snapshot.attempt_id
  AND attempt.submitted_at IS NULL
  AND attempt.status = 'in_progress';
--> statement-breakpoint
UPDATE exam_instance_attempts attempt
SET excluded_question_count = (
  SELECT COUNT(*)::integer
  FROM exam_instances instance
  JOIN questions question ON question.bank_id = instance.bank_id
  WHERE instance.id = attempt.instance_id
    AND question.is_active = true
    AND NOT (
      question.question_format IN ('mcq_single', 'true_false')
      AND question.max_points > 0
      AND question.negative_marks BETWEEN 0 AND question.max_points
      AND CASE
        WHEN json_typeof(question.options) = 'array' THEN
          json_array_length(question.options) >= 2
          AND question.correct_answer >= 0
          AND question.correct_answer < json_array_length(question.options)
        ELSE false
      END
    )
)
WHERE attempt.submitted_at IS NULL
  AND attempt.status = 'in_progress';
--> statement-breakpoint
-- Existing in-progress attempts get the same authoritative deadline formula.
-- Keep the column nullable during rollout so an old PM2 process can continue to
-- insert rows between migration completion and application restart.
UPDATE exam_instance_attempts attempt
SET
  deadline_at = COALESCE(
    attempt.deadline_at,
    LEAST(
      attempt.started_at + (instance.duration_min * INTERVAL '1 minute'),
      COALESCE(instance.ends_at, attempt.started_at + (instance.duration_min * INTERVAL '1 minute'))
    )
  ),
  passing_score_snapshot = COALESCE(attempt.passing_score_snapshot, instance.passing_score)
FROM exam_instances instance
WHERE instance.id = attempt.instance_id
  AND attempt.submitted_at IS NULL
  AND (attempt.deadline_at IS NULL OR attempt.passing_score_snapshot IS NULL);
