ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "product_type" text DEFAULT 'assessment' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "content_price" numeric(10,2);

CREATE TABLE IF NOT EXISTS "course_entitlements" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "payment_id" integer,
  "status" text DEFAULT 'active' NOT NULL,
  "source" text DEFAULT 'purchase' NOT NULL,
  "granted_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  CONSTRAINT "course_entitlements_user_course_uniq" UNIQUE("user_id", "course_id"),
  CONSTRAINT "course_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "course_entitlements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "course_entitlements_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "course_entitlements_user_idx" ON "course_entitlements" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "course_entitlements_course_idx" ON "course_entitlements" USING btree ("course_id");
