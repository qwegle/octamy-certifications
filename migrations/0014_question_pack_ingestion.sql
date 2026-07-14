ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "content_hash" text,
  ADD COLUMN IF NOT EXISTS "answer_metadata" jsonb;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_content_hash_check"
    CHECK ("content_hash" IS NULL OR "content_hash" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_answer_metadata_object_check"
    CHECK ("answer_metadata" IS NULL OR jsonb_typeof("answer_metadata") = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "questions_bank_content_hash_unique"
  ON "questions" ("bank_id", "content_hash")
  WHERE "bank_id" IS NOT NULL AND "content_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_ingestion_inventory_idx"
  ON "questions" ("bank_id", "generation_source", "review_status", "is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "question_pack_sources" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "publisher" text NOT NULL,
  "dataset_version" text NOT NULL,
  "description" text,
  "source_url" text NOT NULL,
  "retrieved_at" timestamp NOT NULL,
  "manifest_sha256" text NOT NULL,
  "license_identifier" text NOT NULL,
  "license_name" text NOT NULL,
  "license_url" text NOT NULL,
  "rights_basis" text NOT NULL,
  "commercial_use_allowed" boolean DEFAULT false NOT NULL,
  "derivatives_allowed" boolean DEFAULT false NOT NULL,
  "share_alike_obligation" text DEFAULT 'none' NOT NULL,
  "attribution_text" text NOT NULL,
  "evidence_reference" text NOT NULL,
  "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "rights_review_status" text DEFAULT 'pending' NOT NULL,
  "rights_reviewed_at" timestamp,
  "rights_reviewed_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "question_pack_sources_key_check"
    CHECK ("source_key" ~ '^[a-z0-9][a-z0-9._:/-]{2,159}$'),
  CONSTRAINT "question_pack_sources_manifest_hash_check"
    CHECK ("manifest_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "question_pack_sources_rights_basis_check"
    CHECK ("rights_basis" IN ('owned','contract','permission','open_license','public_domain')),
  CONSTRAINT "question_pack_sources_review_status_check"
    CHECK ("rights_review_status" IN ('pending','verified','rejected')),
  CONSTRAINT "question_pack_sources_provenance_object_check"
    CHECK (jsonb_typeof("provenance") = 'object'),
  CONSTRAINT "question_pack_sources_verified_rights_check"
    CHECK (
      "rights_review_status" <> 'verified'
      OR (
        "commercial_use_allowed" = true
        AND "derivatives_allowed" = true
        AND "rights_reviewed_at" IS NOT NULL
        AND length(btrim(COALESCE("rights_reviewed_by", ''))) >= 3
        AND length(btrim("license_identifier")) >= 3
        AND length(btrim("license_url")) >= 8
        AND length(btrim("source_url")) >= 8
        AND length(btrim("evidence_reference")) >= 8
      )
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_pack_sources_rights_idx"
  ON "question_pack_sources" ("rights_review_status", "publisher");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "question_pack_import_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_id" integer NOT NULL,
  "bank_id" integer NOT NULL,
  "input_name" text NOT NULL,
  "input_sha256" text NOT NULL,
  "status" text DEFAULT 'validating' NOT NULL,
  "operator" text NOT NULL,
  "batch_size" integer NOT NULL,
  "max_rows" integer DEFAULT 100000 NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "valid_rows" integer DEFAULT 0 NOT NULL,
  "invalid_rows" integer DEFAULT 0 NOT NULL,
  "source_duplicate_rows" integer DEFAULT 0 NOT NULL,
  "content_duplicate_rows" integer DEFAULT 0 NOT NULL,
  "processed_rows" integer DEFAULT 0 NOT NULL,
  "inserted_questions" integer DEFAULT 0 NOT NULL,
  "linked_provenance" integer DEFAULT 0 NOT NULL,
  "failure_code" text,
  "failure_message" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "question_pack_runs_source_bank_input_unique" UNIQUE("source_id", "bank_id", "input_sha256"),
  CONSTRAINT "question_pack_runs_id_source_unique" UNIQUE("id", "source_id"),
  CONSTRAINT "question_pack_runs_source_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "public"."question_pack_sources"("id") ON DELETE restrict,
  CONSTRAINT "question_pack_runs_bank_id_fk"
    FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE restrict,
  CONSTRAINT "question_pack_runs_status_check"
    CHECK ("status" IN ('validating','importing','completed','failed')),
  CONSTRAINT "question_pack_runs_input_hash_check"
    CHECK ("input_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "question_pack_runs_batch_size_check"
    CHECK ("batch_size" BETWEEN 1 AND 2000),
  CONSTRAINT "question_pack_runs_max_rows_check"
    CHECK ("max_rows" BETWEEN 1 AND 100000),
  CONSTRAINT "question_pack_runs_counts_check"
    CHECK (
      "total_rows" >= 0 AND "valid_rows" >= 0 AND "invalid_rows" >= 0
      AND "source_duplicate_rows" >= 0 AND "content_duplicate_rows" >= 0
      AND "processed_rows" >= 0 AND "inserted_questions" >= 0 AND "linked_provenance" >= 0
      AND "valid_rows" + "invalid_rows" <= "total_rows"
      AND "source_duplicate_rows" <= "valid_rows"
      AND "content_duplicate_rows" <= "valid_rows"
      AND "processed_rows" <= "valid_rows"
      AND "inserted_questions" <= "processed_rows"
      AND "linked_provenance" <= "processed_rows"
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_pack_runs_status_idx"
  ON "question_pack_import_runs" ("status", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_pack_runs_bank_idx"
  ON "question_pack_import_runs" ("bank_id", "started_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "question_provenance" (
  "id" serial PRIMARY KEY NOT NULL,
  "question_id" integer NOT NULL,
  "source_id" integer NOT NULL,
  "import_run_id" integer NOT NULL,
  "source_record_id" text NOT NULL,
  "source_record_hash" text NOT NULL,
  "content_hash" text NOT NULL,
  "disposition" text NOT NULL,
  "language" text NOT NULL,
  "syllabus" text,
  "exam_name" text,
  "exam_year" integer,
  "subject" text NOT NULL,
  "source_topic" text NOT NULL,
  "objective" text,
  "source_locator" text NOT NULL,
  "question_origin" text NOT NULL,
  "answer_evidence" text NOT NULL,
  "explanation_origin" text NOT NULL,
  "source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "question_provenance_source_record_unique" UNIQUE("source_id", "source_record_id"),
  CONSTRAINT "question_provenance_question_id_fk"
    FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict,
  CONSTRAINT "question_provenance_source_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "public"."question_pack_sources"("id") ON DELETE restrict,
  CONSTRAINT "question_provenance_run_id_fk"
    FOREIGN KEY ("import_run_id") REFERENCES "public"."question_pack_import_runs"("id") ON DELETE restrict,
  CONSTRAINT "question_provenance_run_source_fk"
    FOREIGN KEY ("import_run_id", "source_id")
    REFERENCES "public"."question_pack_import_runs"("id", "source_id") ON DELETE restrict,
  CONSTRAINT "question_provenance_record_id_check"
    CHECK ("source_record_id" = btrim("source_record_id") AND length("source_record_id") BETWEEN 3 AND 300),
  CONSTRAINT "question_provenance_record_hash_check"
    CHECK ("source_record_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "question_provenance_content_hash_check"
    CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "question_provenance_disposition_check"
    CHECK ("disposition" IN ('created','deduplicated')),
  CONSTRAINT "question_provenance_origin_check"
    CHECK ("question_origin" IN ('original','licensed_verbatim','licensed_adapted')),
  CONSTRAINT "question_provenance_explanation_origin_check"
    CHECK ("explanation_origin" IN ('original','licensed_verbatim','licensed_adapted')),
  CONSTRAINT "question_provenance_exam_year_check"
    CHECK ("exam_year" IS NULL OR "exam_year" BETWEEN 1900 AND 2100),
  CONSTRAINT "question_provenance_evidence_check"
    CHECK (length(btrim("source_locator")) >= 3 AND length(btrim("answer_evidence")) >= 10),
  CONSTRAINT "question_provenance_metadata_object_check"
    CHECK (jsonb_typeof("source_metadata") = 'object')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_provenance_question_idx"
  ON "question_provenance" ("question_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_provenance_run_idx"
  ON "question_provenance" ("import_run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_provenance_source_content_idx"
  ON "question_provenance" ("source_id", "content_hash");
