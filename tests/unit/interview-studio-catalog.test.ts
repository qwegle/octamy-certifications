import { describe, expect, it } from "@jest/globals";
import {
  FRONTEND_ENGINEER_FOUNDATIONS_V2,
  INTERVIEW_STUDIO_CATALOG,
} from "../../server/content/interview-studio-catalog";
import {
  interviewStudioBlueprintSchema,
  type InterviewStudioBlueprint,
} from "../../shared/interview-studio";

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function codingItems(blueprint: InterviewStudioBlueprint) {
  return blueprint.items.filter((item) => item.kind === "coding");
}

describe("Interview Studio source catalog", () => {
  it("contains the schema-valid Frontend Engineer v2 blueprint", () => {
    expect(INTERVIEW_STUDIO_CATALOG).toHaveLength(1);
    expect(FRONTEND_ENGINEER_FOUNDATIONS_V2).toMatchObject({
      templateKey: "frontend-engineer-foundations",
      version: 2,
      role: "Frontend Engineer",
      level: "intermediate",
    });

    for (const blueprint of INTERVIEW_STUDIO_CATALOG) {
      expect(interviewStudioBlueprintSchema.safeParse(blueprint).success).toBe(true);
    }
  });

  it("uses unique template, item, rubric, and test-case keys", () => {
    expect(duplicateValues(
      INTERVIEW_STUDIO_CATALOG.map((blueprint) => `${blueprint.templateKey}@${blueprint.version}`),
    )).toEqual([]);

    for (const blueprint of INTERVIEW_STUDIO_CATALOG) {
      expect(duplicateValues(blueprint.items.map((item) => item.key))).toEqual([]);
      for (const item of blueprint.items) {
        expect(duplicateValues(item.rubric.map((criterion) => criterion.key))).toEqual([]);
        if (item.kind === "coding") {
          expect(duplicateValues(item.testCases.map((testCase) => testCase.key))).toEqual([]);
        }
      }
    }
  });

  it("allocates exactly 100 points to every rubric and coding test suite", () => {
    for (const blueprint of INTERVIEW_STUDIO_CATALOG) {
      for (const item of blueprint.items) {
        expect(item.rubric.reduce((total, criterion) => total + criterion.weight, 0))
          .toBe(100);
        if (item.kind === "coding") {
          expect(item.testCases.reduce((total, testCase) => total + testCase.weight, 0))
            .toBe(100);
        }
      }
    }
  });

  it("fits the declared duration and assigns every declared skill to an item", () => {
    for (const blueprint of INTERVIEW_STUDIO_CATALOG) {
      const allocatedSeconds = blueprint.items.reduce(
        (total, item) => total + item.timeLimitSeconds,
        0,
      );
      expect(allocatedSeconds).toBeLessThanOrEqual(blueprint.estimatedDurationMinutes * 60);
      expect(allocatedSeconds).toBeGreaterThanOrEqual(blueprint.estimatedDurationMinutes * 60 * 0.8);

      expect(new Set(blueprint.items.map((item) => item.competency)))
        .toEqual(new Set(blueprint.skills));
    }
  });

  it("keeps public examples and protected hidden cases in every coding task", () => {
    for (const blueprint of INTERVIEW_STUDIO_CATALOG) {
      expect(codingItems(blueprint).length).toBeGreaterThan(0);
      for (const item of codingItems(blueprint)) {
        expect(item.testCases.some((testCase) => testCase.visibility === "public")).toBe(true);
        expect(item.testCases.some((testCase) => testCase.visibility === "hidden")).toBe(true);
      }
    }
  });
});
