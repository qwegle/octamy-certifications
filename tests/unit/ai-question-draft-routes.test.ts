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
import type { QuestionBank } from "@shared/schema";
import {
  createAiQuestionDraftRouter,
  isAiQuestionDraftEnabled,
  type AiQuestionDraftRouteDependencies,
} from "../../server/routes/aiQuestionDraftRoutes";
import type { UserContext } from "../../server/lib/qb-permissions";

type CreateClient = NonNullable<AiQuestionDraftRouteDependencies["createClient"]>;
type QuestionDraftClient = ReturnType<CreateClient>;
type ParseQuestionDraft = QuestionDraftClient["responses"]["parse"];
type AuditEvent = NonNullable<AiQuestionDraftRouteDependencies["auditEvent"]>;

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;

const editableBank = {
  id: 19,
  ownerType: "creator",
  ownerId: 7,
  language: "en",
} as QuestionBank;

const userContext = {
  user: { id: 42, isAdmin: false },
  creatorId: 7,
  instituteRoles: new Map(),
} as UserContext;

const validBrief = {
  bankId: 19,
  topic: "Linear equations with one variable",
  audience: "Grade 8 learners following CBSE",
  count: 3,
  difficultyMix: { easy: 1, medium: 1, hard: 1 },
  questionTypes: ["mcq_single", "true_false"] as const,
  context: "Assess conceptual understanding and one-step application.",
};

const validGeneratedDraft = {
  items: [
    {
      prompt: "Which operation isolates x in the equation x + 7 = 12?",
      questionFormat: "mcq_single" as const,
      difficulty: "easy" as const,
      options: ["Add 7", "Subtract 7", "Multiply by 7", "Divide by 7"],
      correctAnswer: 1,
      explanation: "Subtracting 7 from both sides keeps the equation balanced and isolates x.",
      tags: ["algebra", "inverse operations"],
    },
    {
      prompt: "The equation 3x = 18 has the solution x = 6.",
      questionFormat: "true_false" as const,
      difficulty: "medium" as const,
      options: ["False", "True"],
      correctAnswer: 1,
      explanation: "Dividing both sides of 3x = 18 by 3 gives x = 6.",
      tags: ["algebra", "equation solving"],
    },
    {
      prompt: "If 4(x - 2) + 3 = 19, what is the value of x?",
      questionFormat: "mcq_single" as const,
      difficulty: "hard" as const,
      options: ["2", "4", "6", "8"],
      correctAnswer: 2,
      explanation: "Subtract 3, divide by 4, then add 2: x - 2 = 4, so x = 6.",
      tags: ["algebra", "multi-step equations"],
    },
  ],
};

function authenticatedAs(userId = 42): RequestHandler {
  return (req, _res, next) => {
    req.user = { userId, email: `user-${userId}@example.com` };
    next();
  };
}

function appWith(overrides: AiQuestionDraftRouteDependencies = {}) {
  const app = express();
  app.use(express.json());
  app.use(createAiQuestionDraftRouter({
    authenticate: authenticatedAs(),
    getBank: async () => editableBank,
    loadContext: async () => userContext,
    canEdit: () => true,
    auditEvent: async () => undefined,
    rateLimitMax: 100,
    ...overrides,
  }));
  return app;
}

