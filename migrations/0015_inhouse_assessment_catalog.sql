-- Canonical, non-overlapping learner bands. The two legacy overlapping bands
-- remain in place for historical foreign keys, but are hidden from new filters
-- because their memberships cannot be migrated without per-course review.
INSERT INTO "audience_bands" (
  "code", "label", "description", "sort_order", "is_active"
) VALUES
  ('grade_1_2', 'Grades 1–2', 'Early-primary learners in Grades 1 and 2', 10, true),
  ('grade_3_5', 'Grades 3–5', 'Primary learners in Grades 3 through 5', 20, true),
  ('grade_6_8', 'Grades 6–8', 'Middle-school learners in Grades 6 through 8', 30, true),
  ('grade_9_10', 'Grades 9–10', 'Secondary learners in Grades 9 and 10', 40, true),
  ('grade_11_12', 'Grades 11–12', 'Senior-secondary learners in Grades 11 and 12', 50, true),
  ('undergraduate', 'Undergraduate', 'College and university undergraduate learners', 60, true),
  ('postgraduate', 'Postgraduate', 'Postgraduate and advanced-degree learners', 70, true),
  ('competitive_exam', 'Competitive exam aspirants', 'Learners preparing for entrance or recruitment examinations', 80, true),
  ('professional', 'Professional', 'Working professionals and career upskilling learners', 90, true)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = EXCLUDED."is_active";
--> statement-breakpoint
UPDATE "audience_bands"
SET "is_active" = false
WHERE "code" IN ('grade_1_5', 'grade_6_10');
--> statement-breakpoint

