import {
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  createCurriculumImportRouter,
  type CurriculumImportStore,
  type CurriculumImportTransaction,
  type PersistedCurriculumImportResult,
} from "../../server/routes/curriculumImportRoutes";

const validCurriculum = {
  sections: [
    {
      title: "Data foundations",
      summary: "Build reliable mental models for practical data work.",
      lessons: [
        {
          title: "Reading an operational metric",
          kind: "video" as const,
          objective: "Interpret one operational metric without confusing correlation and cause.",
          durationMinutes: 12,
          isPreview: true,
        },
        {
          title: "Metric interpretation practice",
          kind: "text" as const,
          objective: "Apply a repeatable interpretation checklist to a realistic scenario.",
          durationMinutes: 18,
          isPreview: false,
        },
      ],
    },
    {
      title: "Decision communication",
      summary: "Turn evidence into a defensible operational recommendation.",
      lessons: [
        {
          title: "Recommendation case",
          kind: "quiz" as const,
          objective: "Choose and justify a recommendation from incomplete evidence.",
          durationMinutes: 25,
          isPreview: false,
        },
      ],
    },
  ],
};

type FakeImport = {
  id: number;
  requestHash: string;
  status: string;
  response: unknown;
};

type FakeSection = {
  id: number;
  courseId: number;
  title: string;
  position: number;
};

type FakeLesson = Parameters<CurriculumImportTransaction["insertLesson"]>[0] & {
  id: number;
};

type FakeState = {
  imports: Map<string, FakeImport>;
  sections: FakeSection[];
  lessons: FakeLesson[];
  nextImportId: number;
  nextSectionId: number;
  nextLessonId: number;
};

function cloneState(state: FakeState): FakeState {
  return {
    imports: new Map([...state.imports].map(([key, value]) => [
      key,
      { ...value, response: value.response == null ? value.response : structuredClone(value.response) },
    ])),
    sections: state.sections.map((section) => ({ ...section })),
    lessons: state.lessons.map((lesson) => ({ ...lesson })),
    nextImportId: state.nextImportId,
    nextSectionId: state.nextSectionId,
    nextLessonId: state.nextLessonId,
  };
}

class FakeTransactionalStore implements CurriculumImportStore {
  state: FakeState = {
    imports: new Map(),
    sections: [],
    lessons: [],
    nextImportId: 1,
    nextSectionId: 100,
    nextLessonId: 1_000,
  };

  readonly course = {
    id: 77,
    workspace: "creator" as "creator" | "institute",
    ownerId: 7,
  };

  failOnLessonNumber: number | null = null;
  private queue: Promise<void> = Promise.resolve();

  async transaction<T>(
    work: (tx: CurriculumImportTransaction) => Promise<T>,
  ): Promise<T> {
    let release: () => void = () => undefined;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    await previous;

    const working = cloneState(this.state);
    let lessonInsertNumber = 0;
    const tx: CurriculumImportTransaction = {
      lockOwnedCourse: async ({ courseId, workspace, ownerId }) =>
        courseId === this.course.id
        && workspace === this.course.workspace
        && ownerId === this.course.ownerId,

      claimImport: async ({
        courseId,
        workspace,
        actorUserId: _actorUserId,
        idempotencyKey,
        requestHash,
      }) => {
        const key = `${courseId}:${workspace}:${idempotencyKey}`;
        const existing = working.imports.get(key);
        if (existing) {
          return {
            kind: "existing" as const,
            importId: existing.id,
            requestHash: existing.requestHash,
            status: existing.status,
            response: existing.response,
          };
        }
        const record: FakeImport = {
          id: working.nextImportId++,
          requestHash,
          status: "processing",
          response: null,
        };
        working.imports.set(key, record);
        return { kind: "claimed" as const, importId: record.id };
      },

      nextSectionPosition: async (courseId) => {
        const positions = working.sections
          .filter((section) => section.courseId === courseId)
          .map((section) => section.position);
        return positions.length ? Math.max(...positions) + 1 : 0;
      },

      insertSection: async (input) => {
        const section = { id: working.nextSectionId++, ...input };
        working.sections.push(section);
        return { id: section.id };
      },

      insertLesson: async (input) => {
        lessonInsertNumber += 1;
        if (lessonInsertNumber === this.failOnLessonNumber) {
          throw new Error("Simulated lesson insert failure");
        }
        const lesson = { id: working.nextLessonId++, ...input };
        working.lessons.push(lesson);
        return { id: lesson.id };
      },

      completeImport: async (importId, result: PersistedCurriculumImportResult) => {
        const record = [...working.imports.values()].find((item) => item.id === importId);
        if (!record) throw new Error("Missing import claim");
        record.status = "completed";
        record.response = structuredClone(result);
      },
    };

    try {
      const result = await work(tx);
      this.state = working;
      return result;
    } finally {
      release();
    }
  }
}

function authenticated(): RequestHandler {
  return (req, _res, next) => {
    req.user = { userId: 42, email: "teacher@example.com" };
    next();
  };
}

function creatorAccess(): RequestHandler {
  return (req, _res, next) => {
    req.creator = { id: 7, userId: 42, plan: "pro", status: "approved" };
    next();
  };
}

function instituteAccess(): RequestHandler {
  return (req, _res, next) => {
    req.institute = { id: 11, plan: "growth", memberRole: "teacher" };
    next();
  };
}

function appWith(store: FakeTransactionalStore, auditEvent = jest.fn(async (_input: unknown) => undefined)) {
  const app = express();
  app.use(express.json());
  app.use(createCurriculumImportRouter({
    authenticate: authenticated(),
    requireCreatorAccess: creatorAccess(),
    requireInstituteTeacherAccess: instituteAccess(),
    store,
    auditEvent,
  }));
  return { app, auditEvent };
}

