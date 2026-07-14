ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "parent_id" integer,
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'collection' NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "meta_title" text,
  ADD COLUMN IF NOT EXISTS "meta_description" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "categories"
    ADD CONSTRAINT "categories_parent_id_categories_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_kind_check"
    CHECK ("kind" IN ('collection','audience','subject','exam_family','skill'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "categories" ("parent_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_kind_active_idx" ON "categories" ("kind", "is_active");
--> statement-breakpoint
INSERT INTO "categories" (
  "name", "description", "icon", "slug", "kind", "is_active", "sort_order"
) VALUES
  ('School education', 'Curriculum-aligned learning and assessment for school learners.', 'School', 'school-education', 'collection', true, 10),
  ('Competitive exams', 'Preparation and assessment for government and entrance examinations.', 'Landmark', 'competitive-exams', 'collection', true, 20),
  ('Professional skills', 'Career, technology, business and workplace capability assessments.', 'BriefcaseBusiness', 'professional-skills', 'collection', true, 30)
ON CONFLICT ("slug") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "categories" (
  "name", "description", "icon", "slug", "parent_id", "kind", "is_active", "sort_order"
)
SELECT seed.name, seed.description, seed.icon, seed.slug, parent.id, seed.kind, true, seed.sort_order
FROM (VALUES
  ('Mathematics', 'Mathematics by grade and curriculum level.', 'Sigma', 'mathematics', 'school-education', 'subject', 10),
  ('English', 'English language, comprehension and communication.', 'Languages', 'english', 'school-education', 'subject', 20),
  ('Physics', 'Physics concepts, numeracy and problem solving.', 'Atom', 'physics', 'school-education', 'subject', 30),
  ('Chemistry', 'Chemistry concepts, reactions and applied reasoning.', 'FlaskConical', 'chemistry', 'school-education', 'subject', 40),
  ('SSC', 'Staff Selection Commission examination preparation.', 'Landmark', 'ssc', 'competitive-exams', 'exam_family', 10),
  ('UPSC', 'Union Public Service Commission examination preparation.', 'Landmark', 'upsc', 'competitive-exams', 'exam_family', 20),
  ('NEET', 'National Eligibility cum Entrance Test preparation.', 'Stethoscope', 'neet', 'competitive-exams', 'exam_family', 30),
  ('JEE', 'Joint Entrance Examination preparation.', 'DraftingCompass', 'jee', 'competitive-exams', 'exam_family', 40),
  ('Banking exams', 'Banking recruitment and aptitude examinations.', 'BadgeIndianRupee', 'banking-exams', 'competitive-exams', 'exam_family', 50),
  ('Railway exams', 'Railway recruitment examinations.', 'TrainFront', 'railway-exams', 'competitive-exams', 'exam_family', 60),
  ('Software development', 'Programming, software engineering and delivery skills.', 'Code2', 'software-development', 'professional-skills', 'skill', 10),
  ('Data and AI', 'Data analysis, machine learning and responsible AI skills.', 'BrainCircuit', 'data-and-ai', 'professional-skills', 'skill', 20),
  ('Cloud and DevOps', 'Cloud platforms, infrastructure and delivery operations.', 'CloudCog', 'cloud-and-devops', 'professional-skills', 'skill', 30),
  ('Business and management', 'Business operations, leadership and commercial skills.', 'ChartNoAxesCombined', 'business-and-management', 'professional-skills', 'skill', 40),
  ('Communication', 'Written, verbal and workplace communication skills.', 'MessagesSquare', 'communication', 'professional-skills', 'skill', 50)
) AS seed(name, description, icon, slug, parent_slug, kind, sort_order)
JOIN "categories" parent ON parent."slug" = seed.parent_slug
ON CONFLICT ("slug") DO UPDATE SET
  "parent_id" = EXCLUDED."parent_id",
  "kind" = EXCLUDED."kind",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();
--> statement-breakpoint

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'en' NOT NULL,
  ADD COLUMN IF NOT EXISTS "certification_mode" text DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'draft' NOT NULL,
  ADD COLUMN IF NOT EXISTS "default_review_policy" text DEFAULT 'after_final_attempt' NOT NULL,
  ADD COLUMN IF NOT EXISTS "subscription_eligible" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "reseller_eligible" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "featured_at" timestamp;
--> statement-breakpoint
UPDATE "courses"
SET
  "certification_mode" = CASE "owner_type"
    WHEN 'admin' THEN 'octamy'
    WHEN 'creator' THEN 'creator'
    WHEN 'institute' THEN 'institute'
    ELSE 'none'
  END,
  "review_status" = CASE
    WHEN "is_active" = true AND "visibility" = 'public' THEN 'approved'
    WHEN "is_active" = false AND "visibility" IN ('public', 'unlisted') THEN 'pending'
    ELSE 'draft'
  END,
  "default_review_policy" = CASE "owner_type"
    WHEN 'admin' THEN 'immediate'
    WHEN 'institute' THEN 'after_window'
    ELSE 'after_final_attempt'
  END,
  "subscription_eligible" = (
    "owner_type" = 'admin' AND "product_type" = 'assessment' AND "is_active" = true
  ),
  "reseller_eligible" = (
    "owner_type" = 'admin' AND "visibility" = 'public' AND "is_active" = true
  );
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_certification_mode_check"
    CHECK ("certification_mode" IN ('none','octamy','creator','institute','octamy_creator','octamy_institute'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_review_status_check"
    CHECK ("review_status" IN ('draft','pending','approved','rejected','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_default_review_policy_check"
    CHECK ("default_review_policy" IN ('immediate','after_final_attempt','after_window','score_only'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_public_assessment_idx"
  ON "courses" ("owner_type", "product_type", "review_status", "is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audience_bands" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "audience_bands" ("code", "label", "description", "sort_order") VALUES
  ('grade_1_5', 'Grades 1–5', 'Primary-school learners', 10),
  ('grade_6_10', 'Grades 6–10', 'Middle- and secondary-school learners', 20),
  ('grade_11_12', 'Grades 11–12', 'Senior-secondary learners', 30),
  ('undergraduate', 'Undergraduate', 'College and university learners', 40),
  ('postgraduate', 'Postgraduate', 'Advanced degree learners', 50),
  ('competitive_exam', 'Competitive exam aspirants', 'Government and entrance examination preparation', 60),
  ('professional', 'Professional', 'Working professionals and career upskilling', 70)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_audience_bands" (
  "course_id" integer NOT NULL,
  "audience_band_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "course_audience_bands_unique" UNIQUE("course_id", "audience_band_id"),
  CONSTRAINT "course_audience_bands_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade,
  CONSTRAINT "course_audience_bands_audience_band_id_audience_bands_id_fk"
    FOREIGN KEY ("audience_band_id") REFERENCES "public"."audience_bands"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_audience_bands_audience_idx"
  ON "course_audience_bands" ("audience_band_id", "course_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_categories" (
  "course_id" integer NOT NULL,
  "category_id" integer NOT NULL,
  "relation_type" text DEFAULT 'secondary' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "course_categories_unique" UNIQUE("course_id", "category_id"),
  CONSTRAINT "course_categories_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade,
  CONSTRAINT "course_categories_category_id_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict,
  CONSTRAINT "course_categories_relation_type_check"
    CHECK ("relation_type" IN ('primary','secondary'))
);
--> statement-breakpoint
INSERT INTO "course_categories" ("course_id", "category_id", "relation_type")
SELECT "id", "category_id", 'primary' FROM "courses"
ON CONFLICT ("course_id", "category_id") DO NOTHING;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_categories_category_idx"
  ON "course_categories" ("category_id", "course_id");
--> statement-breakpoint

ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "image_alt_text" text,
  ADD COLUMN IF NOT EXISTS "option_media" jsonb,
  ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'draft' NOT NULL,
  ADD COLUMN IF NOT EXISTS "generation_source" text DEFAULT 'human' NOT NULL,
  ADD COLUMN IF NOT EXISTS "reviewed_by" integer,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
--> statement-breakpoint
UPDATE "questions"
SET
  -- Rows created before review governance have no auditable approval event.
  -- Keep inactive history retired and quarantine every formerly active row for
  -- an explicit editor decision; structural validity alone is not review.
  "review_status" = CASE WHEN "is_active" THEN 'pending' ELSE 'retired' END,
  "generation_source" = COALESCE("generation_source", 'human'),
  "reviewed_by" = NULL,
  "reviewed_at" = NULL,
  "is_active" = false;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions"
    ADD CONSTRAINT "questions_reviewed_by_users_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_review_status_check"
    CHECK ("review_status" IN ('draft','pending','approved','rejected','retired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_generation_source_check"
    CHECK ("generation_source" IN ('human','ai_draft','imported'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "exam_instances"
  ADD COLUMN IF NOT EXISTS "question_count" integer DEFAULT 50 NOT NULL,
  ADD COLUMN IF NOT EXISTS "review_policy" text DEFAULT 'after_window' NOT NULL,
  ADD COLUMN IF NOT EXISTS "review_release_at" timestamp,
  ADD COLUMN IF NOT EXISTS "retake_cooldown_min" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "exam_instances"
SET "review_policy" = CASE "owner_type"
  WHEN 'admin' THEN 'immediate'
  WHEN 'creator' THEN 'after_final_attempt'
  ELSE 'after_window'
END;
--> statement-breakpoint
UPDATE "exam_instances" instance
SET "question_count" = LEAST(50, GREATEST(1, available.supported))
FROM (
  SELECT bank_id, COUNT(*) FILTER (
    WHERE is_active = true
      AND review_status = 'approved'
      AND question_format IN ('mcq_single', 'true_false')
      AND max_points > 0
      AND negative_marks BETWEEN 0 AND max_points
      AND CASE
        WHEN json_typeof(options) = 'array' THEN
          json_array_length(options) >= 2
          AND correct_answer >= 0
          AND correct_answer < json_array_length(options)
        ELSE false
      END
  )::integer AS supported
  FROM questions
  GROUP BY bank_id
) available
WHERE instance.bank_id = available.bank_id
  AND instance.question_count = 50;
--> statement-breakpoint
-- Do not leave a scheduled exam live when its bank has no attributable,
-- reviewed questions after the legacy quarantine.
UPDATE "exam_instances" instance
SET "status" = 'draft', "updated_at" = now()
WHERE instance."status" = 'live'
  AND instance."bank_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "questions" question
    WHERE question."bank_id" = instance."bank_id"
      AND question."is_active" = true
      AND question."review_status" = 'approved'
      AND question."question_format" IN ('mcq_single', 'true_false')
  );
--> statement-breakpoint
-- Public assessment cards backed only by synthetic legacy generator output
-- must leave discovery until an editor approves a credible replacement bank.
UPDATE "courses" course
SET
  "is_active" = false,
  "review_status" = 'pending'
WHERE course."product_type" = 'assessment'
  AND course."is_active" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "questions" question
    WHERE question."course_id" = course."id"
      AND question."is_active" = true
      AND question."review_status" = 'approved'
      AND question."question_format" IN ('mcq_single', 'true_false')
  );
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_question_count_check"
    CHECK ("question_count" BETWEEN 1 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_review_policy_check"
    CHECK ("review_policy" IN ('immediate','after_final_attempt','after_window','score_only'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instances" ADD CONSTRAINT "exam_instances_retake_cooldown_check"
    CHECK ("retake_cooldown_min" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "exam_instance_attempts"
  ADD COLUMN IF NOT EXISTS "total_points" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "max_attempts_snapshot" integer,
  ADD COLUMN IF NOT EXISTS "review_policy_snapshot" text,
  ADD COLUMN IF NOT EXISTS "review_release_at_snapshot" timestamp;
--> statement-breakpoint
UPDATE "exam_instance_attempts" attempt
SET
  "max_attempts_snapshot" = COALESCE(attempt."max_attempts_snapshot", instance."max_attempts"),
  "review_policy_snapshot" = COALESCE(attempt."review_policy_snapshot", instance."review_policy"),
  "review_release_at_snapshot" = COALESCE(
    attempt."review_release_at_snapshot",
    instance."review_release_at",
    instance."ends_at"
  )
FROM "exam_instances" instance
WHERE instance."id" = attempt."instance_id";
--> statement-breakpoint
UPDATE "exam_instance_attempts" attempt
SET "total_points" = snapshot."total_points"
FROM (
  SELECT "attempt_id", COALESCE(SUM("max_points"), 0)::integer AS "total_points"
  FROM "exam_instance_attempt_items"
  GROUP BY "attempt_id"
) snapshot
WHERE snapshot."attempt_id" = attempt."id";
--> statement-breakpoint
-- Submitted attempts created before immutable item materialisation used a
-- one-point-per-question scorer. Preserve that denominator for their summary;
-- answer review remains unavailable because no keys are reconstructed after submission.
UPDATE "exam_instance_attempts"
SET "total_points" = "total_questions"
WHERE "total_points" = 0 AND "total_questions" > 0;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instance_attempts" ADD CONSTRAINT "exam_instance_attempts_total_points_check"
    CHECK ("total_points" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instance_attempts" ADD CONSTRAINT "exam_instance_attempts_max_attempts_snapshot_check"
    CHECK ("max_attempts_snapshot" IS NULL OR "max_attempts_snapshot" BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exam_instance_attempts" ADD CONSTRAINT "exam_instance_attempts_review_policy_snapshot_check"
    CHECK ("review_policy_snapshot" IS NULL OR "review_policy_snapshot" IN ('immediate','after_final_attempt','after_window','score_only'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "certificates" ALTER COLUMN "exam_attempt_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificates"
  ADD COLUMN IF NOT EXISTS "scheduled_attempt_id" integer,
  ADD COLUMN IF NOT EXISTS "certification_mode" text DEFAULT 'octamy' NOT NULL,
  ADD COLUMN IF NOT EXISTS "funding_source" text DEFAULT 'direct_payment' NOT NULL,
  ADD COLUMN IF NOT EXISTS "issuer_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "co_issuer_snapshot" jsonb;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_scheduled_attempt_id_exam_instance_attempts_id_fk"
    FOREIGN KEY ("scheduled_attempt_id") REFERENCES "public"."exam_instance_attempts"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_scheduled_attempt_id_unique" UNIQUE("scheduled_attempt_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
UPDATE "certificates" certificate
SET
  "certification_mode" = CASE course."owner_type"
    WHEN 'creator' THEN 'creator'
    WHEN 'institute' THEN 'institute'
    ELSE 'octamy'
  END,
  "issuer_snapshot" = COALESCE(
    certificate."issuer_snapshot",
    jsonb_build_object(
      'ownerType', course."owner_type",
      'ownerId', course."owner_id",
      'issuedBy', certificate."issued_by",
      'courseTitle', certificate."course_title"
    )
  )
FROM "courses" course
WHERE course."id" = certificate."course_id";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_certification_mode_check"
    CHECK ("certification_mode" IN ('octamy','creator','institute','octamy_creator','octamy_institute'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_funding_source_check"
    CHECK ("funding_source" IN ('direct_payment','learner_subscription','institute_contract','complimentary'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "subscription_benefit_usages" (
  "id" serial PRIMARY KEY NOT NULL,
  "subscription_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "certificate_id" integer,
  "benefit_type" text NOT NULL,
  "external_key" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "subscription_benefit_usages_redemption_unique"
    UNIQUE("subscription_id", "benefit_type", "external_key"),
  CONSTRAINT "subscription_benefit_usages_external_unique"
    UNIQUE("benefit_type", "external_key"),
  CONSTRAINT "subscription_benefit_usages_subscription_id_subscriptions_id_fk"
    FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id"),
  CONSTRAINT "subscription_benefit_usages_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
  CONSTRAINT "subscription_benefit_usages_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id"),
  CONSTRAINT "subscription_benefit_usages_certificate_id_certificates_id_fk"
    FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_benefit_usages_user_idx"
  ON "subscription_benefit_usages" ("user_id", "created_at");
