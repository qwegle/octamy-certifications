import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  CourseDraftMaterializationError,
  aiCourseDraftToFormValues,
  materializeAiCourseDraft,
  type CourseDraft,
  type MaterializeCourseDraftProgress,
} from "../../client/src/lib/ai-course-draft";

const originalFetch = globalThis.fetch;
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const fetchMock = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function makeDraft(overrides: Partial<CourseDraft> = {}): CourseDraft {
  return {
    title: "Evidence-led product discovery",
    description: "Build a repeatable discovery practice.",
    level: "intermediate",
    productType: "video_course",
    duration: 95,
    passingScore: 75,
    learningOutcomes: [
      "Plan a focused customer interview",
      "Synthesize evidence into a decision",
    ],
    sections: [
      {
        title: "Customer evidence",
        summary: "Collect useful customer evidence.",
        lessons: [
          {
            title: "Interview foundations",
            kind: "video",
            objective: "Prepare a focused interview plan.",
            durationMinutes: 12.4,
            isPreview: true,
          },
          {
            title: "Interview field guide",
            kind: "text",
            objective: "Use a repeatable interview checklist.",
            durationMinutes: 7.6,
            isPreview: false,
          },
        ],
      },
      {
        title: "Evidence synthesis",
        summary: "Turn observations into decisions.",
        lessons: [
          {
            title: "Pattern mapping",
            kind: "quiz",
            objective: "Distinguish a pattern from an anecdote.",
            durationMinutes: 5,
            isPreview: false,
          },
        ],
      },
    ],
    assessmentIdeas: [
      {
        title: "Discovery decision memo",
        type: "project",
        difficulty: "medium",
      },
    ],
    meta: { provider: "openai", model: "test-model" },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parsedFetchCalls() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined,
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: jest.fn((key: string) => key === "token" ? "learner-token" : null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(() => null),
      length: 1,
    } satisfies Storage,
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

describe("aiCourseDraftToFormValues", () => {
  it("copies only review-safe form fields and normalizes their presentation", () => {
    const draft = {
      ...makeDraft(),
      title: `  ${"A".repeat(205)}  `,
      description: "  Applied discovery for product teams.  ",
      duration: 37.6,
      passingScore: 72.5,
      learningOutcomes: ["  Run useful interviews  ", "", "   ", "Map evidence"],
      price: "999.00",
      categoryId: 42,
      visibility: "public",
      thumbnailUrl: "https://example.com/unsafe.jpg",
    } as CourseDraft & {
      price: string;
      categoryId: number;
      visibility: string;
      thumbnailUrl: string;
    };

    const values = aiCourseDraftToFormValues(draft);

    expect(Object.keys(values).sort()).toEqual([
      "description",
      "duration",
      "level",
      "passingScore",
      "productType",
      "title",
    ]);
    expect(values).toEqual({
      title: "A".repeat(200),
      description: [
        "Applied discovery for product teams.",
        "Learning outcomes\n• Run useful interviews\n• Map evidence",
      ].join("\n\n"),
      duration: 38,
      passingScore: 73,
      productType: "video_course",
      level: "intermediate",
    });
    expect(values).not.toHaveProperty("price");
    expect(values).not.toHaveProperty("categoryId");
    expect(values).not.toHaveProperty("visibility");
    expect(values).not.toHaveProperty("thumbnailUrl");
  });

  it("clamps form limits and never exceeds the description contract", () => {
    const minimums = aiCourseDraftToFormValues(makeDraft({
      duration: -20,
      passingScore: 0,
    }));
    const maximums = aiCourseDraftToFormValues(makeDraft({
      description: "D".repeat(10_500),
      duration: 9_000,
      passingScore: 700,
    }));

    expect(minimums.duration).toBe(5);
    expect(minimums.passingScore).toBe(10);
    expect(maximums.duration).toBe(600);
    expect(maximums.passingScore).toBe(100);
    expect(maximums.description).toHaveLength(10_000);
  });
});

describe("materializeAiCourseDraft", () => {
  it("imports the reviewed outline atomically with an idempotency key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      importId: 9,
      courseId: 77,
      workspace: "creator",
      sections: [
        { id: 101, position: 0, lessons: [{ id: 201, position: 0 }, { id: 202, position: 1 }] },
        { id: 102, position: 1, lessons: [{ id: 203, position: 0 }] },
      ],
      counts: { sections: 2, lessons: 3 },
      replayed: false,
    }));
    const onProgress = jest.fn<(progress: MaterializeCourseDraftProgress) => void>();

    const result = await materializeAiCourseDraft("creator", 77, makeDraft(), {
      onProgress,
      idempotencyKey: "fixed-import-key-123",
    });

    expect(result).toEqual({
      sectionIds: [101, 102],
      lessonIds: [201, 202, 203],
      completedSections: 2,
      completedLessons: 3,
    });
    expect(parsedFetchCalls()).toEqual([{
      url: "/api/creator/courses/77/curriculum/import",
      method: "POST",
      headers: {
        "Idempotency-Key": "fixed-import-key-123",
        "Content-Type": "application/json",
        Authorization: "Bearer learner-token",
      },
      body: {
        sections: [
          {
            title: "Customer evidence",
            summary: "Collect useful customer evidence.",
            lessons: [
              {
                title: "Interview foundations",
                kind: "video",
                objective: "Prepare a focused interview plan.",
                durationMinutes: 12,
                isPreview: true,
              },
              {
                title: "Interview field guide",
                kind: "text",
                objective: "Use a repeatable interview checklist.",
                durationMinutes: 8,
                isPreview: false,
              },
            ],
          },
          {
            title: "Evidence synthesis",
            summary: "Turn observations into decisions.",
            lessons: [{
              title: "Pattern mapping",
              kind: "quiz",
              objective: "Distinguish a pattern from an anecdote.",
              durationMinutes: 5,
              isPreview: false,
            }],
          },
        ],
      },
    }]);
    expect(onProgress).toHaveBeenLastCalledWith({
      stage: "import",
      completedSections: 2,
      completedLessons: 3,
      totalSections: 2,
      totalLessons: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an atomic import failure without claiming partial progress", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      message: "The curriculum was not imported. No partial outline was saved.",
      code: "CURRICULUM_IMPORT_FAILED",
    }, 500));

    let thrown: unknown;
    try {
      await materializeAiCourseDraft("institute", 88, makeDraft(), {
        idempotencyKey: "retry-safe-import-123",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CourseDraftMaterializationError);
    const error = thrown as CourseDraftMaterializationError;
    expect(error).toMatchObject({
      name: "CourseDraftMaterializationError",
      workspace: "institute",
      courseId: 88,
      idempotencyKey: "retry-safe-import-123",
    });
    expect(error.message).toContain("no partial outline was saved");
    expect(error.message).toContain("No partial outline was saved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parsedFetchCalls()[0]).toEqual(expect.objectContaining({
      url: "/api/institute/courses/88/curriculum/import",
      headers: expect.objectContaining({ "Idempotency-Key": "retry-safe-import-123" }),
    }));
  });
});
