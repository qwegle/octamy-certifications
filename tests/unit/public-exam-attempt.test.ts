import { describe, expect, it } from "@jest/globals";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CERTIFICATION_ACCOUNT_REQUIRED_CODE,
  certificationExamAccountRequirement,
} from "../../server/lib/pending-exam-access";
import {
  publicExamDeadline,
  publicExamSubmissionTiming,
} from "../../server/lib/public-exam-attempt";

describe("public certification account gate", () => {
  it("refuses an unauthenticated certification start with the stable code", () => {
    expect(certificationExamAccountRequirement({
      assessmentPurpose: "certification",
      userId: null,
      action: "start",
    })).toEqual({
      statusCode: 401,
      body: {
        code: CERTIFICATION_ACCOUNT_REQUIRED_CODE,
        message: "Create an account or sign in before starting this certification exam.",
      },
    });
  });

  it("refuses an unauthenticated certification submission with the stable code", () => {
    expect(certificationExamAccountRequirement({
      assessmentPurpose: "certification",
      action: "submit",
    })).toEqual({
      statusCode: 401,
      body: {
        code: "ACCOUNT_REQUIRED",
        message: "Create an account or sign in before submitting this certification exam.",
      },
    });
  });

  it("allows an authenticated learner to continue into certification start", () => {
    expect(certificationExamAccountRequirement({
      assessmentPurpose: "certification",
      userId: 42,
      action: "start",
    })).toBeNull();
  });

  it("leaves practice authentication to the existing Practice Pass gates", () => {
    expect(certificationExamAccountRequirement({
      assessmentPurpose: "practice",
      userId: null,
      action: "start",
    })).toBeNull();
  });

  it("wires the account gate into start and submit before creating account-owned state", async () => {
    const source = await readFile(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const startRoute = source.slice(
      source.indexOf('app.post("/api/courses/:id/questions"'),
      source.indexOf("// EXAM SUBMISSION ENDPOINT"),
    );
    const submitRoute = source.slice(
      source.indexOf('"/api/exam/submit"'),
      source.indexOf("// Temporary exam results endpoint"),
    );

    expect(startRoute).toContain('action: "start"');
    expect(startRoute).toContain("userId: req.user!.userId");
    expect(submitRoute).toContain('action: "submit"');
    expect(submitRoute).toContain("userId: req.user!.userId");
    expect(submitRoute).not.toContain("parseGuestExamIdentity");
    expect(submitRoute).not.toContain("sendGuestExamRecoveryEmail");
  });
});

describe("public assessment authoritative timing", () => {
  const startedAt = "2026-07-16T10:00:00.000Z";

  it("derives its deadline and recorded duration from server time", () => {
    expect(publicExamDeadline(startedAt, 30).toISOString()).toBe("2026-07-16T10:30:00.000Z");
    expect(publicExamSubmissionTiming(
      startedAt,
      30,
      Date.parse("2026-07-16T10:12:34.900Z"),
    )).toMatchObject({ elapsedSeconds: 754, deadlineExceeded: false });
  });

  it("accepts the automatic submit grace window but rejects later payloads", () => {
    expect(publicExamSubmissionTiming(
      startedAt,
      30,
      Date.parse("2026-07-16T10:30:15.000Z"),
    ).deadlineExceeded).toBe(false);
    expect(publicExamSubmissionTiming(
      startedAt,
      30,
      Date.parse("2026-07-16T10:30:15.001Z"),
    ).deadlineExceeded).toBe(true);
  });

  it("never trusts a client duration beyond the configured exam duration", () => {
    const timing = publicExamSubmissionTiming(
      startedAt,
      30,
      Date.parse("2026-07-16T11:00:00.000Z"),
    );
    expect(timing.elapsedSeconds).toBe(1800);
    expect(timing.deadlineExceeded).toBe(true);
  });
});
