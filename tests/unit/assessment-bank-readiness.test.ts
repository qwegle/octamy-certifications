import { describe, expect, it } from "@jest/globals";
import { hasReadyQuestionInventory, requiredQuestionInventory } from "../../server/lib/assessment-bank-readiness";

describe("assessment bank readiness", () => {
  it("requires at least 80 and four rotations for certifications", () => {
    expect(requiredQuestionInventory("certification", 10)).toBe(80);
    expect(requiredQuestionInventory("certification", 30)).toBe(120);
    expect(hasReadyQuestionInventory("certification", 20, 79)).toBe(false);
    expect(hasReadyQuestionInventory("certification", 20, 80)).toBe(true);
  });

  it("requires at least 200 and five rotations for practice", () => {
    expect(requiredQuestionInventory("practice", 20)).toBe(200);
    expect(requiredQuestionInventory("practice", 50)).toBe(250);
    expect(hasReadyQuestionInventory("practice", 40, 199)).toBe(false);
    expect(hasReadyQuestionInventory("practice", 40, 200)).toBe(true);
  });
});
