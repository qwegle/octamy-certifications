-- Migration 0036 enabled FORCE ROW LEVEL SECURITY on the release-evidence
-- tables so a voided row could not be read as current evidence. That broke
-- pg_dump for the table owner, which made the verified pre-migration backup
-- fail and therefore blocked every deployment:
--
--   pg_dump: error: query failed: ERROR: query would be affected by
--   row-level security policy for table "assessment_accessibility_acceptances"
--
-- A backup that cannot run is a worse risk than a permissive read, and the
-- void semantics do not depend on RLS: the evaluator joins the append-only
-- revocation table and ignores voided evidence, the rows remain physically
-- immutable through their update/delete triggers, and the revocation record
-- preserves the false attribution for audit rather than hiding it.
--
-- Drop the policies and disable RLS on both tables. Row visibility policy is
-- enforced in the governed inventory evaluator, not in the dump path.

DROP POLICY IF EXISTS "assessment_release_bundles_unvoided_select" ON "assessment_release_bundles";
DROP POLICY IF EXISTS "assessment_release_bundles_insert" ON "assessment_release_bundles";
ALTER TABLE "assessment_release_bundles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "assessment_release_bundles" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessment_accessibility_acceptances_unvoided_select" ON "assessment_accessibility_acceptances";
DROP POLICY IF EXISTS "assessment_accessibility_acceptances_insert" ON "assessment_accessibility_acceptances";
ALTER TABLE "assessment_accessibility_acceptances" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "assessment_accessibility_acceptances" DISABLE ROW LEVEL SECURITY;
