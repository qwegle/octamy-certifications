import { describe, expect, it, jest } from "@jest/globals";
import {
  DEFAULT_INTERVIEW_AI_MODEL,
  INTERVIEW_AI_PROMPT_VERSION,
  InterviewAiError,
  evaluateInterviewStructuredResponse,
  getInterviewAiReadiness,
  type InterviewAiClient,
} from "../../server/lib/interview-ai";
import {
  INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  type InterviewStudioBlueprint,
} from "../../shared/interview-studio";

const item = {
  key: "response.incident",
  title: "Production incident",
  competency: "Incident response",
  timeLimitSeconds: 600,
  instructions: "Give a concise, evidence-based answer using the supplied scenario.",
  kind: "structured_response" as const,
  prompt: "A deployment increased errors. Explain how you would investigate and respond.",
  responseFormat: "text_or_transient_voice" as const,
  minimumWords: 20,
  maximumWords: 600,
  rubric: [{
    key: "diagnosis",
    label: "Diagnosis",
    description: "Uses evidence and a controlled process to isolate the cause.",
    weight: 70,
  }, {
    key: "communication",
    label: "Communication",
    description: "Communicates impact, actions, and status to stakeholders.",
    weight: 30,
  }],
};

const blueprint: InterviewStudioBlueprint = {
  schemaVersion: INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  templateKey: "sre.interview",
  version: 1,
  title: "Site reliability evidence interview",
  summary: "A role-based interview that gathers concrete incident-response evidence.",
  role: "Site reliability engineer",
  level: "intermediate",
  skills: ["Incident response"],
  allowedModes: ["practice", "verified"],
  estimatedDurationMinutes: 20,
  rubricVersion: "sre-rubric.v1",
  items: [item],
};

const feedback = {
  criterionScores: [{
    criterionKey: "diagnosis",
    score: 80,
    evidence: "The response proposes comparing error rates and rolling back while isolating the change.",
  }, {
    criterionKey: "communication",
    score: 60,
    evidence: "The response mentions an incident update, but gives no communication cadence.",
  }],
  strengths: ["Uses reversible mitigation before deeper diagnosis."],
  improvementAreas: ["Define a stakeholder update cadence."],
  followUpQuestions: ["What signal would make you roll forward instead?"],
  humanReviewRequired: false,
  humanReviewReasons: [],
};

describe("Interview Studio AI evidence evaluation", () => {
  it("reports unavailable without leaking configuration details", () => {
    expect(getInterviewAiReadiness({})).toEqual({
      enabled: false,
      status: "unavailable",
      reason: "missing_api_key",
    });
    expect(getInterviewAiReadiness({ OPENAI_API_KEY: "sk-proj-abcdefghijklmnopqrstuvwxyz" }))
      .toEqual({ enabled: true, status: "ready", model: DEFAULT_INTERVIEW_AI_MODEL });
  });

  it("uses non-retained structured output and computes the weighted score server-side", async () => {
    const parse = jest.fn<InterviewAiClient["responses"]["parse"]>(async () => ({ output_parsed: feedback }));
    const result = await evaluateInterviewStructuredResponse({
      blueprint,
      item,
      responseText: "I would compare error telemetry, stop the rollout, roll back, isolate the change, and post an incident update.",
      client: { responses: { parse } },
      env: {},
      now: () => new Date("2026-07-16T10:00:00.000Z"),
    });

    expect(result).toEqual(expect.objectContaining({
      status: "completed",
      score: 74,
      rubricVersion: "sre-rubric.v1",
      model: DEFAULT_INTERVIEW_AI_MODEL,
      promptVersion: INTERVIEW_AI_PROMPT_VERSION,
      evaluatedAt: "2026-07-16T10:00:00.000Z",
    }));
    const [request, options] = parse.mock.calls[0];
    expect(request).toEqual(expect.objectContaining({
      model: DEFAULT_INTERVIEW_AI_MODEL,
      store: false,
      max_output_tokens: 4_000,
      text: { format: expect.objectContaining({ type: "json_schema", strict: true }) },
    }));
    expect(options).toEqual({ timeout: 45_000 });
    const instructions = String((request as { instructions?: unknown }).instructions);
    expect(instructions).toMatch(/Do not make a hiring/i);
    expect(instructions).toMatch(/face, gaze, emotion, voice, accent/i);
  });

  it("requires exact rubric coverage and rejects extra decision fields", async () => {
    const mismatchClient: InterviewAiClient = {
      responses: { parse: async () => ({
        output_parsed: {
          ...feedback,
          criterionScores: [feedback.criterionScores[0]],
        },
      }) },
    };
    await expect(evaluateInterviewStructuredResponse({
      blueprint,
      item,
      responseText: "I would inspect telemetry and roll back safely.",
      client: mismatchClient,
      env: {},
    })).rejects.toMatchObject({ code: "INTERVIEW_AI_FAILED", status: 502 });

    const unsafeClient: InterviewAiClient = {
      responses: { parse: async () => ({
        output_parsed: { ...feedback, hiringDecision: "hire" },
      }) },
    };
    await expect(evaluateInterviewStructuredResponse({
      blueprint,
      item,
      responseText: "I would inspect telemetry and roll back safely.",
      client: unsafeClient,
      env: {},
    })).rejects.toMatchObject({ code: "INTERVIEW_AI_FAILED", status: 502 });

    const decisionLanguageClient: InterviewAiClient = {
      responses: { parse: async () => ({
        output_parsed: { ...feedback, strengths: ["Strong hire for this role."] },
      }) },
    };
    await expect(evaluateInterviewStructuredResponse({
      blueprint,
      item,
      responseText: "I would inspect telemetry and roll back safely.",
      client: decisionLanguageClient,
      env: {},
    })).rejects.toMatchObject({ code: "INTERVIEW_AI_FAILED", status: 502 });
  });

  it("returns an actionable unavailable error when no provider is configured", async () => {
    await expect(evaluateInterviewStructuredResponse({
      blueprint,
      item,
      responseText: "I would inspect telemetry and roll back safely.",
      env: {},
    })).rejects.toEqual(expect.objectContaining({
      name: "InterviewAiError",
      code: "INTERVIEW_AI_UNAVAILABLE",
      status: 503,
      category: "service_not_configured",
    }));
  });

  it("maps provider capacity failures without exposing provider internals", async () => {
    const client: InterviewAiClient = {
      responses: { parse: async () => {
        throw Object.assign(new Error("provider-secret-detail"), { status: 429 });
      } },
    };
    try {
      await evaluateInterviewStructuredResponse({
        blueprint,
        item,
        responseText: "I would inspect telemetry and roll back safely.",
        client,
        env: {},
      });
      throw new Error("expected evaluation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(InterviewAiError);
      expect(error).toEqual(expect.objectContaining({
        code: "INTERVIEW_AI_UNAVAILABLE",
        status: 503,
        category: "provider_unavailable",
      }));
      expect((error as Error).message).not.toContain("provider-secret-detail");
    }
  });
});
