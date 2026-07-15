ALTER TABLE "exam_sessions"
  ADD COLUMN IF NOT EXISTS "question_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Give every published Octamy blueprint assessment a stable, non-zero INR
-- price. md5(slug) makes the one-time distribution deterministic across
-- environments while keeping values within the approved ₹25–₹100 range.
WITH priced AS (
  SELECT
    id,
    25 + ((('x' || substr(md5(slug), 1, 8))::bit(32)::bigint % 76)) AS price_inr
  FROM courses
  WHERE owner_type = 'admin'
    AND owner_id IS NULL
    AND product_type = 'assessment'
    AND use_blueprint_engine = true
    AND price <= 0
)
UPDATE courses AS course
SET
  price = priced.price_inr::numeric(10, 2),
  content_price = priced.price_inr::numeric(10, 2)
FROM priced
WHERE course.id = priced.id;
