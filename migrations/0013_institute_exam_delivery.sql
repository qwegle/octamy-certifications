ALTER TABLE "exam_instances"
  ADD COLUMN IF NOT EXISTS "access_mode" text DEFAULT 'public_link' NOT NULL,
  ADD COLUMN IF NOT EXISTS "funding_subscription_id" integer,
  ADD COLUMN IF NOT EXISTS "funding_verified_at" timestamp;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances"
    ADD CONSTRAINT "exam_instances_funding_subscription_id_subscriptions_id_fk"
    FOREIGN KEY ("funding_subscription_id") REFERENCES "public"."subscriptions"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
UPDATE "exam_instances"
SET "access_mode" = 'cohort_invite'
WHERE "owner_type" = 'institute' AND "cohort_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "exam_instances" exam
SET
  "funding_subscription_id" = (
    SELECT subscription."id"
    FROM "subscriptions" subscription
    WHERE subscription."owner_type" = 'institute'
      AND subscription."owner_id" = exam."owner_id"
      AND subscription."status" = 'active'
      AND (subscription."starts_at" IS NULL OR subscription."starts_at" <= now())
      AND subscription."renews_at" IS NOT NULL
      AND subscription."renews_at" > now()
    ORDER BY subscription."renews_at" DESC, subscription."id" DESC
    LIMIT 1
  ),
  "funding_verified_at" = now()
WHERE exam."owner_type" = 'institute'
  AND exam."status" = 'live'
  AND EXISTS (
    SELECT 1
    FROM "subscriptions" subscription
    WHERE subscription."owner_type" = 'institute'
      AND subscription."owner_id" = exam."owner_id"
      AND subscription."status" = 'active'
      AND (subscription."starts_at" IS NULL OR subscription."starts_at" <= now())
      AND subscription."renews_at" IS NOT NULL
      AND subscription."renews_at" > now()
  );
--> statement-breakpoint
-- Fail closed for legacy institute exams that cannot be tied to current paid
-- workspace coverage. Owners can renew and explicitly publish them again.
UPDATE "exam_instances"
SET "status" = 'draft', "updated_at" = now()
WHERE "owner_type" = 'institute'
  AND "status" = 'live'
  AND ("funding_subscription_id" IS NULL OR "cohort_id" IS NULL);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_access_mode_check"
    CHECK ("access_mode" IN ('public_link','cohort_invite'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_cohort_invite_check"
    CHECK ("access_mode" <> 'cohort_invite' OR ("owner_type" = 'institute' AND "cohort_id" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_live_institute_funding_check"
    CHECK (NOT ("owner_type" = 'institute' AND "status" = 'live') OR "funding_subscription_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_live_institute_delivery_check"
    CHECK (NOT ("owner_type" = 'institute' AND "status" = 'live') OR ("access_mode" = 'cohort_invite' AND "cohort_id" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "exam_instance_invitations" (
  "id" serial PRIMARY KEY NOT NULL,
  "exam_instance_id" integer NOT NULL,
  "cohort_student_id" integer,
  "email" text NOT NULL,
  "recipient_name" text,
  "token_hash" text NOT NULL UNIQUE,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "sent_at" timestamp,
  "last_sent_at" timestamp,
  "opened_at" timestamp,
  "last_started_at" timestamp,
  "send_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "exam_instance_invitations_exam_email_unique" UNIQUE("exam_instance_id", "email"),
  CONSTRAINT "exam_instance_invitations_exam_id_fk"
    FOREIGN KEY ("exam_instance_id") REFERENCES "public"."exam_instances"("id") ON DELETE cascade,
  CONSTRAINT "exam_instance_invitations_cohort_student_id_fk"
    FOREIGN KEY ("cohort_student_id") REFERENCES "public"."cohort_students"("id") ON DELETE set null,
  CONSTRAINT "exam_instance_invitations_status_check"
    CHECK ("status" IN ('pending','sent','delivery_failed','opened','started','revoked')),
  CONSTRAINT "exam_instance_invitations_email_normalized_check"
    CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "exam_instance_invitations_token_hash_check"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "exam_instance_invitations_send_count_check"
    CHECK ("send_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_instance_invitations_exam_status_idx"
  ON "exam_instance_invitations" ("exam_instance_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_instance_invitations_cohort_student_idx"
  ON "exam_instance_invitations" ("cohort_student_id");
--> statement-breakpoint

ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "invitation_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instance_attempts"
    ADD CONSTRAINT "exam_instance_attempts_invitation_id_exam_instance_invitations_id_fk"
    FOREIGN KEY ("invitation_id") REFERENCES "public"."exam_instance_invitations"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_instance_attempts_invitation_idx"
  ON "exam_instance_attempts" ("invitation_id");
