import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { pool } from "../db";

export const DELETED_ACCOUNT_NAME = "Deleted account";
export const DELETION_POLICY_VERSION = "learner-account-deletion.v1";
export const DELETION_TOKEN_TTL_MS = 30 * 60_000;

export const ACCOUNT_DELETION_CLASSIFICATION = Object.freeze({
  erase: [
    "users.authentication_and_profile", "user_addresses", "resume_files",
    "learner_preferences_notifications_and_recommendations", "learning_progress_and_reviews",
    "interview_responses_recordings_and_artifact_references", "active_evidence_sharing_grants",
  ],
  retainDeidentified: [
    "issued_credentials_and_public_verification", "payments_tax_and_coupon_records",
    "audit_and_recruiter_evidence_events", "assessment_attempts_and_aggregate_statistics",
  ],
});

export type DeletionState = "requested" | "verified" | "completed" | "cancelled" | "rejected";
export type DeletionRequest = {
  id: string; userId: number; state: DeletionState; tokenExpiresAt: Date | null;
  requestedAt: Date; verifiedAt: Date | null; completedAt: Date | null;
  cancelledAt: Date | null; rejectedAt: Date | null;
};
export type CompletionResult = { request: DeletionRequest; alreadyCompleted: boolean; artifacts: string[] };

export class AccountDeletionError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}

export function assertDeletionOwnership(sessionUserId: number, subjectUserId: number) {
  if (!Number.isSafeInteger(sessionUserId) || sessionUserId <= 0 || sessionUserId !== subjectUserId) {
    throw new AccountDeletionError("ACCOUNT_DELETION_FORBIDDEN", 403, "An account can only delete itself");
  }
}
export function hashDeletionToken(token: string) {
  return crypto.createHash("sha256").update(`octamy-account-deletion:${token}`, "utf8").digest("hex");
}
export function tokenIsUsable(input: { state: DeletionState; expiresAt: Date | null; usedAt?: Date | null }, now = new Date()) {
  return input.state === "requested" && !!input.expiresAt && !input.usedAt && input.expiresAt.getTime() > now.getTime();
}
export function deletedEmail(userId: number) { return `deleted+${userId}@deleted.invalid`; }

export interface AccountDeletionStore {
  current(userId: number): Promise<DeletionRequest | null>;
  artifacts(userId: number): Promise<string[]>;
  create(userId: number, tokenHash: string, expiresAt: Date): Promise<DeletionRequest>;
  reject(requestId: string, reason: string): Promise<void>;
  cancel(userId: number): Promise<DeletionRequest>;
  complete(userId: number, tokenHash: string, now: Date): Promise<CompletionResult>;
}
export interface VerificationMailer { send(input: { to: string; token: string; expiresAt: Date }): Promise<boolean>; }
export type StagedCleanup = { commit(): Promise<void>; rollback(): Promise<void> };
export interface ArtifactCleaner { stage(references: string[]): Promise<StagedCleanup>; }

export class AccountDeletionService {
  constructor(private store: AccountDeletionStore, private mailer: VerificationMailer, private cleaner: ArtifactCleaner, private now = () => new Date()) {}
  current(userId: number) { return this.store.current(userId); }
  async request(user: { userId: number; email: string }) {
    const existing = await this.store.current(user.userId);
    if (existing?.state === "completed") return existing;
    if (existing && ["requested", "verified"].includes(existing.state)) return existing;
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + DELETION_TOKEN_TTL_MS);
    const created = await this.store.create(user.userId, hashDeletionToken(token), expiresAt);
    if (!await this.mailer.send({ to: user.email, token, expiresAt })) {
      await this.store.reject(created.id, "verification_delivery_failed");
      throw new AccountDeletionError("ACCOUNT_DELETION_EMAIL_UNAVAILABLE", 503, "Deletion verification email could not be delivered");
    }
    return created;
  }
  cancel(userId: number) { return this.store.cancel(userId); }
  async confirm(userId: number, token: string) {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) throw new AccountDeletionError("INVALID_DELETION_TOKEN", 400, "Invalid deletion token");
    const staged = await this.cleaner.stage(await this.store.artifacts(userId));
    try {
      const result = await this.store.complete(userId, hashDeletionToken(token), this.now());
      await staged.commit();
      return result;
    } catch (error) { await staged.rollback(); throw error; }
  }
}

function requestRow(row: any): DeletionRequest {
  return { id: row.id, userId: row.user_id, state: row.state, tokenExpiresAt: row.token_expires_at, requestedAt: row.requested_at, verifiedAt: row.verified_at, completedAt: row.completed_at, cancelledAt: row.cancelled_at, rejectedAt: row.rejected_at };
}
function rowCount(result: { rowCount: number | null }) { return Number(result.rowCount || 0); }

