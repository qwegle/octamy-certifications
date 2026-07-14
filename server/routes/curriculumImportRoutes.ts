import crypto from "crypto";
import { Router, type RequestHandler, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../lib/audit";
import { logger } from "../lib/logger";
import {
  authenticateToken,
  requireCreator,
  requireInstituteRole,
  type AuthenticatedRequest,
} from "../middleware/auth";
import {
  courseCurriculumImports,
  courses,
  courseSections,
  lessons,
} from "@shared/schema";

const workspaceSchema = z.enum(["creator", "institute"]);
const lessonKindSchema = z.enum(["video", "pdf", "text", "quiz"]);

const curriculumLessonSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: lessonKindSchema,
  objective: z.string().trim().min(5).max(500),
  durationMinutes: z.number().int().min(1).max(600),
  isPreview: z.boolean(),
}).strict();

const curriculumSectionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(10).max(1_000),
  lessons: z.array(curriculumLessonSchema).min(1).max(15),
}).strict();

export const curriculumImportRequestSchema = z.object({
  sections: z.array(curriculumSectionSchema).min(1).max(10),
}).strict();

export const curriculumImportIdempotencyKeySchema = z.string()
  .trim()
  .min(8)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    "Use 8-128 letters, numbers, dots, underscores, colons, or hyphens",
  );

const persistedImportResultSchema = z.object({
  importId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  workspace: workspaceSchema,
  sections: z.array(z.object({
    id: z.number().int().positive(),
    position: z.number().int().min(0),
    lessons: z.array(z.object({
      id: z.number().int().positive(),
      position: z.number().int().min(0),
    }).strict()),
  }).strict()),
  counts: z.object({
    sections: z.number().int().min(0),
    lessons: z.number().int().min(0),
  }).strict(),
}).strict();

export type CurriculumImportRequest = z.infer<typeof curriculumImportRequestSchema>;
export type CurriculumImportWorkspace = z.infer<typeof workspaceSchema>;
export type PersistedCurriculumImportResult = z.infer<typeof persistedImportResultSchema>;

type ImportClaim =
  | { kind: "claimed"; importId: number }
  | {
      kind: "existing";
      importId: number;
      requestHash: string;
      status: string;
      response: unknown;
    };

