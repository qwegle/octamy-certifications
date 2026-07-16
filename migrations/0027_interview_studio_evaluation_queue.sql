-- Interview Studio evaluation must not hold an HTTP request open while calling
-- external AI and code-runner services. This durable queue is safe across PM2
-- processes: workers claim leases with FOR UPDATE SKIP LOCKED and retry stale
-- leases without duplicating a job for the same immutable submission.
CREATE TABLE "interview_studio_evaluation_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "ai_evaluation_allowed" boolean DEFAULT false NOT NULL,
  "code_runner_allowed" boolean DEFAULT false NOT NULL,
  "available_at" timestamptz DEFAULT now() NOT NULL,
  "locked_at" timestamptz,
  "locked_by" text,
  "last_error_code" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_evaluation_jobs_session_unique" UNIQUE("session_id"),
  CONSTRAINT "interview_studio_evaluation_jobs_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "interview_studio_evaluation_jobs_status_check" CHECK ("status" IN ('queued','running','completed','failed')),
  CONSTRAINT "interview_studio_evaluation_jobs_attempts_check" CHECK (
    "attempts" BETWEEN 0 AND "max_attempts" AND "max_attempts" BETWEEN 1 AND 10
  ),
  CONSTRAINT "interview_studio_evaluation_jobs_lease_check" CHECK (
    ("status" = 'running' AND "locked_at" IS NOT NULL AND "locked_by" IS NOT NULL)
    OR ("status" <> 'running' AND "locked_at" IS NULL AND "locked_by" IS NULL)
  ),
  CONSTRAINT "interview_studio_evaluation_jobs_completed_check" CHECK (
    ("status" IN ('completed','failed') AND "completed_at" IS NOT NULL)
    OR ("status" NOT IN ('completed','failed') AND "completed_at" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "interview_studio_evaluation_jobs"
  ADD CONSTRAINT "interview_studio_evaluation_jobs_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "interview_studio_sessions"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "interview_studio_evaluation_jobs_available_idx"
  ON "interview_studio_evaluation_jobs" ("status", "available_at", "id");
--> statement-breakpoint
CREATE INDEX "interview_studio_evaluation_jobs_stale_lease_idx"
  ON "interview_studio_evaluation_jobs" ("status", "locked_at");

--> statement-breakpoint
-- Daily usage is intentionally independent of sessions. Private-session
-- deletion therefore cannot reset or evade the account's evaluation allowance.
CREATE TABLE "interview_studio_daily_usage" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "usage_date" date NOT NULL,
  "evaluation_jobs" integer DEFAULT 0 NOT NULL,
  "ai_evaluation_jobs" integer DEFAULT 0 NOT NULL,
  "code_runner_jobs" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "interview_studio_daily_usage_user_day_unique" UNIQUE("user_id", "usage_date"),
  CONSTRAINT "interview_studio_daily_usage_count_check" CHECK ("evaluation_jobs" BETWEEN 0 AND 100),
  CONSTRAINT "interview_studio_daily_usage_ai_count_check" CHECK ("ai_evaluation_jobs" BETWEEN 0 AND "evaluation_jobs"),
  CONSTRAINT "interview_studio_daily_usage_runner_count_check" CHECK ("code_runner_jobs" BETWEEN 0 AND "evaluation_jobs")
);
--> statement-breakpoint
ALTER TABLE "interview_studio_daily_usage"
  ADD CONSTRAINT "interview_studio_daily_usage_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "interview_studio_daily_usage_date_idx"
  ON "interview_studio_daily_usage" ("usage_date", "user_id");

--> statement-breakpoint
ALTER TABLE "interview_studio_responses"
  ADD COLUMN "time_spent_seconds" integer DEFAULT 0 NOT NULL,
  ADD CONSTRAINT "interview_studio_responses_time_spent_check"
    CHECK ("time_spent_seconds" BETWEEN 0 AND 86400);

--> statement-breakpoint
-- Replace the response-state guard from 0026 so elapsed time is part of the
-- immutable learner evidence once asynchronous evaluation begins.
CREATE OR REPLACE FUNCTION enforce_interview_studio_response_state()
RETURNS trigger AS $$
DECLARE
  parent_status text;
  candidate_content_changed boolean;
  evaluation_content_changed boolean;
BEGIN
  SELECT status INTO parent_status
    FROM interview_studio_sessions
    WHERE id = NEW.session_id
    FOR SHARE;
  IF parent_status IS NULL THEN
    RAISE EXCEPTION 'Interview Studio response requires an existing session';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF parent_status <> 'in_progress' THEN
      RAISE EXCEPTION 'Interview Studio responses can only be added while a session is in progress';
    END IF;
    RETURN NEW;
  END IF;

  candidate_content_changed :=
    NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.item_key IS DISTINCT FROM OLD.item_key
    OR NEW.item_kind IS DISTINCT FROM OLD.item_kind
    OR NEW.answer_text IS DISTINCT FROM OLD.answer_text
    OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.language IS DISTINCT FROM OLD.language
    OR NEW.time_spent_seconds IS DISTINCT FROM OLD.time_spent_seconds
    OR NEW.answer_hash IS DISTINCT FROM OLD.answer_hash
    OR NEW.sample_test_result IS DISTINCT FROM OLD.sample_test_result;
  evaluation_content_changed :=
    NEW.final_test_result IS DISTINCT FROM OLD.final_test_result
    OR NEW.evaluation_status IS DISTINCT FROM OLD.evaluation_status
    OR NEW.evaluation IS DISTINCT FROM OLD.evaluation
    OR NEW.evaluation_model IS DISTINCT FROM OLD.evaluation_model
    OR NEW.evaluation_prompt_version IS DISTINCT FROM OLD.evaluation_prompt_version
    OR NEW.is_final IS DISTINCT FROM OLD.is_final
    OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at;

  IF candidate_content_changed AND parent_status <> 'in_progress' THEN
    RAISE EXCEPTION 'Candidate response evidence is closed after submission starts';
  END IF;
  IF evaluation_content_changed AND parent_status NOT IN ('evaluating','review_required') THEN
    RAISE EXCEPTION 'Evaluation evidence can only be written during evaluation or review';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