-- Keep the three public roots stable while completing their search metadata.
INSERT INTO "categories" (
  "name", "description", "icon", "slug", "kind", "is_active", "sort_order",
  "meta_title", "meta_description"
) VALUES
  (
    'School education',
    'Grade-banded school practice organised by subject. Curriculum alignment is versioned and reviewed per assessment before publication.',
    'School', 'school-education', 'collection', true, 10,
    'School Assessments by Grade and Subject | Octamy',
    'Explore reviewed Octamy school assessments by non-overlapping grade band and subject.'
  ),
  (
    'Competitive exams',
    'Entrance and recruitment examination practice organised by the responsible examination family and stage.',
    'Landmark', 'competitive-exams', 'collection', true, 20,
    'Competitive Exam Practice by Exam Family | Octamy',
    'Explore reviewed Octamy practice assessments for entrance and recruitment examination families.'
  ),
  (
    'Professional skills',
    'Career, technology, business and workplace capability assessments.',
    'BriefcaseBusiness', 'professional-skills', 'collection', true, 30,
    'Professional Skill Assessments | Octamy',
    'Explore reviewed Octamy assessments for technology, business and workplace skills.'
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "kind" = EXCLUDED."kind",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "meta_title" = EXCLUDED."meta_title",
  "meta_description" = EXCLUDED."meta_description",
  "updated_at" = now();
--> statement-breakpoint

-- Subject facets are curriculum-neutral. A course's separate audience band and
-- syllabus version provide grade and year context without duplicating slugs.
INSERT INTO "categories" (
  "name", "description", "icon", "slug", "parent_id", "kind", "is_active", "sort_order",
  "meta_title", "meta_description"
)
SELECT
  seed.name, seed.description, seed.icon, seed.slug, parent.id, 'subject', true,
  seed.sort_order, seed.meta_title, seed.meta_description
FROM (VALUES
  ('Mathematics', 'Mathematics practice organised by grade, objective and topic.', 'Sigma', 'mathematics', 10, 'Mathematics Assessments | Octamy', 'Reviewed mathematics practice by grade, objective and topic.'),
  ('English', 'English language, comprehension and communication practice.', 'Languages', 'english', 20, 'English Assessments | Octamy', 'Reviewed English language and comprehension practice by learner level.'),
  ('Environmental Studies', 'Environmental studies practice for primary learners.', 'Leaf', 'environmental-studies', 30, 'Environmental Studies Assessments | Octamy', 'Reviewed environmental studies practice for primary learners.'),
  ('Science', 'Integrated science practice for primary and middle-school learners.', 'Microscope', 'science', 40, 'Science Assessments | Octamy', 'Reviewed integrated science practice by grade and topic.'),
  ('Social Science', 'History, geography, civics and economics practice.', 'Globe2', 'social-science', 50, 'Social Science Assessments | Octamy', 'Reviewed social science practice by grade and topic.'),
  ('Computer Science', 'Computing concepts, digital literacy and computer science practice.', 'MonitorCog', 'computer-science', 60, 'Computer Science Assessments | Octamy', 'Reviewed computing and digital literacy practice by learner level.'),
  ('Physics', 'Physics concepts, numeracy and problem solving.', 'Atom', 'physics', 70, 'Physics Assessments | Octamy', 'Reviewed physics conceptual and numerical practice by learner level.'),
  ('Chemistry', 'Chemistry concepts, reactions and applied reasoning.', 'FlaskConical', 'chemistry', 80, 'Chemistry Assessments | Octamy', 'Reviewed chemistry conceptual and numerical practice by learner level.'),
  ('Biology', 'Biology, life-science and human-health concepts.', 'Dna', 'biology', 90, 'Biology Assessments | Octamy', 'Reviewed biology practice by learner level and topic.')
) AS seed(name, description, icon, slug, sort_order, meta_title, meta_description)
JOIN "categories" parent ON parent."slug" = 'school-education'
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "parent_id" = EXCLUDED."parent_id",
  "kind" = EXCLUDED."kind",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "meta_title" = EXCLUDED."meta_title",
  "meta_description" = EXCLUDED."meta_description",
  "updated_at" = now();
--> statement-breakpoint

-- Examination families use durable, authority-level URLs. Specific stages
-- (for example SSC CGL Tier I or JEE Main) remain assessment slugs, preventing
-- a generic family page from being mistaken for a current official pattern.
INSERT INTO "categories" (
  "name", "description", "icon", "slug", "parent_id", "kind", "is_active", "sort_order",
  "meta_title", "meta_description"
)
SELECT
  seed.name, seed.description, seed.icon, seed.slug, parent.id, 'exam_family', true,
  seed.sort_order, seed.meta_title, seed.meta_description
FROM (VALUES
  ('SSC', 'Staff Selection Commission examination practice, separated by examination and tier.', 'Landmark', 'ssc', 10, 'SSC Practice Assessments | Octamy', 'Reviewed SSC practice assessments organised by examination and tier.'),
  ('UPSC', 'Union Public Service Commission examination practice, separated by examination and stage.', 'Landmark', 'upsc', 20, 'UPSC Practice Assessments | Octamy', 'Reviewed UPSC practice assessments organised by examination and stage.'),
  ('NEET (UG)', 'National Eligibility cum Entrance Test (Undergraduate) practice by subject and syllabus version.', 'Stethoscope', 'neet', 30, 'NEET UG Practice Assessments | Octamy', 'Reviewed NEET UG practice by subject and versioned syllabus.'),
  ('JEE', 'Joint Entrance Examination practice, with JEE Main and JEE Advanced identified at assessment level.', 'DraftingCompass', 'jee', 40, 'JEE Practice Assessments | Octamy', 'Reviewed JEE Main and JEE Advanced practice assessments.'),
  ('Banking recruitment', 'Banking recruitment examination practice, separated by recruiting body, examination and stage.', 'BadgeIndianRupee', 'banking-exams', 50, 'Banking Exam Practice Assessments | Octamy', 'Reviewed banking recruitment practice organised by body, examination and stage.'),
  ('Railway recruitment', 'Railway Recruitment Board examination practice, separated by recruitment notice and stage.', 'TrainFront', 'railway-exams', 60, 'Railway Exam Practice Assessments | Octamy', 'Reviewed Railway Recruitment Board practice organised by examination and stage.'),
  ('State government examinations', 'State-specific recruitment examination practice. State, authority and notification are required on every assessment.', 'Building2', 'state-government-exams', 70, 'State Government Exam Practice | Octamy', 'Reviewed state government examination practice identified by state, authority and notification.'),
  ('State public service commissions', 'State public service commission examination practice identified by state and stage.', 'Scale', 'state-public-service-commissions', 80, 'State PSC Practice Assessments | Octamy', 'Reviewed State PSC practice organised by state, examination and stage.'),
  ('Defence recruitment', 'Defence recruitment and service entrance examination practice identified by authority and stage.', 'Shield', 'defence-exams', 90, 'Defence Exam Practice Assessments | Octamy', 'Reviewed defence recruitment and service entrance examination practice.'),
  ('Teaching eligibility', 'Teacher eligibility examination practice identified by authority, paper and level.', 'GraduationCap', 'teaching-eligibility-exams', 100, 'Teaching Eligibility Practice | Octamy', 'Reviewed teacher eligibility practice organised by authority, paper and level.')
) AS seed(name, description, icon, slug, sort_order, meta_title, meta_description)
JOIN "categories" parent ON parent."slug" = 'competitive-exams'
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "parent_id" = EXCLUDED."parent_id",
  "kind" = EXCLUDED."kind",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "meta_title" = EXCLUDED."meta_title",
  "meta_description" = EXCLUDED."meta_description",
  "updated_at" = now();
--> statement-breakpoint

-- The catalogue synchronizer and importer share stable topic slugs. Repair
-- exact historical duplicates before enforcing per-bank uniqueness.
WITH duplicate_topics AS (
  SELECT "id", min("id") OVER (PARTITION BY "bank_id", "slug") AS canonical_id
  FROM "question_topics"
)
UPDATE "questions" question
SET "topic_id" = duplicate_topics.canonical_id
FROM duplicate_topics
WHERE question."topic_id" = duplicate_topics."id"
  AND duplicate_topics."id" <> duplicate_topics.canonical_id;
--> statement-breakpoint
WITH duplicate_topics AS (
  SELECT "id", min("id") OVER (PARTITION BY "bank_id", "slug") AS canonical_id
  FROM "question_topics"
)
UPDATE "course_question_blueprint" blueprint
SET "topic_id" = duplicate_topics.canonical_id,
    "updated_at" = now()
FROM duplicate_topics
WHERE blueprint."topic_id" = duplicate_topics."id"
  AND duplicate_topics."id" <> duplicate_topics.canonical_id;
--> statement-breakpoint
WITH duplicate_topics AS (
  SELECT "id", min("id") OVER (PARTITION BY "bank_id", "slug") AS canonical_id
  FROM "question_topics"
)
UPDATE "question_topics" child
SET "parent_id" = duplicate_topics.canonical_id,
    "updated_at" = now()
FROM duplicate_topics
WHERE child."parent_id" = duplicate_topics."id"
  AND duplicate_topics."id" <> duplicate_topics.canonical_id;
--> statement-breakpoint
WITH duplicate_topics AS (
  SELECT "id", row_number() OVER (PARTITION BY "bank_id", "slug" ORDER BY "id") AS ordinal
  FROM "question_topics"
)
DELETE FROM "question_topics" topic
USING duplicate_topics
WHERE topic."id" = duplicate_topics."id"
  AND duplicate_topics.ordinal > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "question_topics_bank_slug_unique"
  ON "question_topics" ("bank_id", "slug");
