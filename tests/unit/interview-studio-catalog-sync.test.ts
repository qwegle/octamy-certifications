import { createHash } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import { FRONTEND_ENGINEER_FOUNDATIONS_V2 } from "../../server/content/interview-studio-catalog";
import {
  interviewStudioBlueprintHash,
  planInterviewStudioCatalog,
  type ExistingInterviewStudioTemplate,
} from "../../scripts/sync-interview-studio-catalog";
import {
  canonicalizeInterviewStudioBlueprint,
  interviewStudioBlueprintSchema,
  type InterviewStudioBlueprint,
} from "../../shared/interview-studio";

function rowForBlueprint(
  blueprint: InterviewStudioBlueprint,
  overrides: Partial<ExistingInterviewStudioTemplate> = {},
): ExistingInterviewStudioTemplate {
  return {
    id: blueprint.version,
    templateKey: blueprint.templateKey,
    version: blueprint.version,
    ownerType: "admin",
    ownerId: null,
    title: blueprint.title,
    summary: blueprint.summary,
    state: "published",
    isCurrent: false,
    supportedModes: [...blueprint.allowedModes],
    rubricVersion: blueprint.rubricVersion,
    blueprint,
    blueprintHash: interviewStudioBlueprintHash(blueprint),
    publishedAt: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

function earlierVersion(): InterviewStudioBlueprint {
  return interviewStudioBlueprintSchema.parse({
    ...FRONTEND_ENGINEER_FOUNDATIONS_V2,
    version: 1,
    rubricVersion: "frontend-engineer-intermediate-rubric-v1",
  });
}

describe("Interview Studio catalog synchronization planning", () => {
  it("hashes the exact canonical runtime representation", () => {
    const expected = createHash("sha256")
      .update(canonicalizeInterviewStudioBlueprint(FRONTEND_ENGINEER_FOUNDATIONS_V2), "utf8")
      .digest("hex");

    expect(interviewStudioBlueprintHash(FRONTEND_ENGINEER_FOUNDATIONS_V2)).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("plans a missing catalog version and hands off from the prior current version", () => {
    const old = earlierVersion();
    const plan = planInterviewStudioCatalog(
      [FRONTEND_ENGINEER_FOUNDATIONS_V2],
      [rowForBlueprint(old, { isCurrent: true })],
    );

    expect(plan).toEqual({
      entries: [{
        templateKey: "frontend-engineer-foundations",
        version: 2,
        blueprintHash: interviewStudioBlueprintHash(FRONTEND_ENGINEER_FOUNDATIONS_V2),
        action: "insert_and_activate",
        priorCurrentVersions: [1],
      }],
      insertions: 1,
      activations: 1,
      alreadyCurrent: 0,
    });
  });

  it("is idempotent when the exact catalog version is already current", () => {
    const plan = planInterviewStudioCatalog(
      [FRONTEND_ENGINEER_FOUNDATIONS_V2],
      [rowForBlueprint(FRONTEND_ENGINEER_FOUNDATIONS_V2, { isCurrent: true })],
    );

    expect(plan.entries[0]).toMatchObject({
      action: "already_current",
      priorCurrentVersions: [],
    });
    expect(plan).toMatchObject({ insertions: 0, activations: 0, alreadyCurrent: 1 });
  });

  it("activates an exact existing draft without rewriting its content", () => {
    const plan = planInterviewStudioCatalog(
      [FRONTEND_ENGINEER_FOUNDATIONS_V2],
      [rowForBlueprint(FRONTEND_ENGINEER_FOUNDATIONS_V2, {
        state: "draft",
        publishedAt: null,
      })],
    );

    expect(plan.entries[0]).toMatchObject({
      action: "activate_existing",
      priorCurrentVersions: [],
    });
    expect(plan).toMatchObject({ insertions: 0, activations: 1, alreadyCurrent: 0 });
  });

  it("refuses immutable-content conflicts and database versions newer than source", () => {
    expect(() => planInterviewStudioCatalog(
      [FRONTEND_ENGINEER_FOUNDATIONS_V2],
      [rowForBlueprint(FRONTEND_ENGINEER_FOUNDATIONS_V2, {
        title: "Different production title",
      })],
    )).toThrow("INTERVIEW_TEMPLATE_CONFLICT");

    const newer = interviewStudioBlueprintSchema.parse({
      ...FRONTEND_ENGINEER_FOUNDATIONS_V2,
      version: 3,
      rubricVersion: "frontend-engineer-intermediate-rubric-v3",
    });
    expect(() => planInterviewStudioCatalog(
      [FRONTEND_ENGINEER_FOUNDATIONS_V2],
      [rowForBlueprint(newer, { isCurrent: true })],
    )).toThrow("INTERVIEW_CATALOG_VERSION_BEHIND");
  });
});
