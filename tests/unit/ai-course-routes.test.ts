import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  createAiCourseRouter,
  isAiCourseDraftEnabled,
  type AiCourseRouteDependencies,
} from "../../server/routes/aiCourseRoutes";

type CreateClient = NonNullable<AiCourseRouteDependencies["createClient"]>;
type CourseDraftClient = ReturnType<CreateClient>;
type ParseCourseDraft = CourseDraftClient["responses"]["parse"];
type AuditEvent = NonNullable<AiCourseRouteDependencies["auditEvent"]>;

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;

const validBrief = {
  workspace: "creator" as const,
  topic: "Practical data literacy",
  audience: "Early-career operations analysts",
  goal: "Use data to make and communicate defensible operational decisions",
  level: "novice" as const,
  productType: "video_course" as const,
  moduleCount: 3,
  language: "English",
  additionalContext: "Use examples from inventory and customer support.",
};

const validDraft = {
  title: "Practical Data Literacy for Operations",
  description: "A practical course for turning operational data into clear, defensible decisions.",
  level: "advanced" as const,
  productType: "assessment" as const,
  duration: 180,
  passingScore: 75,
  learningOutcomes: [
    "Interpret common operational metrics accurately",
    "Communicate a data-supported recommendation clearly",
  ],
  sections: [1, 2, 3].map((index) => ({
    title: `Module ${index}`,
    summary: `A focused module summary for stage ${index}.`,
    lessons: [{
      title: `Lesson ${index}`,
      kind: "video" as const,
      objective: `Apply the core skill from module ${index}.`,
      durationMinutes: 45,
      isPreview: index === 1,
    }],
  })),
  assessmentIdeas: [{
    title: "Operational recommendation case",
    type: "case_study" as const,
    difficulty: "medium" as const,
  }],
};

function authenticatedAs(userId = 42): RequestHandler {
  return (req, _res, next) => {
    req.user = { userId, email: `user-${userId}@example.com` };
    next();
  };
}

function appWith(overrides: Parameters<typeof createAiCourseRouter>[0] = {}) {
  const app = express();
  app.use(express.json());
  app.use(createAiCourseRouter({
    authenticate: authenticatedAs(),
    findCreator: async () => ({ id: 7 }),
    findInstitute: async () => ({ memberRole: "teacher" }),
    auditEvent: async () => undefined,
    rateLimitMax: 100,
    ...overrides,
  }));
  return app;
}

