ALTER TABLE "certification_voucher_batches" ALTER COLUMN "institute_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "certification_voucher_batches" ADD COLUMN IF NOT EXISTS "creator_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_voucher_batches" ADD CONSTRAINT "certification_voucher_batches_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_voucher_batches" ADD CONSTRAINT "certification_voucher_batches_recipient_check" CHECK (("institute_id" IS NOT NULL)::integer + ("creator_id" IS NOT NULL)::integer = 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certification_voucher_batches_creator_idx" ON "certification_voucher_batches" USING btree ("creator_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voucher_program_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "requester_type" text NOT NULL,
  "requester_id" integer NOT NULL,
  "course_id" integer,
  "quantity" integer NOT NULL,
  "purpose" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "review_note" text,
  "reviewed_by" integer,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "voucher_program_requests_requester_check" CHECK ("requester_type" IN ('creator', 'institute')),
  CONSTRAINT "voucher_program_requests_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 500),
  CONSTRAINT "voucher_program_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voucher_program_requests" ADD CONSTRAINT "voucher_program_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voucher_program_requests" ADD CONSTRAINT "voucher_program_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voucher_program_requests_requester_idx" ON "voucher_program_requests" USING btree ("requester_type", "requester_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voucher_program_requests_status_idx" ON "voucher_program_requests" USING btree ("status", "created_at");
--> statement-breakpoint
ALTER TABLE "discount_coupons" ADD COLUMN IF NOT EXISTS "owner_type" text DEFAULT 'admin' NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_coupons" ADD COLUMN IF NOT EXISTS "owner_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "discount_coupons" ADD CONSTRAINT "discount_coupons_owner_check" CHECK (
    ("owner_type" = 'admin' AND "owner_id" IS NULL)
    OR ("owner_type" IN ('creator', 'institute') AND "owner_id" IS NOT NULL AND "owner_id" > 0)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_coupons_owner_idx" ON "discount_coupons" USING btree ("owner_type", "owner_id", "created_at");
