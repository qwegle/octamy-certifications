ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "kind" text NOT NULL,
  "url" text NOT NULL,
  "storage_provider" text DEFAULT 'local' NOT NULL,
  "storage_key" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "width" integer,
  "height" integer,
  "alt_text" text,
  "caption" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "media_assets_owner_created_idx"
  ON "media_assets" USING btree ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "media_assets_owner_kind_idx"
  ON "media_assets" USING btree ("user_id", "kind");
