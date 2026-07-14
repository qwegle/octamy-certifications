import { describe, expect, it } from "@jest/globals";
import {
  buildInhouseBlueprint,
  INHOUSE_ASSESSMENTS,
  validateInhouseAssessmentCatalog,
} from "../../server/content/inhouse-assessment-catalog";
import { ORIGINAL_QUESTION_TEMPLATES } from "../../server/content/original-question-factory";

describe("in-house assessment catalogue", () => {
  it("covers every deterministic generator assessment with one canonical shell", () => {
    const generatorSlugs = new Set(
      ORIGINAL_QUESTION_TEMPLATES.flatMap((template) => template.assessmentSlugs),
    );
    const catalogueSlugs = new Set(INHOUSE_ASSESSMENTS.map((assessment) => assessment.slug));

    expect(INHOUSE_ASSESSMENTS).toHaveLength(25);
    expect(catalogueSlugs).toEqual(generatorSlugs);
    expect(validateInhouseAssessmentCatalog()).toEqual([]);
  });

  it("uses non-overlapping school audience bands", () => {
    const school = INHOUSE_ASSESSMENTS.filter((assessment) =>
      assessment.secondaryCategorySlugs.includes("school-education"),
    );
    expect(new Set(school.map((assessment) => assessment.audienceBandCode))).toEqual(new Set([
      "grade_1_2",
      "grade_3_5",
      "grade_6_8",
      "grade_9_10",
      "grade_11_12",
    ]));
    expect(school.some((assessment) => assessment.audienceBandCode === "grade_1_5")).toBe(false);
    expect(school.some((assessment) => assessment.audienceBandCode === "grade_6_10")).toBe(false);
  });

  it("keeps early-primary shells empty and produces exact draft blueprint totals elsewhere", () => {
    for (const assessment of INHOUSE_ASSESSMENTS) {
      const blueprint = buildInhouseBlueprint(assessment);
      expect(blueprint.reduce((sum, item) => sum + item.questionCount, 0))
        .toBe(assessment.targetQuestionCount);
      if (assessment.slug.startsWith("grade-1-") || assessment.slug.startsWith("grade-2-")) {
        expect(blueprint).toEqual([]);
      }
      expect(assessment.releaseBlockers.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not create a generic RI shell without a state and recruiting authority", () => {
    expect(INHOUSE_ASSESSMENTS.some((assessment) => /(^|-)ri(-|$)/.test(assessment.slug))).toBe(false);
  });
});