describe("atomic curriculum import routes", () => {
  it("imports the outline once and persists empty lesson content placeholders", async () => {
    const store = new FakeTransactionalStore();
    const { app, auditEvent } = appWith(store);

    const response = await request(app)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "course-draft-123456")
      .send(validCurriculum)
      .expect(201);

    expect(response.headers["idempotency-replayed"]).toBe("false");
    expect(response.body).toEqual(expect.objectContaining({
      importId: 1,
      courseId: 77,
      workspace: "creator",
      idempotencyKey: "course-draft-123456",
      replayed: false,
      counts: { sections: 2, lessons: 3 },
    }));
    expect(store.state.sections.map(({ position }) => position)).toEqual([0, 1]);
    expect(store.state.lessons.map(({ position }) => position)).toEqual([0, 1, 0]);
    expect(store.state.lessons.every((lesson) => (
      lesson.contentText === null && lesson.contentUrl === null
    ))).toBe(true);
    expect(store.state.lessons[1]).not.toHaveProperty("objective");
    expect(store.state.lessons[1]).toEqual(expect.objectContaining({
      durationSec: 18 * 60,
      kind: "text",
    }));

    const auditInput = auditEvent.mock.calls[0]?.[0] as {
      metadata?: Record<string, unknown>;
    } | undefined;
    expect(auditInput?.metadata).toEqual({
      importId: 1,
      sectionCount: 2,
      lessonCount: 3,
      replayed: false,
    });
    expect(JSON.stringify(auditInput?.metadata)).not.toContain("Data foundations");
    expect(JSON.stringify(auditInput?.metadata)).not.toContain("operational metric");
  });

  it("replays sequential and concurrent retries without duplicate rows", async () => {
    const sequentialStore = new FakeTransactionalStore();
    const { app: sequentialApp } = appWith(sequentialStore);
    const first = await request(sequentialApp)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "retry-safe-123456")
      .send(validCurriculum)
      .expect(201);
    const retry = await request(sequentialApp)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "retry-safe-123456")
      .send(validCurriculum)
      .expect(200);

    expect(retry.body.replayed).toBe(true);
    expect(retry.body.sections).toEqual(first.body.sections);
    expect(sequentialStore.state.sections).toHaveLength(2);
    expect(sequentialStore.state.lessons).toHaveLength(3);

    const concurrentStore = new FakeTransactionalStore();
    const { app: concurrentApp } = appWith(concurrentStore);
    const responses = await Promise.all([
      request(concurrentApp)
        .post("/creator/courses/77/curriculum/import")
        .set("Idempotency-Key", "concurrent-123456")
        .send(validCurriculum),
      request(concurrentApp)
        .post("/creator/courses/77/curriculum/import")
        .set("Idempotency-Key", "concurrent-123456")
        .send(validCurriculum),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 201]);
    expect(responses.filter(({ body }) => body.replayed)).toHaveLength(1);
    expect(concurrentStore.state.sections).toHaveLength(2);
    expect(concurrentStore.state.lessons).toHaveLength(3);
  });

  it("rejects reuse of a key for a different validated outline", async () => {
    const store = new FakeTransactionalStore();
    const { app } = appWith(store);
    await request(app)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "collision-123456")
      .send(validCurriculum)
      .expect(201);

    const changedCurriculum = structuredClone(validCurriculum);
    changedCurriculum.sections[0].title = "A different module";
    const collision = await request(app)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "collision-123456")
      .send(changedCurriculum)
      .expect(409);

    expect(collision.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(store.state.sections).toHaveLength(2);
    expect(store.state.lessons).toHaveLength(3);
  });

  it("rolls back the claim, sections, and lessons together and permits a same-key retry", async () => {
    const store = new FakeTransactionalStore();
    store.failOnLessonNumber = 2;
    const { app } = appWith(store);

    const failed = await request(app)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "rollback-123456")
      .send(validCurriculum)
      .expect(500);

    expect(failed.body).toEqual(expect.objectContaining({
      code: "CURRICULUM_IMPORT_FAILED",
    }));
    expect(store.state.imports.size).toBe(0);
    expect(store.state.sections).toHaveLength(0);
    expect(store.state.lessons).toHaveLength(0);

    store.failOnLessonNumber = null;
    await request(app)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "rollback-123456")
      .send(validCurriculum)
      .expect(201);
    expect(store.state.sections).toHaveLength(2);
    expect(store.state.lessons).toHaveLength(3);
  });

  it("enforces workspace ownership and strict request/key validation", async () => {
    const store = new FakeTransactionalStore();
    const { app } = appWith(store);

    await request(app)
      .post("/creator/courses/not-a-number/curriculum/import")
      .set("Idempotency-Key", "valid-key-123456")
      .send(validCurriculum)
      .expect(400);

    await request(app)
      .post("/creator/courses/77/curriculum/import")
      .send(validCurriculum)
      .expect(400);

    await request(app)
      .post("/creator/courses/77/curriculum/import")
      .set("Idempotency-Key", "valid-key-123456")
      .send({ ...validCurriculum, unexpected: true })
      .expect(400);

    const instituteAttempt = await request(app)
      .post("/institute/courses/77/curriculum/import")
      .set("Idempotency-Key", "valid-key-123456")
      .send(validCurriculum)
      .expect(404);
    expect(instituteAttempt.body.code).toBe("COURSE_NOT_FOUND");
    expect(store.state.sections).toHaveLength(0);
    expect(store.state.lessons).toHaveLength(0);
  });
});
