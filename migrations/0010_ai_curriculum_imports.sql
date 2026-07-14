CREATE TABLE IF NOT EXISTS "course_curriculum_imports" (
  "id" serial PRIMARY KEY NOT NULL,
  "course_id" integer NOT NULL,
  "workspace" text NOT NULL,
  "actor_user_id" integer NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "status" text DEFAULT 'processing' NOT NULL,
  "response" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "course_curriculum_imports_course_workspace_key_unique"
    UNIQUE("course_id", "workspace", "idempotency_key"),
  CONSTRAINT "course_curriculum_imports_workspace_check"
    CHECK ("workspace" IN ('creator', 'institute')),
  CONSTRAINT "course_curriculum_imports_status_check"
    CHECK ("status" IN ('processing', 'completed')),
  CONSTRAINT "course_curriculum_imports_request_hash_check"
    CHECK (length("request_hash") = 64),
  CONSTRAINT "course_curriculum_imports_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "course_curriculum_imports_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_curriculum_imports_actor_idx"
  ON "course_curriculum_imports" USING btree ("actor_user_id", "created_at");
