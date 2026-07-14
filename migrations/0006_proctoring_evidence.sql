ALTER TABLE "exam_instances"
  ADD COLUMN IF NOT EXISTS "proctor_mode" text DEFAULT 'standard' NOT NULL;

ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "proctor_mode" text DEFAULT 'standard' NOT NULL,
  ADD COLUMN IF NOT EXISTS "evidence_consent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "evidence_consent_version" text,
  ADD COLUMN IF NOT EXISTS "last_autosave_at" timestamp;

CREATE TABLE IF NOT EXISTS "exam_proctor_events" (
  "id" serial PRIMARY KEY,
  "attempt_id" integer NOT NULL REFERENCES "exam_instance_attempts"("id") ON DELETE CASCADE,
  "client_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "client_at" timestamp,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "exam_proctor_events_attempt_client_event_unique"
    UNIQUE ("attempt_id", "client_event_id")
);

CREATE INDEX IF NOT EXISTS "exam_proctor_events_attempt_time_idx"
  ON "exam_proctor_events" ("attempt_id", "occurred_at");

COMMENT ON COLUMN "exam_instances"."proctor_mode" IS
  'standard or browser_evidence; browser evidence does not include webcam, microphone, screen recording, or an automated cheating verdict';
