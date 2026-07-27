-- The governed read-only inventory found these exact assessment shells still
-- active, public and approved while every one had release blockers. Preserve
-- all questions, provenance, attempts, payments and learner records; only
-- remove unsafe catalogue/attempt reachability until governed release passes.
-- The state predicate makes this idempotent and avoids overwriting any later
-- operator remediation that already moved a shell out of publication.
UPDATE "courses" course
SET
  "is_active" = false,
  "visibility" = 'private',
  "review_status" = 'pending',
  "subscription_eligible" = false,
  "reseller_eligible" = false,
  "featured_at" = NULL
WHERE course."product_type" = 'assessment'
  AND course."assessment_purpose" = 'practice'
  AND course."is_active" = true
  AND course."visibility" = 'public'
  AND course."review_status" = 'approved'
  AND course."slug" IN (
    'ibps-clerk-quantitative-aptitude-practice',
    'ibps-po-quantitative-aptitude-practice',
    'jee-main-chemistry-numerical-practice',
    'jee-main-physics-numerical-practice',
    'neet-ug-chemistry-numerical-practice',
    'neet-ug-physics-numerical-practice',
    'rrb-group-d-mathematics-practice',
    'rrb-ntpc-mathematics-practice',
    'ssc-cgl-tier-1-quantitative-aptitude-practice',
    'ssc-chsl-tier-1-quantitative-aptitude-practice',
    'ssc-mts-numerical-aptitude-practice'
  );
