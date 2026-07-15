CREATE TABLE IF NOT EXISTS "certification_voucher_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "institute_id" integer NOT NULL,
  "course_id" integer,
  "name" text NOT NULL,
  "quantity" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_by" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "certification_voucher_batches_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 10000),
  CONSTRAINT "certification_voucher_batches_status_check" CHECK ("status" IN ('active', 'paused', 'exhausted', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certification_vouchers" (
  "id" serial PRIMARY KEY NOT NULL,
  "batch_id" integer NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "code_hint" text NOT NULL,
  "assigned_email" text,
  "assigned_user_id" integer,
  "status" text DEFAULT 'available' NOT NULL,
  "assigned_at" timestamp,
  "redeemed_by" integer,
  "certificate_id" integer,
  "redeemed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "certification_vouchers_code_hash_unique" UNIQUE("code_hash"),
  CONSTRAINT "certification_vouchers_certificate_id_unique" UNIQUE("certificate_id"),
  CONSTRAINT "certification_vouchers_status_check" CHECK ("status" IN ('available', 'assigned', 'redeemed', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_coupons" (
  "id" serial PRIMARY KEY NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "code_hint" text NOT NULL,
  "name" text NOT NULL,
  "course_id" integer,
  "discount_type" text NOT NULL,
  "discount_value" numeric(10, 2) NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "valid_from" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "max_redemptions" integer,
  "per_user_limit" integer DEFAULT 1 NOT NULL,
  "redemption_count" integer DEFAULT 0 NOT NULL,
  "created_by" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "discount_coupons_code_hash_unique" UNIQUE("code_hash"),
  CONSTRAINT "discount_coupons_type_check" CHECK ("discount_type" IN ('percent', 'fixed')),
  CONSTRAINT "discount_coupons_value_check" CHECK ("discount_value" > 0 AND ("discount_type" <> 'percent' OR "discount_value" <= 100)),
  CONSTRAINT "discount_coupons_status_check" CHECK ("status" IN ('active', 'paused', 'expired', 'revoked')),
  CONSTRAINT "discount_coupons_limits_check" CHECK (("max_redemptions" IS NULL OR "max_redemptions" > 0) AND "per_user_limit" > 0 AND "redemption_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "coupon_id" integer NOT NULL,
  "user_id" integer,
  "user_email" text NOT NULL,
  "course_id" integer NOT NULL,
  "payment_id" integer,
  "external_key" text NOT NULL,
  "original_amount" numeric(10, 2) NOT NULL,
  "discount_amount" numeric(10, 2) NOT NULL,
  "final_amount" numeric(10, 2) NOT NULL,
  "redeemed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "coupon_redemptions_external_key_unique" UNIQUE("external_key"),
  CONSTRAINT "coupon_redemptions_amounts_check" CHECK ("original_amount" >= 0 AND "discount_amount" >= 0 AND "final_amount" >= 0 AND "final_amount" = "original_amount" - "discount_amount")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_voucher_batches" ADD CONSTRAINT "certification_voucher_batches_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_voucher_batches" ADD CONSTRAINT "certification_voucher_batches_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_voucher_batches" ADD CONSTRAINT "certification_voucher_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_vouchers" ADD CONSTRAINT "certification_vouchers_batch_id_certification_voucher_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."certification_voucher_batches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_vouchers" ADD CONSTRAINT "certification_vouchers_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_vouchers" ADD CONSTRAINT "certification_vouchers_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_vouchers" ADD CONSTRAINT "certification_vouchers_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "discount_coupons" ADD CONSTRAINT "discount_coupons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "discount_coupons" ADD CONSTRAINT "discount_coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_discount_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."discount_coupons"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certification_voucher_batches_institute_idx" ON "certification_voucher_batches" USING btree ("institute_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certification_voucher_batches_course_idx" ON "certification_voucher_batches" USING btree ("course_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certification_vouchers_batch_status_idx" ON "certification_vouchers" USING btree ("batch_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certification_vouchers_assigned_email_idx" ON "certification_vouchers" USING btree ("assigned_email", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_coupons_course_status_idx" ON "discount_coupons" USING btree ("course_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_coupons_validity_idx" ON "discount_coupons" USING btree ("status", "valid_from", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id", "redeemed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_idx" ON "coupon_redemptions" USING btree ("user_id", "redeemed_at");
