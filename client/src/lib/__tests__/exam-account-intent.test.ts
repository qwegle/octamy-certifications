import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  examAccountGatePresentation,
  examAccountPath,
  examIntentPath,
  isExamAccountRequiredError,
} from "../exam-account-intent";

describe("exam account intent", () => {
  it("round-trips the exact assessment through registration and login", () => {
    const assessment = "/get-certified/typescript-application-development-skills?source=catalog#start";

    for (const mode of ["register", "login"] as const) {
      const authUrl = new URL(examAccountPath(mode, assessment), "https://octamy.test");
      expect(authUrl.pathname).toBe(`/${mode}`);
      expect(authUrl.searchParams.get("next")).toBe(assessment);
    }

    expect(examIntentPath("https://evil.example/exam")).toBe("/get-certified");
  });

  it("renders the friendly free-attempt gate for an unauthenticated learner", () => {
    const gate = examAccountGatePresentation({
      authenticated: false,
      assessmentPath: "/get-certified/api-design-microservices-skills",
    });

    expect(gate).toMatchObject({
      eyebrow: "Free attempt · account required",
      title: "Save your free exam attempt",
    });
    expect(gate?.description).toContain("exam attempt is free");
    expect(gate?.description).toContain("saves the attempt");
    expect(gate?.createAccountHref).toContain("/register?");
    expect(gate?.loginHref).toContain("/login?");
    expect(examAccountGatePresentation({ authenticated: true, assessmentPath: "/get-certified/api" })).toBeNull();

    const examPage = readFileSync("client/src/pages/exam.tsx", "utf8");
    expect(examPage).toContain("!user && !isPractice && gatePresentation && <ExamAccountGate");
  });

  it("recognizes stable and status-based account refusals", () => {
    expect(isExamAccountRequiredError({ status: 401 })).toBe(true);
    expect(isExamAccountRequiredError({ code: "ACCOUNT_REQUIRED" })).toBe(true);
    expect(isExamAccountRequiredError({ status: 403, code: "FORBIDDEN" })).toBe(false);
  });
});
