import { describe, expect, it } from "@jest/globals";
import {
  buildAssessmentCatalogQuery,
  parseAssessmentCatalogQuery,
} from "../../client/src/lib/assessment-catalog-query";
import { resyncAuthoritativeExamTimer } from "../../client/src/lib/exam-timer";
import { requiredInstituteRole } from "../../client/src/lib/institute-route-policy";
import { safeInternalReturnTo } from "../../client/src/lib/navigation-safety";

describe("authoritative assessment timer", () => {
  it("anchors the local countdown only to server remaining seconds", () => {
    expect(resyncAuthoritativeExamTimer(91.8, 1_000)).toEqual({
      remainingSeconds: 91,
      deadlineMs: 92_000,
    });
    expect(resyncAuthoritativeExamTimer(-4, 5_000)).toEqual({
      remainingSeconds: 0,
      deadlineMs: 5_000,
    });
    expect(resyncAuthoritativeExamTimer(Number.NaN)).toBeNull();
    expect(resyncAuthoritativeExamTimer("90")).toBeNull();
  });
});

describe("safe post-auth navigation", () => {
  it("keeps internal paths with their query and fragment", () => {
    expect(safeInternalReturnTo("/learn/data-literacy?tab=notes#week-2"))
      .toBe("/learn/data-literacy?tab=notes#week-2");
  });

  it.each([
    "https://attacker.example/phish",
    "//attacker.example/phish",
    "/\\attacker.example/phish",
    "javascript:alert(1)",
    "/login?next=/dashboard",
    "/api/auth/google/user",
  ])("rejects unsafe or looping destination %s", (value) => {
    expect(safeInternalReturnTo(value)).toBeNull();
  });
});

describe("assessment catalogue URL state", () => {
  it("reads and round-trips every supported filter", () => {
    const filters = parseAssessmentCatalogQuery(
      "?q=algebra&category=school-math&audience=grades_5_10&level=intermediate&page=3",
    );
    expect(filters).toEqual({
      q: "algebra",
      category: "school-math",
      audience: "grades_5_10",
      level: "intermediate",
      page: 3,
    });
    expect(buildAssessmentCatalogQuery(filters)).toBe(
      "?q=algebra&category=school-math&audience=grades_5_10&level=intermediate&page=3",
    );
  });

  it("falls back safely for invalid filters and pages", () => {
    expect(parseAssessmentCatalogQuery("?category=%2Fbad&audience=x%20y&level=owner&page=-1"))
      .toEqual({ q: "", category: "all", audience: "all", level: "all", page: 1 });
  });
});

describe("institute workspace route policy", () => {
  it("lets staff open the overview while authoring remains teacher-only", () => {
    expect(requiredInstituteRole("/institute/dashboard")).toBeNull();
    expect(requiredInstituteRole("/institute/dashboard/")).toBeNull();
    expect(requiredInstituteRole("/institute/exams")).toBe("teacher");
    expect(requiredInstituteRole("/institute/settings")).toBe("admin");
    expect(requiredInstituteRole("/institute/settings/security")).toBe("admin");
  });
});
