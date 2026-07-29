import { describe, expect, it, jest } from "@jest/globals";
import {
  ACCOUNT_DELETION_CLASSIFICATION,
  AccountDeletionError,
  AccountDeletionService,
  DELETED_ACCOUNT_NAME,
  assertDeletionOwnership,
  deletedEmail,
  hashDeletionToken,
  tokenIsUsable,
  type AccountDeletionStore,
  type DeletionRequest,
} from "../../server/lib/account-deletion";

class FakeStore implements AccountDeletionStore {
  request: DeletionRequest | null = null;
  tokenHash = "";
  completionMutations = 0;
  personal = {
    users: { email: "learner@example.com", name: "Learner Name", phone: "+91-9999999999", resume: "/api/uploads/resumes/resume-7-a.pdf", password: "hash" as string | null },
    certificates: [{ userEmail: "learner@example.com", userName: "Learner Name", certificateId: "CERT-1" }],
    attempts: [{ userEmail: "learner@example.com", userName: "Learner Name", score: 88, ipAddress: "192.0.2.1" as string | null }],
    payments: [{ transactionId: "txn-1", amount: "499.00" }],
    addresses: [{ line: "Personal address" }],
  };
  async current(userId: number) { return this.request?.userId === userId ? this.request : null; }
  async artifacts(userId: number) { return this.request?.userId === userId && this.personal.users.resume ? [this.personal.users.resume] : []; }
  async create(userId: number, tokenHash: string, expiresAt: Date) {
    this.tokenHash = tokenHash;
    this.request = { id: "request-1", userId, state: "requested", tokenExpiresAt: expiresAt, requestedAt: new Date("2026-07-29T12:00:00Z"), verifiedAt: null, completedAt: null, cancelledAt: null, rejectedAt: null };
    return this.request;
  }
  async reject(_id: string, _reason: string) { if (this.request) this.request = { ...this.request, state: "rejected", rejectedAt: new Date(), tokenExpiresAt: null }; }
  async cancel(userId: number) { assertDeletionOwnership(userId, this.request!.userId); this.request = { ...this.request!, state: "cancelled", cancelledAt: new Date(), tokenExpiresAt: null }; return this.request; }
  async complete(userId: number, tokenHash: string, now: Date) {
    if (!this.request) throw new AccountDeletionError("DELETION_REQUEST_NOT_FOUND", 404, "missing");
    assertDeletionOwnership(userId, this.request.userId);
    if (this.request.state === "completed") return { request: this.request, alreadyCompleted: true, artifacts: [] };
    if (!tokenIsUsable({ state: this.request.state, expiresAt: this.request.tokenExpiresAt }, now)) throw new AccountDeletionError("DELETION_TOKEN_EXPIRED_OR_USED", 410, "expired");
    if (tokenHash !== this.tokenHash) throw new AccountDeletionError("INVALID_DELETION_TOKEN", 403, "invalid");
    this.completionMutations += 1;
    this.personal.users = { email: deletedEmail(userId), name: DELETED_ACCOUNT_NAME, phone: "", resume: "", password: null };
    this.personal.certificates = this.personal.certificates.map((row) => ({ ...row, userEmail: deletedEmail(userId), userName: DELETED_ACCOUNT_NAME }));
    this.personal.attempts = this.personal.attempts.map((row) => ({ ...row, userEmail: deletedEmail(userId), userName: DELETED_ACCOUNT_NAME, ipAddress: null }));
    this.personal.addresses = [];
    this.request = { ...this.request, state: "completed", verifiedAt: now, completedAt: now, tokenExpiresAt: null };
    return { request: this.request, alreadyCompleted: false, artifacts: [] };
  }
}

function fixture(now = new Date("2026-07-29T12:00:00Z")) {
  const store = new FakeStore(); let deliveredToken = "";
  const mailer = { send: jest.fn(async ({ token }: { token: string }) => { deliveredToken = token; return true; }) };
  const cleanup = { commit: jest.fn(async () => undefined), rollback: jest.fn(async () => undefined) };
  const cleaner = { stage: jest.fn(async () => cleanup) };
  const service = new AccountDeletionService(store, mailer, cleaner, () => now);
  return { store, service, cleaner, cleanup, token: () => deliveredToken };
}

describe("learner account deletion", () => {
  it("enforces exact session ownership", () => {
    expect(() => assertDeletionOwnership(7, 8)).toThrow(AccountDeletionError);
    expect(() => assertDeletionOwnership(7, 7)).not.toThrow();
  });

  it("rejects expired tokens and marks a valid token consumed", async () => {
    const expired = fixture(new Date("2026-07-29T13:00:00Z"));
    expired.store.request = { id: "r", userId: 7, state: "requested", tokenExpiresAt: new Date("2026-07-29T12:30:00Z"), requestedAt: new Date(), verifiedAt: null, completedAt: null, cancelledAt: null, rejectedAt: null };
    expired.store.tokenHash = hashDeletionToken("valid-token-value-that-is-long");
    await expect(expired.service.confirm(7, "valid-token-value-that-is-long")).rejects.toMatchObject({ code: "DELETION_TOKEN_EXPIRED_OR_USED" });

    const valid = fixture(); await valid.service.request({ userId: 7, email: "learner@example.com" });
    await valid.service.confirm(7, valid.token());
    expect(valid.store.request?.state).toBe("completed");
    expect(valid.store.request?.tokenExpiresAt).toBeNull();
    expect(valid.store.completionMutations).toBe(1);
  });

  it("replays completed confirmation idempotently without deleting twice", async () => {
    const valid = fixture(); await valid.service.request({ userId: 7, email: "learner@example.com" });
    const first = await valid.service.confirm(7, valid.token());
    const retry = await valid.service.confirm(7, valid.token());
    expect(first.alreadyCompleted).toBe(false);
    expect(retry.alreadyCompleted).toBe(true);
    expect(valid.store.completionMutations).toBe(1);
  });

  it("publishes an explicit erase/retain classification", () => {
    expect(ACCOUNT_DELETION_CLASSIFICATION.erase).toEqual(expect.arrayContaining(["users.authentication_and_profile", "resume_files", "interview_responses_recordings_and_artifact_references"]));
    expect(ACCOUNT_DELETION_CLASSIFICATION.retainDeidentified).toEqual(expect.arrayContaining(["issued_credentials_and_public_verification", "payments_tax_and_coupon_records", "audit_and_recruiter_evidence_events", "assessment_attempts_and_aggregate_statistics"]));
  });

  it("leaves no classified personal identifier while retaining integrity records", async () => {
    const test = fixture(); await test.service.request({ userId: 7, email: "learner@example.com" });
    await test.service.confirm(7, test.token());
    const serialized = JSON.stringify({ users: test.store.personal.users, certificates: test.store.personal.certificates, attempts: test.store.personal.attempts, addresses: test.store.personal.addresses });
    expect(serialized).not.toContain("learner@example.com"); expect(serialized).not.toContain("Learner Name"); expect(serialized).not.toContain("+91-9999999999"); expect(serialized).not.toContain("Personal address"); expect(serialized).not.toContain("192.0.2.1"); expect(serialized).not.toContain("resume-7-a.pdf");
    expect(test.store.personal.certificates[0].certificateId).toBe("CERT-1");
    expect(test.store.personal.payments[0].transactionId).toBe("txn-1");
    expect(test.cleanup.commit).toHaveBeenCalledTimes(1);
  });
});
