-- A server-issued exam session may create at most one persisted attempt.
-- Keep the earliest legacy record as the canonical session result and retain
-- any historical duplicates by clearing only their session identifier.
WITH ranked_attempts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "session_id" ORDER BY "id") AS duplicate_rank
  FROM "exam_attempts"
  WHERE "session_id" IS NOT NULL
)
UPDATE "exam_attempts" AS attempt
SET "session_id" = NULL
FROM ranked_attempts
WHERE attempt."id" = ranked_attempts."id"
  AND ranked_attempts.duplicate_rank > 1;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_attempts_session_id_unique'
      AND conrelid = 'exam_attempts'::regclass
  ) THEN
    ALTER TABLE "exam_attempts"
      ADD CONSTRAINT "exam_attempts_session_id_unique" UNIQUE ("session_id");
  END IF;
END $$;
