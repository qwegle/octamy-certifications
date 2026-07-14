import { describe, expect, it } from "@jest/globals";
import {
  buildExamInviteLink,
  createExamInviteToken,
  escapeExamInviteHtml,
  hashExamInviteToken,
  instituteInviteExpiry,
  isInstituteSubscriptionActive,
  isValidExamInviteToken,
  normalizeExamInviteEmail,
} from "../../server/lib/institute-exam-delivery";

describe("institute-sponsored private exam delivery", () => {
  it("normalizes recipient identity and creates non-persistable high-entropy tokens", () => {
    const first = createExamInviteToken();
    const second = createExamInviteToken();

    expect(normalizeExamInviteEmail("  Learner@Example.COM ")).toBe("learner@example.com");
    expect(isValidExamInviteToken(first.rawToken)).toBe(true);
    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.tokenHash).toBe(hashExamInviteToken(first.rawToken));
    expect(first.tokenHash).not.toContain(first.rawToken);
  });

  it("rejects malformed invitation tokens before hashing", () => {
    expect(isValidExamInviteToken("short-token")).toBe(false);
    expect(() => hashExamInviteToken("short-token")).toThrow("Invalid exam invitation token");
  });

  it("puts the bearer credential in a URL fragment so servers and access logs never receive it", () => {
    const token = createExamInviteToken();
    const link = buildExamInviteLink("https://octamy.example/", "exam123", token.rawToken, " Learner@Example.com ");
    const parsed = new URL(link);

    expect(parsed.pathname).toBe("/x/exam123");
    expect(parsed.search).toBe("");
    expect(parsed.hash).toContain(`invite=${token.rawToken}`);
    expect(parsed.hash).toContain("email=learner%40example.com");
  });

  it("requires an active, started and unexpired paid-subscription window", () => {
    const now = Date.parse("2026-07-14T12:00:00.000Z");
    const active = {
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      renewsAt: "2026-08-01T00:00:00.000Z",
    };
    expect(isInstituteSubscriptionActive(active, now)).toBe(true);
    expect(isInstituteSubscriptionActive({ ...active, status: "pending" }, now)).toBe(false);
    expect(isInstituteSubscriptionActive({ ...active, startsAt: "2026-07-15T00:00:00.000Z" }, now)).toBe(false);
    expect(isInstituteSubscriptionActive({ ...active, renewsAt: "2026-07-14T12:00:00.000Z" }, now)).toBe(false);
    expect(isInstituteSubscriptionActive({ ...active, renewsAt: null }, now)).toBe(false);
  });

  it("expires an invitation at the earlier exam or subscription boundary", () => {
    expect(instituteInviteExpiry("2026-08-01T00:00:00.000Z", "2026-07-20T00:00:00.000Z").toISOString())
      .toBe("2026-07-20T00:00:00.000Z");
    expect(instituteInviteExpiry("2026-08-01T00:00:00.000Z", null).toISOString())
      .toBe("2026-08-01T00:00:00.000Z");
  });

  it("escapes institute-controlled text before email rendering", () => {
    expect(escapeExamInviteHtml(`<Exam & "attempt">`)).toBe("&lt;Exam &amp; &quot;attempt&quot;&gt;");
  });
});
