ALTER TABLE "institutes"
  ADD COLUMN IF NOT EXISTS "recruiter_discovery_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "credit_transactions"
  ADD COLUMN IF NOT EXISTS "external_reference" text;

ALTER TABLE "profile_access_logs"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;

-- Existing installations may contain NULL or legacy-negative balances from
-- the old read/modify/write implementation. Repair them before enforcing the
-- database invariant used by the atomic wallet update.
UPDATE "recruiters"
SET "credits_balance" = '0.00'
WHERE "credits_balance" IS NULL OR "credits_balance" < 0;

ALTER TABLE "recruiters"
  ALTER COLUMN "credits_balance" SET DEFAULT '0.00',
  ALTER COLUMN "credits_balance" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recruiters_credits_balance_nonnegative'
      AND conrelid = 'recruiters'::regclass
  ) THEN
    ALTER TABLE "recruiters"
      ADD CONSTRAINT "recruiters_credits_balance_nonnegative"
      CHECK ("credits_balance" >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_external_reference_unique"
  ON "credit_transactions" ("external_reference")
  WHERE "external_reference" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "profile_access_logs_idempotency_key_unique"
  ON "profile_access_logs" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "cohort_students_active_user_idx"
  ON "cohort_students" ("user_id", "status", "institute_id");

CREATE INDEX IF NOT EXISTS "cohort_students_active_email_idx"
  ON "cohort_students" (lower("email"), "status", "institute_id");
