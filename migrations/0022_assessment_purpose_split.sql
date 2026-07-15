ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_purpose" text DEFAULT 'certification' NOT NULL;
--> statement-breakpoint
ALTER TABLE "question_banks" ADD COLUMN IF NOT EXISTS "bank_purpose" text DEFAULT 'certification' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_assessment_purpose_check"
    CHECK ("assessment_purpose" IN ('certification', 'practice'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_bank_purpose_check"
    CHECK ("bank_purpose" IN ('certification', 'practice'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_assessment_purpose_idx"
  ON "courses" USING btree ("assessment_purpose", "owner_type", "product_type", "review_status", "is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_banks_purpose_status_idx"
  ON "question_banks" USING btree ("bank_purpose", "status", "updated_at");
--> statement-breakpoint
INSERT INTO "categories" ("name", "description", "icon", "slug", "parent_id", "kind", "is_active", "sort_order", "meta_title", "meta_description")
VALUES
  ('Tech certifications', 'Recruiter-relevant technology and digital-industry certification paths.', 'Code2', 'tech-certifications', NULL, 'collection', true, 1, 'Tech Certifications | Octamy', 'Recruiter-relevant Octamy certifications for technology and digital-industry skills.')
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "parent_id" = EXCLUDED."parent_id",
  "kind" = EXCLUDED."kind",
  "is_active" = true,
  "sort_order" = EXCLUDED."sort_order",
  "meta_title" = EXCLUDED."meta_title",
  "meta_description" = EXCLUDED."meta_description",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "categories" ("name", "description", "icon", "slug", "parent_id", "kind", "is_active", "sort_order", "meta_title", "meta_description")
VALUES
  ('Software engineering', 'Programming, backend, frontend, APIs, testing and engineering fundamentals.', 'Code2', 'software-engineering', (SELECT id FROM categories WHERE slug = 'tech-certifications'), 'skill', true, 10, 'Software Engineering Certifications | Octamy', 'Verified software engineering skill certifications for job-ready candidates.'),
  ('Data, AI and analytics', 'Data analysis, data science, machine learning and applied AI.', 'BrainCircuit', 'data-ai-analytics', (SELECT id FROM categories WHERE slug = 'tech-certifications'), 'skill', true, 20, 'Data and AI Certifications | Octamy', 'Verified data, analytics, machine learning and AI skill certifications.'),
  ('Cloud and DevOps', 'Cloud platforms, DevOps automation, reliability and deployment operations.', 'CloudCog', 'cloud-devops', (SELECT id FROM categories WHERE slug = 'tech-certifications'), 'skill', true, 30, 'Cloud and DevOps Certifications | Octamy', 'Verified cloud, DevOps and reliability certifications for technical hiring.'),
  ('Cybersecurity', 'Security fundamentals, secure operations and practical risk awareness.', 'ShieldCheck', 'cybersecurity', (SELECT id FROM categories WHERE slug = 'tech-certifications'), 'skill', true, 40, 'Cybersecurity Certifications | Octamy', 'Verified cybersecurity skill certifications for technical and operational roles.'),
  ('Product and business technology', 'Product, business analysis, digital operations and technology-enabled workflows.', 'BriefcaseBusiness', 'product-business-technology', (SELECT id FROM categories WHERE slug = 'tech-certifications'), 'skill', true, 50, 'Product and Business Technology Certifications | Octamy', 'Verified product, business analysis and digital operations certifications.')
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "parent_id" = EXCLUDED."parent_id",
  "kind" = EXCLUDED."kind",
  "is_active" = true,
  "sort_order" = EXCLUDED."sort_order",
  "meta_title" = EXCLUDED."meta_title",
  "meta_description" = EXCLUDED."meta_description",
  "updated_at" = now();
--> statement-breakpoint
UPDATE "courses" c
SET "assessment_purpose" = 'practice',
    "subscription_eligible" = true,
    "certification_mode" = 'none',
    "price" = '0.00',
    "content_price" = '0.00'
WHERE c."product_type" = 'assessment'
  AND c."owner_type" = 'admin'
  AND (
    c."slug" LIKE '%-practice'
    OR c."slug" LIKE 'grade-%'
    OR c."category_id" IN (
      WITH RECURSIVE practice_categories AS (
        SELECT id FROM categories WHERE slug IN ('competitive-exams', 'school-education')
        UNION ALL
        SELECT child.id FROM categories child
        INNER JOIN practice_categories parent ON child.parent_id = parent.id
      )
      SELECT id FROM practice_categories
    )
  );
--> statement-breakpoint
UPDATE "question_banks"
SET "bank_purpose" = 'practice',
    "updated_at" = now()
WHERE "owner_type" = 'admin'
  AND (
    "exam_family" IS NOT NULL
    OR "grade_band" IS NOT NULL
    OR "slug" ~* '(ssc|neet|jee|railway|banking|grade|school|math|physics|chemistry|biology|english|practice)'
    OR "name" ~* '(ssc|neet|jee|railway|banking|grade|school|math|physics|chemistry|biology|english|practice)'
  );
--> statement-breakpoint
UPDATE "courses" c
SET "is_active" = false,
    "visibility" = 'private',
    "review_status" = CASE WHEN "review_status" = 'approved' THEN 'pending' ELSE "review_status" END
WHERE c."product_type" = 'assessment'
  AND c."owner_type" = 'admin'
  AND c."assessment_purpose" = 'practice'
  AND (
    c."slug" LIKE 'grade-%'
    OR c."category_id" IN (
      WITH RECURSIVE school_categories AS (
        SELECT id FROM categories WHERE slug = 'school-education'
        UNION ALL
        SELECT child.id FROM categories child
        INNER JOIN school_categories parent ON child.parent_id = parent.id
      )
      SELECT id FROM school_categories
    )
  );
