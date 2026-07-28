-- Release evidence remains physically immutable. A separate append-only record
-- voids an exact bundle or accessibility acceptance without erasing the false
-- attribution, while FORCE RLS prevents ordinary evaluators from treating a
-- voided row as current evidence.
CREATE TABLE "assessment_release_evidence_revocations" (
  "id" serial PRIMARY KEY NOT NULL,
  "release_bundle_id" integer,
  "accessibility_acceptance_id" integer,
  "reason" text NOT NULL,
  "recorded_by_user_id" integer NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_release_evidence_revocations_exact_target_check" CHECK (
    num_nonnulls("release_bundle_id", "accessibility_acceptance_id") = 1
  ),
  CONSTRAINT "assessment_release_evidence_revocations_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 20 AND 1000
  ),
  CONSTRAINT "assessment_release_evidence_revocations_bundle_unique" UNIQUE ("release_bundle_id"),
  CONSTRAINT "assessment_release_evidence_revocations_accessibility_unique" UNIQUE ("accessibility_acceptance_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_release_evidence_revocations" ADD CONSTRAINT "assessment_release_evidence_revocations_bundle_fk"
  FOREIGN KEY ("release_bundle_id") REFERENCES "assessment_release_bundles"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_evidence_revocations" ADD CONSTRAINT "assessment_release_evidence_revocations_accessibility_fk"
  FOREIGN KEY ("accessibility_acceptance_id") REFERENCES "assessment_accessibility_acceptances"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_evidence_revocations" ADD CONSTRAINT "assessment_release_evidence_revocations_recorded_by_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_release_evidence_revocations_recorded_at_idx"
  ON "assessment_release_evidence_revocations" ("recorded_at", "id");

--> statement-breakpoint
-- Authorization is an append-only event stream. Revocation events point to one
-- exact grant; current authorization means a grant has no such event.
CREATE TABLE "assessment_release_role_authorizations" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "release_role" text NOT NULL,
  "authorization_action" text NOT NULL,
  "supersedes_authorization_id" integer,
  "reason" text NOT NULL,
  "recorded_by_user_id" integer NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_release_role_authorizations_role_check" CHECK (
    "release_role" IN (
      'release_operator', 'accessibility_reviewer', 'content_reviewer',
      'rights_reviewer', 'cut_score_approver', 'qa_reviewer',
      'publisher', 'rollback_owner'
    )
  ),
  CONSTRAINT "assessment_release_role_authorizations_action_check" CHECK (
    "authorization_action" IN ('grant', 'revoke')
  ),
  CONSTRAINT "assessment_release_role_authorizations_event_shape_check" CHECK (
    ("authorization_action" = 'grant' AND "supersedes_authorization_id" IS NULL)
    OR ("authorization_action" = 'revoke' AND "supersedes_authorization_id" IS NOT NULL)
  ),
  CONSTRAINT "assessment_release_role_authorizations_reason_check" CHECK (
    length(btrim("reason")) BETWEEN 20 AND 1000
  ),
  CONSTRAINT "assessment_release_role_authorizations_supersedes_unique" UNIQUE ("supersedes_authorization_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_release_role_authorizations" ADD CONSTRAINT "assessment_release_role_authorizations_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_role_authorizations" ADD CONSTRAINT "assessment_release_role_authorizations_recorded_by_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "assessment_release_role_authorizations" ADD CONSTRAINT "assessment_release_role_authorizations_supersedes_fk"
  FOREIGN KEY ("supersedes_authorization_id") REFERENCES "assessment_release_role_authorizations"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "assessment_release_role_authorizations_current_idx"
  ON "assessment_release_role_authorizations" ("user_id", "release_role", "authorization_action", "id");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_assessment_release_role_authorization()
RETURNS trigger AS $$
DECLARE
  recorder_is_admin boolean;
  principal_identity text;
  prior_user_id integer;
  prior_role text;
  prior_action text;
BEGIN
  PERFORM pg_advisory_xact_lock(7361, NEW."user_id");

  SELECT "is_admin" INTO recorder_is_admin
    FROM "users" WHERE "id" = NEW."recorded_by_user_id";
  IF recorder_is_admin IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Release-role authorization must be recorded by an administrator';
  END IF;

  IF NEW."authorization_action" = 'grant' THEN
    SELECT lower(concat_ws(' ', "name", "email")) INTO principal_identity
      FROM "users" WHERE "id" = NEW."user_id";
    IF principal_identity IS NULL THEN
      RAISE EXCEPTION 'Release-role principal does not exist';
    END IF;
    IF principal_identity ~ '(^|[^a-z0-9])(smoke|test|testing|automation|automated|bot|robot|system|service account)([^a-z0-9]|$)'
      OR principal_identity ~ '\m(ai|artificial intelligence)\M.*\m(author|authoring|generated|automation)\M'
      OR principal_identity ~ '\massessment authoring\M'
    THEN
      RAISE EXCEPTION 'Automation, AI-authoring, test, and smoke identities cannot receive release roles';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "assessment_release_role_authorizations" grant_event
      WHERE grant_event."user_id" = NEW."user_id"
        AND grant_event."release_role" = NEW."release_role"
        AND grant_event."authorization_action" = 'grant'
        AND NOT EXISTS (
          SELECT 1 FROM "assessment_release_role_authorizations" revoke_event
          WHERE revoke_event."supersedes_authorization_id" = grant_event."id"
            AND revoke_event."authorization_action" = 'revoke'
        )
    ) THEN
      RAISE EXCEPTION 'An active grant already exists for this release principal and role';
    END IF;
  ELSE
    SELECT "user_id", "release_role", "authorization_action"
      INTO prior_user_id, prior_role, prior_action
      FROM "assessment_release_role_authorizations"
      WHERE "id" = NEW."supersedes_authorization_id";
    IF prior_action IS DISTINCT FROM 'grant'
      OR prior_user_id IS DISTINCT FROM NEW."user_id"
      OR prior_role IS DISTINCT FROM NEW."release_role"
    THEN
      RAISE EXCEPTION 'Release-role revocation must supersede the exact matching grant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER assessment_release_role_authorizations_policy
  BEFORE INSERT ON "assessment_release_role_authorizations"
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_release_role_authorization();
--> statement-breakpoint
CREATE TRIGGER assessment_release_role_authorizations_immutable
  BEFORE UPDATE OR DELETE ON "assessment_release_role_authorizations"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_release_evidence_revocations_immutable
  BEFORE UPDATE OR DELETE ON "assessment_release_evidence_revocations"
  FOR EACH ROW EXECUTE FUNCTION prevent_assessment_release_evidence_mutation();

