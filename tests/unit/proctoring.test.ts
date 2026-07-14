import { describe, expect, it } from "@jest/globals";
import {
  boundedClientTimestamp,
  canCollectEvidenceEvent,
  createAttemptAccessToken,
  verifyAttemptAccessToken,
} from "../../server/lib/exam-proctoring";

describe("exam attempt access tokens", () => {
  const secret = "unit-test-secret";
  const now = Date.parse("2026-07-14T10:00:00.000Z");

  it("accepts a signed, unexpired token only for its attempt", () => {
    const token = createAttemptAccessToken(42, now + 60_000, secret);
    expect(verifyAttemptAccessToken(token, 42, secret, now)).toBe(true);
    expect(verifyAttemptAccessToken(token, 43, secret, now)).toBe(false);
  });

  it("rejects expired and tampered tokens", () => {
    const expired = createAttemptAccessToken(42, now - 1, secret);
    const valid = createAttemptAccessToken(42, now + 60_000, secret);
    expect(verifyAttemptAccessToken(expired, 42, secret, now)).toBe(false);
    expect(verifyAttemptAccessToken(`${valid.slice(0, -1)}x`, 42, secret, now)).toBe(false);
  });
});

describe("proportionate browser evidence policy", () => {
  it("keeps browser-monitoring signals out of standard exams", () => {
    expect(canCollectEvidenceEvent("standard", "network_offline")).toBe(true);
    expect(canCollectEvidenceEvent("standard", "fullscreen_exit")).toBe(false);
    expect(canCollectEvidenceEvent("standard", "paste")).toBe(false);
  });

  it("allows disclosed browser evidence signals in browser-evidence mode", () => {
    expect(canCollectEvidenceEvent("browser_evidence", "visibility_hidden")).toBe(true);
    expect(canCollectEvidenceEvent("browser_evidence", "fullscreen_exit")).toBe(true);
  });

  it("drops client timestamps outside the bounded clock-skew window", () => {
    const serverNow = new Date("2026-07-14T10:00:00.000Z");
    expect(boundedClientTimestamp("2026-07-14T09:59:30.000Z", serverNow)?.toISOString()).toBe("2026-07-14T09:59:30.000Z");
    expect(boundedClientTimestamp("2026-07-12T10:00:00.000Z", serverNow)).toBeNull();
    expect(boundedClientTimestamp("not-a-date", serverNow)).toBeNull();
  });
});
