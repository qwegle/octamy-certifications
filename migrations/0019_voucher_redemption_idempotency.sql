ALTER TABLE "certification_vouchers"
  ADD COLUMN IF NOT EXISTS "redemption_key_hash" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certification_vouchers_redemption_key_idx"
  ON "certification_vouchers" USING btree ("redemption_key_hash")
  WHERE "redemption_key_hash" IS NOT NULL;
