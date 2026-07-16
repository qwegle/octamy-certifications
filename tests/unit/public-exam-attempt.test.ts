import { describe, expect, it } from "@jest/globals";
import {
  publicExamDeadline,
  publicExamSubmissionTiming,
} from "../../server/lib/public-exam-attempt";

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
