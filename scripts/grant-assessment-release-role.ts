#!/usr/bin/env node

import "dotenv/config";

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import type { AssessmentReleaseRole } from "./record-assessment-release-evidence";

const { Client } = pg;

export const ASSESSMENT_RELEASE_ROLES: readonly AssessmentReleaseRole[] = [
  "release_operator",
  "accessibility_reviewer",
  "content_reviewer",
  "rights_reviewer",
  "cut_score_approver",
  "qa_reviewer",
  "publisher",
  "rollback_owner",
];

const CONFLICTING_APPROVAL_ROLES = new Set<AssessmentReleaseRole>([
  "accessibility_reviewer",
  "content_reviewer",
  "rights_reviewer",
  "cut_score_approver",
  "qa_reviewer",
  "publisher",
]);

const FORBIDDEN_RELEASE_IDENTITY = /(^|[^a-z0-9])(smoke|test|testing|automation|automated|bot|robot|system|service account)([^a-z0-9]|$)|\b(ai|artificial intelligence)\b.*\b(author|authoring|generated|automation)\b|\bassessment authoring\b/i;

export function assertGrantableReleaseIdentity(user: { id: number; name: string; email: string }) {
  const identity = `${user.name} ${user.email}`.normalize("NFKC");
  if (FORBIDDEN_RELEASE_IDENTITY.test(identity)) {
    throw new Error(`RELEASE_ROLE_TARGET_FORBIDDEN: user ${user.id} is an automation, AI-authoring, test, or smoke identity`);
  }
}

export function assertReleaseRoleGrantConflict(
  requestedRole: AssessmentReleaseRole,
  currentRoles: AssessmentReleaseRole[],
  singleOfficerException: boolean,
  singleOfficerExceptionReason?: string,
) {
  if (singleOfficerException) {
    throw new Error("LEGACY_SINGLE_OFFICER_EXCEPTION_DISABLED: grant only release_operator to the accountable admin and select single_accountable_officer when recording evidence");
  }
  const conflicts = currentRoles.filter((role) => role !== requestedRole
    && CONFLICTING_APPROVAL_ROLES.has(role)
    && CONFLICTING_APPROVAL_ROLES.has(requestedRole));
  if (conflicts.length > 0 && !singleOfficerException) {
    throw new Error(`CONFLICTING_RELEASE_ROLE: user already holds ${conflicts.join(", ")}; use --single-officer-exception with a documented reason only for a genuine small-team consolidation`);
  }
  if (conflicts.length === 0 && singleOfficerException) {
    throw new Error("SINGLE_OFFICER_EXCEPTION_NOT_APPLICABLE: the target has no current conflicting release role");
  }
  if (singleOfficerException) requireString("singleOfficerExceptionReason", singleOfficerExceptionReason ?? "", 20, 1000);
}

export type GrantAssessmentReleaseRoleOptions = {
  databaseUrl: string;
  grantingAdminUserId: number;
  targetUserId: number;
  role: AssessmentReleaseRole;
  reason: string;
  expiresAt?: string;
  singleOfficerException?: boolean;
  singleOfficerExceptionReason?: string;
  apply?: boolean;
  confirmReleaseRoleGrant?: boolean;
};

function requireString(name: string, value: string, minimum: number, maximum: number) {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${name} must be ${minimum}-${maximum} characters`);
  return normalized;
}

function requireUserId(name: string, value: number) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must identify an existing user`);
  return value;
}