describe("AI course draft routes", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  });

  it("reports only whether a usable server-side key is configured", async () => {
    expect(isAiCourseDraftEnabled({ OPENAI_API_KEY: "your_openai_api_key" })).toBe(false);
    expect(isAiCourseDraftEnabled({ OPENAI_API_KEY: "sk-proj-abcdefghijklmnopqrstuvwxyz" })).toBe(true);

    const response = await request(appWith()).get("/ai/course-draft/status").expect(200);
    expect(response.body).toEqual({ enabled: false });
  });

  it("returns a professional disabled response without constructing a client", async () => {
    const createClient = jest.fn<CreateClient>(() => {
      throw new Error("The client must not be constructed while disabled");
    });
    const auditEvent = jest.fn<AuditEvent>(async () => undefined);

    const response = await request(appWith({ createClient, auditEvent }))
      .post("/ai/course-draft")
      .send(validBrief)
      .expect(503);

    expect(response.body.code).toBe("AI_COURSE_DRAFT_DISABLED");
    expect(response.body.message).not.toMatch(/api.?key/i);
    expect(createClient).not.toHaveBeenCalled();
    expect(auditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "ai.course_draft.generate",
      status: "failure",
      metadata: expect.objectContaining({ reason: "service_not_configured" }),
    }));
  });

  it("enforces the selected workspace before invoking the model", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const createClient = jest.fn<CreateClient>(() => {
      throw new Error("The client must not be constructed without workspace access");
    });

    await request(appWith({
      findCreator: async () => undefined,
      createClient,
    }))
      .post("/ai/course-draft")
      .send(validBrief)
      .expect(403);

    await request(appWith({
      findInstitute: async () => ({ memberRole: "staff" }),
      createClient,
    }))
      .post("/ai/course-draft")
      .send({ ...validBrief, workspace: "institute" })
      .expect(403);

    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses strict structured output, does not store the response, and validates the draft", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const parse = jest.fn<ParseCourseDraft>(async () => ({ output_parsed: validDraft }));
    const createClient = jest.fn<CreateClient>(() => ({ responses: { parse } }));
    const auditEvent = jest.fn<AuditEvent>(async () => undefined);

    const response = await request(appWith({
      createClient,
      auditEvent,
      now: () => new Date("2026-07-14T12:00:00.000Z"),
    }))
      .post("/ai/course-draft")
      .send(validBrief)
      .expect(200);

    expect(createClient).toHaveBeenCalledWith(process.env.OPENAI_API_KEY);
    expect(parse).toHaveBeenCalledTimes(1);
    const [modelRequest, requestOptions] = parse.mock.calls[0];
    expect(modelRequest).toEqual(expect.objectContaining({
      model: "gpt-5-mini",
      store: false,
      max_output_tokens: 8_000,
      text: {
        format: expect.objectContaining({
          type: "json_schema",
          name: "course_draft",
          strict: true,
        }),
      },
    }));
    expect(requestOptions).toEqual({ timeout: 45_000 });
    expect(response.body.draft.sections).toHaveLength(validBrief.moduleCount);
    expect(response.body.draft.level).toBe(validBrief.level);
    expect(response.body.draft.productType).toBe(validBrief.productType);
    expect(response.body.meta).toEqual({
      model: "gpt-5-mini",
      generatedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(JSON.stringify(response.body)).not.toContain(process.env.OPENAI_API_KEY);

    const successAudit = auditEvent.mock.calls.at(-1)?.[0];
    expect(successAudit).toEqual(expect.objectContaining({
      action: "ai.course_draft.generate",
      userId: 42,
      actorRole: "creator",
      metadata: {
        model: "gpt-5-mini",
        moduleCount: 3,
        productType: "video_course",
        language: "English",
      },
    }));
    expect(JSON.stringify(successAudit?.metadata)).not.toContain(validBrief.topic);
    expect(JSON.stringify(successAudit?.metadata)).not.toContain(validBrief.additionalContext);
  });

  it("rejects malformed model output instead of returning an unreliable draft", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const auditEvent = jest.fn<AuditEvent>(async () => undefined);

    const response = await request(appWith({
      createClient: () => ({
        responses: { parse: async () => ({ output_parsed: { title: "Incomplete" } }) },
      }),
      auditEvent,
    }))
      .post("/ai/course-draft")
      .send(validBrief)
      .expect(502);

    expect(response.body.code).toBe("AI_COURSE_DRAFT_FAILED");
    expect(auditEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "failure",
      metadata: expect.objectContaining({ reason: "generation_failed" }),
    }));
  });

  it("rejects oversized, incomplete, and unexpected request fields", async () => {
    const response = await request(appWith())
      .post("/ai/course-draft")
      .send({
        ...validBrief,
        topic: "x",
        moduleCount: 11,
        unexpected: "field",
      })
      .expect(400);

    expect(response.body.code).toBe("INVALID_COURSE_BRIEF");
    expect(response.body.errors.topic).toBeDefined();
    expect(response.body.errors.moduleCount).toBeDefined();
  });

  it("applies the generation quota independently per authenticated user", async () => {
    const authenticateByHeader: RequestHandler = (req, _res, next) => {
      const userId = Number(req.header("x-test-user") || 1);
      req.user = { userId, email: `user-${userId}@example.com` };
      next();
    };
    const app = appWith({ authenticate: authenticateByHeader, rateLimitMax: 1 });

    await request(app)
      .post("/ai/course-draft")
      .set("x-test-user", "1")
      .send(validBrief)
      .expect(503);
    await request(app)
      .post("/ai/course-draft")
      .set("x-test-user", "1")
      .send(validBrief)
      .expect(429);
    await request(app)
      .post("/ai/course-draft")
      .set("x-test-user", "2")
      .send(validBrief)
      .expect(503);
  });
});
