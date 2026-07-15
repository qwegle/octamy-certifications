ALTER TABLE "question_banks" ADD COLUMN "bank_kind" text DEFAULT 'custom' NOT NULL;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD COLUMN "subject" text;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD COLUMN "exam_family" text;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD COLUMN "grade_band" text;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD COLUMN "syllabus_version" text;
--> statement-breakpoint
UPDATE "question_banks"
SET "status" = CASE WHEN "question_count" > 0 THEN 'active' ELSE 'draft' END,
    "bank_kind" = CASE
      WHEN "owner_type" = 'admin' AND "question_count" > 0 THEN 'master'
      ELSE 'custom'
    END;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_kind_check"
  CHECK ("bank_kind" IN ('assessment_pool', 'subject_pool', 'master', 'custom'));
--> statement-breakpoint
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_status_check"
  CHECK ("status" IN ('draft', 'active', 'archived'));
--> statement-breakpoint

ALTER TABLE "course_question_blueprint" ADD COLUMN "bank_id" integer;
--> statement-breakpoint
UPDATE "course_question_blueprint" blueprint
SET "bank_id" = topic."bank_id"
FROM "question_topics" topic
WHERE topic."id" = blueprint."topic_id";
--> statement-breakpoint
ALTER TABLE "course_question_blueprint" ALTER COLUMN "bank_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "course_question_blueprint" ALTER COLUMN "topic_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "course_question_blueprint" ADD CONSTRAINT "course_question_blueprint_bank_id_question_banks_id_fk"
  FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "course_question_blueprint_course_idx"
  ON "course_question_blueprint" USING btree ("course_id", "sort_order");
--> statement-breakpoint
CREATE INDEX "course_question_blueprint_bank_idx"
  ON "course_question_blueprint" USING btree ("bank_id", "topic_id", "difficulty");
--> statement-breakpoint

CREATE TABLE "course_question_blueprint_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "course_id" integer NOT NULL,
  "revision" integer NOT NULL,
  "items" jsonb NOT NULL,
  "change_note" text,
  "changed_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "course_question_blueprint_versions_course_revision_unique" UNIQUE("course_id", "revision")
);
--> statement-breakpoint
ALTER TABLE "course_question_blueprint_versions" ADD CONSTRAINT "course_question_blueprint_versions_course_id_courses_id_fk"
  FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_question_blueprint_versions" ADD CONSTRAINT "course_question_blueprint_versions_changed_by_users_id_fk"
  FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "course_question_blueprint_versions_course_idx"
  ON "course_question_blueprint_versions" USING btree ("course_id", "revision");
