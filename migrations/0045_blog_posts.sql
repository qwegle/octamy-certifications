-- Honest, admin-authored blog content with optional links to live assessments.
-- No rows are seeded: publication is always an explicit authenticated action.
CREATE TABLE "blog_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "excerpt" text NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "author_user_id" integer NOT NULL,
  "published_at" timestamp with time zone,
  "canonical_path" text NOT NULL,
  "seo_title" text,
  "seo_description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "blog_posts_slug_format_check" CHECK (
    length("slug") BETWEEN 1 AND 160
    AND "slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT "blog_posts_title_check" CHECK (length(btrim("title")) BETWEEN 5 AND 180),
  CONSTRAINT "blog_posts_excerpt_check" CHECK (length(btrim("excerpt")) BETWEEN 20 AND 320),
  CONSTRAINT "blog_posts_body_check" CHECK (
    length(btrim("body")) BETWEEN 20 AND 50000
    AND position('<' IN "body") = 0
    AND position('>' IN "body") = 0
  ),
  CONSTRAINT "blog_posts_status_check" CHECK ("status" IN ('draft', 'published')),
  CONSTRAINT "blog_posts_publication_check" CHECK (
    ("status" = 'draft' AND "published_at" IS NULL)
    OR ("status" = 'published' AND "published_at" IS NOT NULL)
  ),
  CONSTRAINT "blog_posts_canonical_path_check" CHECK (
    "canonical_path" = '/blog/' || "slug"
  ),
  CONSTRAINT "blog_posts_seo_title_check" CHECK (
    "seo_title" IS NULL OR length(btrim("seo_title")) BETWEEN 5 AND 70
  ),
  CONSTRAINT "blog_posts_seo_description_check" CHECK (
    "seo_description" IS NULL OR length(btrim("seo_description")) BETWEEN 20 AND 180
  )
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_user_fk"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" ("slug");
--> statement-breakpoint
CREATE INDEX "blog_posts_published_listing_idx"
  ON "blog_posts" ("published_at" DESC, "id" DESC)
  WHERE "status" = 'published';

--> statement-breakpoint
CREATE TABLE "blog_post_assessments" (
  "blog_post_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "blog_post_assessments_unique" UNIQUE ("blog_post_id", "course_id")
);
--> statement-breakpoint
ALTER TABLE "blog_post_assessments" ADD CONSTRAINT "blog_post_assessments_post_fk"
  FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "blog_post_assessments" ADD CONSTRAINT "blog_post_assessments_course_fk"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "blog_post_assessments_course_idx"
  ON "blog_post_assessments" ("course_id", "blog_post_id");
