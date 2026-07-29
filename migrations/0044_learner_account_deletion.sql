ALTER TABLE "users" ADD COLUMN "account_deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "actor_user_id" integer NOT NULL,
  "state" text DEFAULT 'requested' NOT NULL,
  "verification_token_hash" varchar(64),
  "token_expires_at" timestamp with time zone,
  "token_used_at" timestamp with time zone,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "rejection_reason" text,
  "completion_audit_id" integer,
  CONSTRAINT "account_deletion_requests_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "account_deletion_requests_state_check" CHECK ("state" IN ('requested','verified','completed','cancelled','rejected')),
  CONSTRAINT "account_deletion_requests_actor_check" CHECK ("actor_user_id" = "user_id"),
  CONSTRAINT "account_deletion_requests_token_hash_check" CHECK ("verification_token_hash" IS NULL OR "verification_token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "account_deletion_requests_lifecycle_check" CHECK (
    ("state" = 'requested' AND "verification_token_hash" IS NOT NULL AND "token_expires_at" > "requested_at" AND "token_used_at" IS NULL AND "verified_at" IS NULL AND "completed_at" IS NULL AND "cancelled_at" IS NULL AND "rejected_at" IS NULL)
    OR ("state" = 'verified' AND "verification_token_hash" IS NOT NULL AND "token_expires_at" IS NOT NULL AND "token_used_at" IS NOT NULL AND "verified_at" = "token_used_at" AND "completed_at" IS NULL AND "cancelled_at" IS NULL AND "rejected_at" IS NULL)
    OR ("state" = 'completed' AND "verification_token_hash" IS NULL AND "token_expires_at" IS NULL AND "token_used_at" IS NOT NULL AND "verified_at" IS NOT NULL AND "completed_at" >= "verified_at" AND "completion_audit_id" IS NOT NULL AND "cancelled_at" IS NULL AND "rejected_at" IS NULL)
    OR ("state" = 'cancelled' AND "verification_token_hash" IS NULL AND "token_expires_at" IS NULL AND "cancelled_at" >= "requested_at" AND "verified_at" IS NULL AND "completed_at" IS NULL AND "rejected_at" IS NULL)
    OR ("state" = 'rejected' AND "verification_token_hash" IS NULL AND "token_expires_at" IS NULL AND "rejected_at" >= "requested_at" AND length(btrim("rejection_reason")) BETWEEN 3 AND 200 AND "verified_at" IS NULL AND "completed_at" IS NULL AND "cancelled_at" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_one_open_user_idx" ON "account_deletion_requests" ("user_id") WHERE "state" IN ('requested','verified');
--> statement-breakpoint
CREATE INDEX "account_deletion_requests_user_time_idx" ON "account_deletion_requests" ("user_id","requested_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_token_idx" ON "account_deletion_requests" ("verification_token_hash") WHERE "verification_token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "account_deletion_audits" (
  "id" serial PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL UNIQUE,
  "subject_reference" varchar(64) NOT NULL,
  "actor_type" text NOT NULL,
  "policy_version" text NOT NULL,
  "erased" text[] NOT NULL,
  "retained" text[] NOT NULL,
  "counts" jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_deletion_audits_subject_check" CHECK ("subject_reference" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "account_deletion_audits_actor_check" CHECK ("actor_type" IN ('learner_self','system','platform_admin')),
  CONSTRAINT "account_deletion_audits_policy_check" CHECK ("policy_version" = 'learner-account-deletion.v1'),
  CONSTRAINT "account_deletion_audits_lists_check" CHECK (cardinality("erased") > 0 AND cardinality("retained") > 0),
  CONSTRAINT "account_deletion_audits_counts_check" CHECK (jsonb_typeof("counts") = 'object')
);
--> statement-breakpoint
ALTER TABLE "account_deletion_audits" ADD CONSTRAINT "account_deletion_audits_request_fk" FOREIGN KEY ("request_id") REFERENCES "account_deletion_requests"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_audit_fk" FOREIGN KEY ("completion_audit_id") REFERENCES "account_deletion_audits"("id") ON DELETE restrict DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_account_deletion_request() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."user_id" IS DISTINCT FROM OLD."user_id" OR NEW."actor_user_id" IS DISTINCT FROM OLD."actor_user_id" OR NEW."requested_at" IS DISTINCT FROM OLD."requested_at" THEN
    RAISE EXCEPTION 'Account deletion request ownership and creation metadata are immutable';
  END IF;
  IF NOT ((OLD."state" = 'requested' AND NEW."state" IN ('verified','cancelled','rejected')) OR (OLD."state" = 'verified' AND NEW."state" = 'completed')) THEN
    RAISE EXCEPTION 'Invalid account deletion lifecycle transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "account_deletion_requests_lifecycle" BEFORE UPDATE ON "account_deletion_requests" FOR EACH ROW EXECUTE FUNCTION protect_account_deletion_request();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_account_deletion_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Account deletion audits are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "account_deletion_audits_no_update" BEFORE UPDATE ON "account_deletion_audits" FOR EACH ROW EXECUTE FUNCTION prevent_account_deletion_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER "account_deletion_audits_no_delete" BEFORE DELETE ON "account_deletion_audits" FOR EACH ROW EXECUTE FUNCTION prevent_account_deletion_audit_mutation();
