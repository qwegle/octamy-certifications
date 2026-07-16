ALTER TABLE "exam_sessions"
  ADD COLUMN IF NOT EXISTS "evidence_consent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "evidence_consent_version" text;

CREATE INDEX IF NOT EXISTS "pending_exams_session_id_idx"
  ON "pending_exams" (("payload"->>'sessionId'));