export interface CurriculumImportTransaction {
  lockOwnedCourse(input: {
    courseId: number;
    workspace: CurriculumImportWorkspace;
    ownerId: number;
  }): Promise<boolean>;
  claimImport(input: {
    courseId: number;
    workspace: CurriculumImportWorkspace;
    actorUserId: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<ImportClaim>;
  nextSectionPosition(courseId: number): Promise<number>;
  insertSection(input: {
    courseId: number;
    title: string;
    position: number;
  }): Promise<{ id: number }>;
  insertLesson(input: {
    courseId: number;
    sectionId: number;
    title: string;
    kind: z.infer<typeof lessonKindSchema>;
    durationSec: number;
    position: number;
    isPreview: boolean;
    contentUrl: null;
    contentText: null;
  }): Promise<{ id: number }>;
  completeImport(importId: number, result: PersistedCurriculumImportResult): Promise<void>;
}

export interface CurriculumImportStore {
  transaction<T>(work: (tx: CurriculumImportTransaction) => Promise<T>): Promise<T>;
}

export class CurriculumImportNotFoundError extends Error {
  readonly code = "COURSE_NOT_FOUND";
}

export class CurriculumImportIdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";
}

export class CurriculumImportStateError extends Error {
  readonly code = "CURRICULUM_IMPORT_STATE_INVALID";
}

function curriculumRequestHash(request: CurriculumImportRequest): string {
  // Zod emits keys in schema order, producing a stable representation for the
  // validated data while preserving the meaningful order of sections/lessons.
  return crypto.createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

export function createDrizzleCurriculumImportStore(
  database: typeof db = db,
): CurriculumImportStore {
  return {
    transaction: async <T>(work: (tx: CurriculumImportTransaction) => Promise<T>) =>
      database.transaction(async (transaction) => {
        const adapter: CurriculumImportTransaction = {
          async lockOwnedCourse({ courseId, workspace, ownerId }) {
            // The row lock serializes imports for the same course so separate
            // idempotency keys still append with deterministic positions.
            const [course] = await transaction
              .select({ id: courses.id })
              .from(courses)
              .where(and(
                eq(courses.id, courseId),
                eq(courses.ownerType, workspace),
                eq(courses.ownerId, ownerId),
              ))
              .for("update");
            return Boolean(course);
          },

          async claimImport({
            courseId,
            workspace,
            actorUserId,
            idempotencyKey,
            requestHash,
          }) {
            // PostgreSQL waits on an uncommitted conflicting unique index row.
            // Once the first transaction commits, the retry reads its completed
            // response; if the first transaction rolls back, this insert wins.
            const [created] = await transaction
              .insert(courseCurriculumImports)
              .values({
                courseId,
                workspace,
                actorUserId,
                idempotencyKey,
                requestHash,
                status: "processing",
              })
              .onConflictDoNothing({
                target: [
                  courseCurriculumImports.courseId,
                  courseCurriculumImports.workspace,
                  courseCurriculumImports.idempotencyKey,
                ],
              })
              .returning({ id: courseCurriculumImports.id });

            if (created) return { kind: "claimed", importId: created.id };

            const [existing] = await transaction
              .select({
                id: courseCurriculumImports.id,
                requestHash: courseCurriculumImports.requestHash,
                status: courseCurriculumImports.status,
                response: courseCurriculumImports.response,
              })
              .from(courseCurriculumImports)
              .where(and(
                eq(courseCurriculumImports.courseId, courseId),
                eq(courseCurriculumImports.workspace, workspace),
                eq(courseCurriculumImports.idempotencyKey, idempotencyKey),
              ));

            if (!existing) {
              throw new CurriculumImportStateError(
                "The curriculum import request could not be resolved safely",
              );
            }
            return {
              kind: "existing",
              importId: existing.id,
              requestHash: existing.requestHash,
              status: existing.status,
              response: existing.response,
            };
          },

          async nextSectionPosition(courseId) {
            const [row] = await transaction
              .select({
                maximum: sql<number>`coalesce(max(${courseSections.position}), -1)`,
              })
              .from(courseSections)
              .where(eq(courseSections.courseId, courseId));
            return Number(row?.maximum ?? -1) + 1;
          },

          async insertSection(input) {
            const [created] = await transaction
              .insert(courseSections)
              .values(input)
              .returning({ id: courseSections.id });
            if (!created) throw new Error("Section insert did not return an identifier");
            return created;
          },

          async insertLesson(input) {
            const [created] = await transaction
              .insert(lessons)
              .values(input)
              .returning({ id: lessons.id });
            if (!created) throw new Error("Lesson insert did not return an identifier");
            return created;
          },

          async completeImport(importId, result) {
            const [completed] = await transaction
              .update(courseCurriculumImports)
              .set({
                status: "completed",
                response: result,
                completedAt: new Date(),
              })
              .where(eq(courseCurriculumImports.id, importId))
              .returning({ id: courseCurriculumImports.id });
            if (!completed) {
              throw new CurriculumImportStateError(
                "The curriculum import result could not be committed safely",
              );
            }
          },
        };

        return work(adapter);
      }),
  };
}

export async function importCourseCurriculum(
  store: CurriculumImportStore,
  input: {
    courseId: number;
    workspace: CurriculumImportWorkspace;
    ownerId: number;
    actorUserId: number;
    idempotencyKey: string;
    curriculum: CurriculumImportRequest;
  },
): Promise<{ replayed: boolean; result: PersistedCurriculumImportResult }> {
  const requestHash = curriculumRequestHash(input.curriculum);

  return store.transaction(async (transaction) => {
    const ownsCourse = await transaction.lockOwnedCourse({
      courseId: input.courseId,
      workspace: input.workspace,
      ownerId: input.ownerId,
    });
    if (!ownsCourse) {
      throw new CurriculumImportNotFoundError(
        "Course not found in this workspace",
      );
    }

    const claim = await transaction.claimImport({
      courseId: input.courseId,
      workspace: input.workspace,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestHash,
    });

    if (claim.kind === "existing") {
      if (claim.requestHash !== requestHash) {
        throw new CurriculumImportIdempotencyConflictError(
          "This idempotency key was already used for a different curriculum",
        );
      }
      const stored = persistedImportResultSchema.safeParse(claim.response);
      if (claim.status !== "completed" || !stored.success) {
        throw new CurriculumImportStateError(
          "The previous curriculum import result is not available safely",
        );
      }
      return { replayed: true, result: stored.data };
    }

    const firstSectionPosition = await transaction.nextSectionPosition(input.courseId);
    const importedSections: PersistedCurriculumImportResult["sections"] = [];
    let lessonCount = 0;

    for (let sectionIndex = 0; sectionIndex < input.curriculum.sections.length; sectionIndex += 1) {
      const section = input.curriculum.sections[sectionIndex];
      const sectionPosition = firstSectionPosition + sectionIndex;
      const createdSection = await transaction.insertSection({
        courseId: input.courseId,
        title: section.title,
        position: sectionPosition,
      });
      const importedLessons: Array<{ id: number; position: number }> = [];

      for (let lessonPosition = 0; lessonPosition < section.lessons.length; lessonPosition += 1) {
        const lesson = section.lessons[lessonPosition];
        const createdLesson = await transaction.insertLesson({
          courseId: input.courseId,
          sectionId: createdSection.id,
          title: lesson.title,
          kind: lesson.kind,
          durationSec: lesson.durationMinutes * 60,
          position: lessonPosition,
          isPreview: lesson.isPreview,
          // AI objectives describe the intended outline; they must never be
          // mistaken for learner-facing lesson material.
          contentUrl: null,
          contentText: null,
        });
        importedLessons.push({ id: createdLesson.id, position: lessonPosition });
        lessonCount += 1;
      }

      importedSections.push({
        id: createdSection.id,
        position: sectionPosition,
        lessons: importedLessons,
      });
    }

    const result: PersistedCurriculumImportResult = {
      importId: claim.importId,
      courseId: input.courseId,
      workspace: input.workspace,
      sections: importedSections,
      counts: {
        sections: importedSections.length,
        lessons: lessonCount,
      },
    };
    await transaction.completeImport(claim.importId, result);
    return { replayed: false, result };
  });
}

type AuditWriter = typeof audit;
type CurriculumImporter = typeof importCourseCurriculum;

export interface CurriculumImportRouteDependencies {
  authenticate?: RequestHandler;
  requireCreatorAccess?: RequestHandler;
  requireInstituteTeacherAccess?: RequestHandler;
  store?: CurriculumImportStore;
  importer?: CurriculumImporter;
  auditEvent?: AuditWriter;
}

async function writeAuditSafely(
  writer: AuditWriter,
  input: Parameters<AuditWriter>[0],
) {
  try {
    await writer(input);
  } catch {
    // Auditing is important, but an unavailable audit sink must not turn a
    // successfully committed idempotent import into a client retry storm.
  }
}

export function createCurriculumImportRouter(
  dependencies: CurriculumImportRouteDependencies = {},
) {
  const router = Router();
  const authenticate = dependencies.authenticate ?? authenticateToken;
  const creatorAccess = dependencies.requireCreatorAccess ?? requireCreator;
  const instituteAccess = dependencies.requireInstituteTeacherAccess
    ?? requireInstituteRole("teacher");
  const store = dependencies.store ?? createDrizzleCurriculumImportStore();
  const importer = dependencies.importer ?? importCourseCurriculum;
  const auditEvent = dependencies.auditEvent ?? audit;

  function importHandler(workspace: CurriculumImportWorkspace) {
    return async (req: AuthenticatedRequest, res: Response) => {
      const courseIdResult = z.coerce.number().int().positive().safeParse(req.params.id);
      if (!courseIdResult.success) {
        return res.status(400).json({
          message: "Use a valid course identifier.",
          code: "INVALID_COURSE_ID",
        });
      }

      const idempotencyKeyResult = curriculumImportIdempotencyKeySchema.safeParse(
        req.get("Idempotency-Key"),
      );
      if (!idempotencyKeyResult.success) {
        return res.status(400).json({
          message: "A valid Idempotency-Key header is required for curriculum import.",
          code: "INVALID_IDEMPOTENCY_KEY",
        });
      }

      const curriculumResult = curriculumImportRequestSchema.safeParse(req.body);
      if (!curriculumResult.success) {
        return res.status(400).json({
          message: "Review the generated curriculum before importing it.",
          code: "INVALID_CURRICULUM_IMPORT",
          errors: curriculumResult.error.flatten().fieldErrors,
        });
      }

      const ownerId = workspace === "creator"
        ? req.creator?.id
        : req.institute?.id;
      if (!req.user || !ownerId) {
        return res.status(403).json({
          message: `${workspace === "creator" ? "Creator" : "Institute teacher"} workspace access is required.`,
          code: "WORKSPACE_ACCESS_REQUIRED",
        });
      }

      try {
        const outcome = await importer(store, {
          courseId: courseIdResult.data,
          workspace,
          ownerId,
          actorUserId: req.user.userId,
          idempotencyKey: idempotencyKeyResult.data,
          curriculum: curriculumResult.data,
        });

        await writeAuditSafely(auditEvent, {
          action: "course.curriculum.ai_import",
          userId: req.user.userId,
          actorRole: workspace,
          resourceType: "course",
          resourceId: courseIdResult.data,
          metadata: {
            importId: outcome.result.importId,
            sectionCount: outcome.result.counts.sections,
            lessonCount: outcome.result.counts.lessons,
            replayed: outcome.replayed,
          },
          req,
        });

        res.setHeader("Idempotency-Replayed", String(outcome.replayed));
        return res.status(outcome.replayed ? 200 : 201).json({
          ...outcome.result,
          idempotencyKey: idempotencyKeyResult.data,
          replayed: outcome.replayed,
        });
      } catch (error) {
        if (error instanceof CurriculumImportNotFoundError) {
          return res.status(404).json({
            message: "Course not found in this workspace.",
            code: error.code,
          });
        }
        if (error instanceof CurriculumImportIdempotencyConflictError) {
          return res.status(409).json({
            message: "This Idempotency-Key was already used with a different curriculum.",
            code: error.code,
          });
        }
        if (error instanceof CurriculumImportStateError) {
          logger.error("course.curriculum.ai_import.state_error", {
            courseId: courseIdResult.data,
            workspace,
            userId: req.user.userId,
            errorCode: error.code,
          });
          return res.status(409).json({
            message: "This curriculum import could not be replayed safely. Please contact support before retrying.",
            code: error.code,
          });
        }

        // Deliberately omit the error object: database query parameters may
        // contain generated outline text and must not be copied into logs.
        logger.error("course.curriculum.ai_import.error", {
          courseId: courseIdResult.data,
          workspace,
          userId: req.user.userId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        await writeAuditSafely(auditEvent, {
          action: "course.curriculum.ai_import",
          userId: req.user.userId,
          actorRole: workspace,
          resourceType: "course",
          resourceId: courseIdResult.data,
          status: "failure",
          metadata: { reason: "transaction_failed" },
          req,
        });
        return res.status(500).json({
          message: "The curriculum was not imported. No partial outline was saved; please retry with the same key.",
          code: "CURRICULUM_IMPORT_FAILED",
        });
      }
    };
  }

  router.post(
    "/creator/courses/:id/curriculum/import",
    authenticate,
    creatorAccess,
    importHandler("creator"),
  );
  router.post(
    "/institute/courses/:id/curriculum/import",
    authenticate,
    instituteAccess,
    importHandler("institute"),
  );

  return router;
}

export default createCurriculumImportRouter();