export async function grantAssessmentReleaseRole(options: GrantAssessmentReleaseRoleOptions) {
  const grantingAdminUserId = requireUserId("grantingAdminUserId", options.grantingAdminUserId);
  const targetUserId = requireUserId("targetUserId", options.targetUserId);
  if (!ASSESSMENT_RELEASE_ROLES.includes(options.role)) throw new Error(`role must be one of: ${ASSESSMENT_RELEASE_ROLES.join(", ")}`);
  const reason = requireString("reason", options.reason, 20, 1000);
  if (options.apply && !options.confirmReleaseRoleGrant) throw new Error("--confirm-release-role-grant is required with --apply");
  if (!options.apply && options.confirmReleaseRoleGrant) throw new Error("--confirm-release-role-grant is valid only with --apply");

  let expiresAt: Date | null = null;
  if (options.expiresAt) {
    expiresAt = new Date(options.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new Error("expiresAt must be a valid future timestamp");
    }
  }

  const client = new Client({ connectionString: options.databaseUrl, application_name: "octamy-grant-assessment-release-role" });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query(options.apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '2s'");

    const users = await client.query<{ id: number; name: string; email: string; isAdmin: boolean }>(
      `SELECT id, name, email, is_admin AS "isAdmin" FROM users WHERE id = ANY($1::int[])`,
      [[grantingAdminUserId, targetUserId]],
    );
    const grantingAdmin = users.rows.find((user) => user.id === grantingAdminUserId);
    const target = users.rows.find((user) => user.id === targetUserId);
    if (!grantingAdmin?.isAdmin) throw new Error("GRANTING_ADMIN_NOT_AUTHORIZED: --granting-admin-user-id must identify a platform administrator");
    if (!target) throw new Error(`RELEASE_ROLE_TARGET_NOT_FOUND: target user ${targetUserId} does not exist`);
    assertGrantableReleaseIdentity(target);

    const current = await client.query<{ id: number; releaseRole: AssessmentReleaseRole }>(
      `SELECT grant_row.id, grant_row.release_role AS "releaseRole"
         FROM assessment_release_role_grants grant_row
         LEFT JOIN assessment_release_role_revocations revocation ON revocation.grant_id = grant_row.id
        WHERE grant_row.user_id = $1
          AND revocation.id IS NULL
          AND (grant_row.expires_at IS NULL OR grant_row.expires_at > now())
        ORDER BY grant_row.id`,
      [targetUserId],
    );
    if (current.rows.some((grant) => grant.releaseRole === options.role)) {
      throw new Error(`RELEASE_ROLE_ALREADY_GRANTED: user ${targetUserId} already has current ${options.role} authorization`);
    }
    assertReleaseRoleGrantConflict(
      options.role,
      current.rows.map((grant) => grant.releaseRole),
      options.singleOfficerException === true,
      options.singleOfficerExceptionReason,
    );

    const plan = {
      targetUserId,
      role: options.role,
      grantedByUserId: grantingAdminUserId,
      expiresAt: expiresAt?.toISOString() ?? null,
      singleOfficerException: options.singleOfficerException === true,
      singleOfficerExceptionReason: options.singleOfficerException === true
        ? requireString("singleOfficerExceptionReason", options.singleOfficerExceptionReason ?? "", 20, 1000)
        : null,
    };
    if (!options.apply) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return { status: "dry_run", ...plan };
    }

    const inserted = await client.query<{ id: number; grantedAt: string }>(
      `INSERT INTO assessment_release_role_grants
        (user_id, release_role, granted_by_user_id, expires_at, reason, single_officer_exception, single_officer_exception_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, granted_at AS "grantedAt"`,
      [targetUserId, options.role, grantingAdminUserId, expiresAt, reason, plan.singleOfficerException, plan.singleOfficerExceptionReason],
    );
    await client.query("COMMIT");
    transactionOpen = false;
    return { status: "applied", grantId: inserted.rows[0].id, grantedAt: inserted.rows[0].grantedAt, ...plan };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      "granting-admin-user-id": { type: "string" },
      "target-user-id": { type: "string" },
      role: { type: "string" },
      reason: { type: "string" },
      "expires-at": { type: "string" },
      "single-officer-exception": { type: "boolean", default: false },
      "single-officer-exception-reason": { type: "string" },
      apply: { type: "boolean", default: false },
      "confirm-release-role-grant": { type: "boolean", default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const required = (name: keyof typeof values) => {
    const value = values[name];
    if (typeof value !== "string" || !value) throw new Error(`--${String(name)} is required`);
    return value;
  };
  const role = required("role") as AssessmentReleaseRole;
  const result = await grantAssessmentReleaseRole({
    databaseUrl: process.env.DATABASE_URL,
    grantingAdminUserId: Number(required("granting-admin-user-id")),
    targetUserId: Number(required("target-user-id")),
    role,
    reason: required("reason"),
    expiresAt: values["expires-at"],
    singleOfficerException: values["single-officer-exception"],
    singleOfficerExceptionReason: values["single-officer-exception-reason"],
    apply: values.apply,
    confirmReleaseRoleGrant: values["confirm-release-role-grant"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/grant-assessment-release-role\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