export class PostgresAccountDeletionStore implements AccountDeletionStore {
  async artifacts(userId: number) {
    const result = await pool.query(`SELECT resume_url FROM users WHERE id=$1`, [userId]);
    return result.rows[0]?.resume_url ? [String(result.rows[0].resume_url)] : [];
  }
  async current(userId: number) {
    const result = await pool.query(`SELECT * FROM account_deletion_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 1`, [userId]);
    return result.rows[0] ? requestRow(result.rows[0]) : null;
  }
  async create(userId: number, tokenHash: string, expiresAt: Date) {
    const result = await pool.query(`INSERT INTO account_deletion_requests (id,user_id,actor_user_id,state,verification_token_hash,token_expires_at) VALUES ($1,$2,$2,'requested',$3,$4) RETURNING *`, [crypto.randomUUID(), userId, tokenHash, expiresAt]);
    return requestRow(result.rows[0]);
  }
  async reject(requestId: string, reason: string) {
    await pool.query(`UPDATE account_deletion_requests SET state='rejected', rejected_at=now(), rejection_reason=$2, verification_token_hash=NULL, token_expires_at=NULL WHERE id=$1 AND state='requested'`, [requestId, reason]);
  }
  async cancel(userId: number) {
    const result = await pool.query(`UPDATE account_deletion_requests SET state='cancelled', cancelled_at=now(), verification_token_hash=NULL, token_expires_at=NULL WHERE id=(SELECT id FROM account_deletion_requests WHERE user_id=$1 AND state='requested' ORDER BY requested_at DESC LIMIT 1) RETURNING *`, [userId]);
    if (!result.rows[0]) throw new AccountDeletionError("NO_PENDING_DELETION", 409, "No pending deletion request can be cancelled");
    return requestRow(result.rows[0]);
  }
  async complete(userId: number, tokenHash: string, now: Date): Promise<CompletionResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(`SELECT * FROM account_deletion_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 1 FOR UPDATE`, [userId]);
      const request = selected.rows[0];
      if (!request) throw new AccountDeletionError("DELETION_REQUEST_NOT_FOUND", 404, "Deletion request not found");
      assertDeletionOwnership(userId, request.user_id);
      if (request.state === "completed") { await client.query("COMMIT"); return { request: requestRow(request), alreadyCompleted: true, artifacts: [] }; }
      if (!tokenIsUsable({ state: request.state, expiresAt: request.token_expires_at, usedAt: request.token_used_at }, now)) throw new AccountDeletionError("DELETION_TOKEN_EXPIRED_OR_USED", 410, "Deletion token is expired or already used");
      const supplied = Buffer.from(tokenHash, "hex"); const stored = Buffer.from(request.verification_token_hash, "hex");
      if (supplied.length !== stored.length || !crypto.timingSafeEqual(supplied, stored)) throw new AccountDeletionError("INVALID_DELETION_TOKEN", 403, "Invalid deletion token");
      const userResult = await client.query(`SELECT * FROM users WHERE id=$1 FOR UPDATE`, [userId]);
      const user = userResult.rows[0];
      if (!user) throw new AccountDeletionError("ACCOUNT_NOT_FOUND", 404, "Account not found");
      const privileged = await client.query(`SELECT EXISTS(SELECT 1 FROM creators WHERE user_id=$1) OR EXISTS(SELECT 1 FROM institute_members WHERE user_id=$1 AND status='active') AS blocked`, [userId]);
      if (user.is_admin || privileged.rows[0].blocked) throw new AccountDeletionError("LEARNER_ACCOUNT_REQUIRED", 409, "Creator, institute, and administrator accounts require an administered offboarding process");
      await client.query(`UPDATE account_deletion_requests SET state='verified', verified_at=$2, token_used_at=$2 WHERE id=$1`, [request.id, now]);
      const artifacts = await this.eraseAndDeidentify(client, userId, user.email, user.resume);
      const audit = await client.query(`INSERT INTO account_deletion_audits (request_id,subject_reference,actor_type,policy_version,erased,retained,counts,occurred_at) VALUES ($1,$2,'learner_self',$3,$4,$5,$6,$7) RETURNING id`, [request.id, crypto.createHash("sha256").update(`deleted:${userId}`).digest("hex"), DELETION_POLICY_VERSION, ACCOUNT_DELETION_CLASSIFICATION.erase, ACCOUNT_DELETION_CLASSIFICATION.retainDeidentified, artifacts.counts, now]);
      const completed = await client.query(`UPDATE account_deletion_requests SET state='completed', completed_at=$2, verification_token_hash=NULL, token_expires_at=NULL, completion_audit_id=$3 WHERE id=$1 RETURNING *`, [request.id, now, audit.rows[0].id]);
      await client.query("COMMIT");
      return { request: requestRow(completed.rows[0]), alreadyCompleted: false, artifacts: artifacts.references };
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
  }
  private async eraseAndDeidentify(client: PoolClient, userId: number, originalEmail: string, resume: string | null) {
    const markerEmail = deletedEmail(userId); const counts: Record<string, number> = {}; const references: string[] = resume ? [resume] : [];
    const run = async (key: string, query: string, params: unknown[] = [userId]) => { const result = await client.query(query, params); counts[key] = rowCount(result); };
    await run("certificate_deidentified", `UPDATE certificates SET user_email=$2,user_name=$3,shipping_address_id=NULL,needs_physical_copy=false,tracking_number=NULL WHERE user_id=$1`, [userId, markerEmail, DELETED_ACCOUNT_NAME]);
    await run("attempt_deidentified", `UPDATE exam_attempts SET user_email=$2,user_name=$3,ip_address=NULL,user_agent=NULL WHERE user_id=$1`, [userId, markerEmail, DELETED_ACCOUNT_NAME]);
    await run("scheduled_attempt_deidentified", `UPDATE exam_instance_attempts SET email=$2 WHERE user_id=$1`, [userId, markerEmail]);
    await run("leaderboard_deidentified", `UPDATE leaderboard SET user_email=$2,user_name=$3,business_name=NULL WHERE user_id=$1`, [userId, markerEmail, DELETED_ACCOUNT_NAME]);
    await run("coupon_deidentified", `UPDATE coupon_redemptions SET user_email=$2 WHERE user_id=$1`, [userId, markerEmail]);
    await run("voucher_deidentified", `UPDATE certification_vouchers SET assigned_email=NULL WHERE assigned_user_id=$1 OR redeemed_by=$1`);
    await run("cohort_deidentified", `UPDATE cohort_students SET email=$2,name=$3,roll_number=NULL WHERE user_id=$1`, [userId, markerEmail, DELETED_ACCOUNT_NAME]);
    await run("audit_deidentified", `UPDATE audit_logs SET actor_email=NULL,ip=NULL,user_agent=NULL,metadata='{"redacted":"account_deleted"}'::jsonb WHERE user_id=$1`);
    await run("evidence_revoked", `UPDATE candidate_evidence_grants SET revoked_at=COALESCE(revoked_at,now()),revocation_reason=COALESCE(revocation_reason,'learner account deleted'),version=CASE WHEN revoked_at IS NULL THEN version+1 ELSE version END WHERE learner_user_id=$1 AND revoked_at IS NULL`);
    await run("share_grants_deleted", `DELETE FROM interview_studio_sessions WHERE user_id=$1`);
    for (const [key, table] of Object.entries({ addresses:"user_addresses", preferences:"user_preferences", notifications:"notifications", recommendations:"course_recommendations", activity:"user_activity", learning_paths:"user_learning_paths", skill_assessments:"skill_assessments", progress:"user_course_progress", achievements:"user_achievements", lesson_progress:"lesson_progress", course_reviews:"course_reviews", ratings:"ratings", entitlements:"course_entitlements", password_tokens:"password_reset_tokens", media_assets:"media_assets", interviews:"interviews" })) await run(`${key}_erased`, `DELETE FROM ${table} WHERE user_id=$1`);
    await run("profile_erased", `UPDATE users SET email=$2,password=NULL,name=$3,phone=NULL,company=NULL,position=NULL,google_id=NULL,is_google_user=false,location=NULL,experience=NULL,current_role=NULL,skills=NULL,availability=NULL,notice_period=NULL,expected_salary=NULL,work_type=NULL,category=NULL,linkedin_profile=NULL,portfolio_url=NULL,resume_url=NULL,bio=NULL,career_goals=NULL,profile_visibility=false,evidence_passport_public=false,profile_completeness=0,account_deleted_at=now(),updated_at=now() WHERE id=$1`, [userId, markerEmail, DELETED_ACCOUNT_NAME]);
    return { references, counts };
  }
}

export class LocalArtifactCleaner implements ArtifactCleaner {
  async stage(references: string[]): Promise<StagedCleanup> {
    const staged: Array<{ original: string; quarantine: string }> = [];
    for (const reference of references) {
      if (!reference.startsWith("/api/uploads/resumes/")) throw new AccountDeletionError("ARTEFACT_CLEANUP_UNSUPPORTED", 409, "An account artefact requires support-assisted secure deletion");
      const filename = path.basename(reference); if (!/^resume-\d+-/.test(filename)) throw new AccountDeletionError("ARTEFACT_REFERENCE_INVALID", 409, "Stored resume reference is invalid");
      const original = path.join(process.cwd(), "uploads", "resumes", filename); const quarantine = `${original}.deleting-${crypto.randomUUID()}`;
      try { await fs.rename(original, quarantine); staged.push({ original, quarantine }); } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    return { commit: async () => { for (const item of staged) await fs.unlink(item.quarantine); }, rollback: async () => { for (const item of staged.reverse()) await fs.rename(item.quarantine, item.original).catch(() => undefined); } };
  }
}
