-- Pricing values are business data managed in Postgres. A higher original/list
-- price makes the current price a sale price automatically; clients cannot
-- create a contradictory sale flag.
CREATE OR REPLACE FUNCTION "octamy_set_course_sale_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."original_price" IS NOT NULL AND NEW."original_price" < NEW."price" THEN
    RAISE EXCEPTION 'original/list price cannot be lower than current price';
  END IF;

  NEW."is_on_sale" :=
    NEW."original_price" IS NOT NULL
    AND NEW."original_price" > NEW."price";
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "courses_set_sale_state" ON "courses";
--> statement-breakpoint
CREATE TRIGGER "courses_set_sale_state"
BEFORE INSERT OR UPDATE OF "price", "original_price", "is_on_sale"
ON "courses"
FOR EACH ROW
EXECUTE FUNCTION "octamy_set_course_sale_state"();
--> statement-breakpoint
UPDATE "courses"
SET "is_on_sale" = (
  "original_price" IS NOT NULL
  AND "original_price" > "price"
)
WHERE "is_on_sale" IS DISTINCT FROM (
  "original_price" IS NOT NULL
  AND "original_price" > "price"
);
--> statement-breakpoint
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_sale_state_check"
  CHECK (
    ("original_price" IS NULL OR "original_price" >= "price")
    AND "is_on_sale" = (
      "original_price" IS NOT NULL
      AND "original_price" > "price"
    )
  );