--> statement-breakpoint
-- Voided source rows stay queryable to superusers for incident audit, but are
-- absent from all ordinary application/inventory reads. INSERT remains allowed;
-- existing database triggers still reject UPDATE and DELETE.
ALTER TABLE "assessment_release_bundles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assessment_release_bundles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assessment_release_bundles_unvoided_select"
  ON "assessment_release_bundles" FOR SELECT
  USING (NOT EXISTS (
    SELECT 1 FROM "assessment_release_evidence_revocations" revocation
    WHERE revocation."release_bundle_id" = "assessment_release_bundles"."id"
  ));
--> statement-breakpoint
CREATE POLICY "assessment_release_bundles_insert"
  ON "assessment_release_bundles" FOR INSERT WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE "assessment_accessibility_acceptances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assessment_accessibility_acceptances" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assessment_accessibility_acceptances_unvoided_select"
  ON "assessment_accessibility_acceptances" FOR SELECT
  USING (NOT EXISTS (
    SELECT 1 FROM "assessment_release_evidence_revocations" revocation
    WHERE revocation."accessibility_acceptance_id" = "assessment_accessibility_acceptances"."id"
  ));
--> statement-breakpoint
CREATE POLICY "assessment_accessibility_acceptances_insert"
  ON "assessment_accessibility_acceptances" FOR INSERT WITH CHECK (true);
