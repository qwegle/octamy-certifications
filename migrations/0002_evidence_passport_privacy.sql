ALTER TABLE "users"
  ALTER COLUMN "profile_visibility" SET DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "evidence_passport_public" boolean DEFAULT false NOT NULL;