describe("AI question draft routes", () => {
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

  it("reports availability without exposing configuration details", async () => {
    expect(isAiQuestionDraftEnabled({ OPENAI_API_KEY: "your_openai_api_key" })).toBe(false);
    expect(isAiQuestionDraftEnabled({ OPENAI_API_KEY: "sk-proj-abcdefghijklmnopqrstuvwxyz" })).toBe(true);

    const response = await request(appWith()).get("/ai/question-draft/status").expect(200);
    expect(response.body).toEqual({ enabled: false });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("requires authentication before bank lookup or provider access", async () => {
    const getBank = jest.fn<NonNullable<AiQuestionDraftRouteDependencies["getBank"]>>(
      async () => editableBank,
    );
    const createClient = jest.fn<CreateClient>(() => {
      throw new Error("Provider must not be called");
    });
    const rejectAuth: RequestHandler = (_req, res) => {
      res.status(401).json({ message: "Access token required" });
    };

    await request(appWith({ authenticate: rejectAuth, getBank, createClient }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(401);

    expect(getBank).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails professionally when the provider is not configured", async () => {
    const createClient = jest.fn<CreateClient>(() => {
      throw new Error("Provider must not be constructed while disabled");
    });
    const auditEvent = jest.fn<AuditEvent>(async () => undefined);

    const response = await request(appWith({ createClient, auditEvent }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(503);

    expect(response.body).toEqual(expect.objectContaining({
      code: "AI_QUESTION_DRAFT_DISABLED",
    }));
    expect(response.body.message).not.toMatch(/api.?key/i);
    expect(createClient).not.toHaveBeenCalled();
    expect(auditEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "ai.question_draft.generate",
      status: "failure",
      metadata: expect.objectContaining({ reason: "service_not_configured" }),
    }));
  });

  it("requires edit permission before invoking OpenAI", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const createClient = jest.fn<CreateClient>(() => {
      throw new Error("Provider must not be constructed without bank access");
    });

    const response = await request(appWith({ canEdit: () => false, createClient }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(403);

    expect(response.body.code).toBe("QUESTION_BANK_EDIT_REQUIRED");
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "a creator who does not own the bank",
      bank: { ...editableBank, ownerType: "creator", ownerId: 99 } as QuestionBank,
      context: userContext,
    },
    {
      label: "institute staff",
      bank: { ...editableBank, ownerType: "institute", ownerId: 55 } as QuestionBank,
      context: {
        ...userContext,
        creatorId: null,
        instituteRoles: new Map([[55, "staff"]]),
      } as UserContext,
    },
    {
      label: "an unknown institute role",
      bank: { ...editableBank, ownerType: "institute", ownerId: 55 } as QuestionBank,
      context: {
        ...userContext,
        creatorId: null,
        instituteRoles: new Map([[55, "student"]]),
      } as UserContext,
    },
  ])("denies $label using the production ownership policy", async ({ bank, context }) => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const createClient = jest.fn<CreateClient>(() => {
      throw new Error("Provider must not be constructed without bank ownership");
    });

    await request(appWith({
      getBank: async () => bank,
      loadContext: async () => context,
      canEdit: undefined,
      createClient,
    }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(403);

    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "the owning creator",
      bank: editableBank,
      context: userContext,
    },
    {
      label: "an institute teacher in the owning workspace",
      bank: { ...editableBank, ownerType: "institute", ownerId: 55 } as QuestionBank,
      context: {
        ...userContext,
        creatorId: null,
        instituteRoles: new Map([[55, "teacher"]]),
      } as UserContext,
    },
    {
      label: "a platform admin",
      bank: editableBank,
      context: {
        ...userContext,
        creatorId: null,
        user: { ...userContext.user, isAdmin: true },
      } as UserContext,
    },
  ])("allows $label through the production ownership policy", async ({ bank, context }) => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const parse = jest.fn<ParseQuestionDraft>(async () => ({
      output_parsed: validGeneratedDraft,
    }));

    await request(appWith({
      getBank: async () => bank,
      loadContext: async () => context,
      canEdit: undefined,
      createClient: () => ({ responses: { parse } }),
    }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(200);

    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("uses strict structured output, store false, and returns unpersisted review drafts", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const parse = jest.fn<ParseQuestionDraft>(async () => ({
      output_parsed: validGeneratedDraft,
    }));
    const createClient = jest.fn<CreateClient>(() => ({ responses: { parse } }));
    const auditEvent = jest.fn<AuditEvent>(async () => undefined);

    const response = await request(appWith({
      createClient,
      auditEvent,
      now: () => new Date("2026-07-14T12:00:00.000Z"),
    }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(200);

    expect(createClient).toHaveBeenCalledWith(process.env.OPENAI_API_KEY);
    expect(parse).toHaveBeenCalledTimes(1);
    const [modelRequest, requestOptions] = parse.mock.calls[0];
    expect(modelRequest).toEqual(expect.objectContaining({
      model: "gpt-5-mini",
      store: false,
      max_output_tokens: 12_000,
      text: {
        format: expect.objectContaining({
          type: "json_schema",
          name: "question_drafts",
          strict: true,
        }),
      },
    }));
    expect(requestOptions).toEqual({ timeout: 45_000 });
    expect(response.body.drafts).toHaveLength(3);
    expect(response.body.meta).toEqual({
      model: "gpt-5-mini",
      generatedAt: "2026-07-14T12:00:00.000Z",
      bankId: 19,
      persisted: false,
      reviewRequired: true,
    });

    const successAudit = auditEvent.mock.calls.at(-1)?.[0];
    expect(successAudit).toEqual(expect.objectContaining({
      action: "ai.question_draft.generate",
      resourceType: "question_bank",
      resourceId: 19,
      metadata: {
        model: "gpt-5-mini",
        bankId: 19,
        count: 3,
        difficultyMix: { easy: 1, medium: 1, hard: 1 },
        questionTypes: ["mcq_single", "true_false"],
      },
    }));
    expect(JSON.stringify(successAudit?.metadata)).not.toContain(validBrief.topic);
    expect(JSON.stringify(successAudit?.metadata)).not.toContain(validBrief.audience);
    expect(JSON.stringify(successAudit?.metadata)).not.toContain(validBrief.context);
  });

  it("rejects unexpected fields, unsupported types, excessive counts, and invalid mixes", async () => {
    const malformedResponse = await request(appWith())
      .post("/ai/question-draft")
      .send({
        ...validBrief,
        count: 21,
        difficultyMix: { easy: 1, medium: 1, hard: 1 },
        questionTypes: ["short"],
        learnerEmail: "learner@example.com",
      })
      .expect(400);

    expect(malformedResponse.body.code).toBe("INVALID_QUESTION_BRIEF");
    expect(malformedResponse.body.errors.count).toBeDefined();
    expect(malformedResponse.body.errors.questionTypes).toBeDefined();

    const invalidMixResponse = await request(appWith())
      .post("/ai/question-draft")
      .send({
        ...validBrief,
        difficultyMix: { easy: 2, medium: 2, hard: 2 },
      })
      .expect(400);

    expect(invalidMixResponse.body.code).toBe("INVALID_QUESTION_BRIEF");
    expect(invalidMixResponse.body.errors.difficultyMix).toBeDefined();
  });

  it("rejects model output with a wrong difficulty mix or answer shape", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const malformed = {
      items: validGeneratedDraft.items.map((item) => ({ ...item, difficulty: "easy" })),
    };

    const response = await request(appWith({
      createClient: () => ({
        responses: { parse: async () => ({ output_parsed: malformed }) },
      }),
    }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(502);

    expect(response.body.code).toBe("AI_QUESTION_DRAFT_FAILED");
    expect(response.body).not.toHaveProperty("drafts");
  });

  it("rejects duplicate generated questions after Unicode and whitespace normalization", async () => {
    process.env.OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const duplicated = {
      items: [
        validGeneratedDraft.items[0],
        {
          ...validGeneratedDraft.items[1],
          prompt: `  ${validGeneratedDraft.items[0].prompt.toUpperCase()}  `,
        },
        validGeneratedDraft.items[2],
      ],
    };

    const response = await request(appWith({
      createClient: () => ({
        responses: { parse: async () => ({ output_parsed: duplicated }) },
      }),
    }))
      .post("/ai/question-draft")
      .send(validBrief)
      .expect(502);

    expect(response.body.code).toBe("AI_QUESTION_DRAFT_FAILED");
    expect(response.body).not.toHaveProperty("drafts");
  });

  it("applies the generation quota independently per authenticated user", async () => {
    const authenticateByHeader: RequestHandler = (req, _res, next) => {
      const userId = Number(req.header("x-test-user") || 1);
      req.user = { userId, email: `user-${userId}@example.com` };
      next();
    };
    const app = appWith({ authenticate: authenticateByHeader, rateLimitMax: 1 });

    await request(app).post("/ai/question-draft").set("x-test-user", "1").send(validBrief).expect(503);
    await request(app).post("/ai/question-draft").set("x-test-user", "1").send(validBrief).expect(429);
    await request(app).post("/ai/question-draft").set("x-test-user", "2").send(validBrief).expect(503);
  });
});
