import { apiRequest } from "@/lib/queryClient";

export type CourseDraftWorkspace = "creator" | "institute";
export type CourseDraftLevel = "novice" | "intermediate" | "advanced" | "expert";
export type CourseDraftProductType = "assessment" | "video_course" | "bundle";
export type CourseDraftLessonKind = "video" | "pdf" | "text" | "quiz";

export type CourseDraftRequest = {
  workspace: CourseDraftWorkspace;
  topic: string;
  audience: string;
  goal: string;
  level: CourseDraftLevel;
  productType: CourseDraftProductType;
  moduleCount: number;
  language: string;
  additionalContext?: string;
};

export type CourseDraftLesson = {
  title: string;
  kind: CourseDraftLessonKind;
  objective: string;
  durationMinutes: number;
  isPreview: boolean;
};

export type CourseDraftSection = {
  title: string;
  summary: string;
  lessons: CourseDraftLesson[];
};

export type CourseDraftAssessmentIdea = {
  title: string;
  type: "multiple_choice" | "short_answer" | "project" | "case_study" | "practical";
  difficulty: "easy" | "medium" | "hard";
};

export type CourseDraftMeta = {
  provider?: string;
  model?: string;
  generatedAt?: string;
  requestId?: string;
  disclaimer?: string;
  [key: string]: unknown;
};

export type CourseDraft = {
  title: string;
  description: string;
  level: CourseDraftLevel;
  productType: CourseDraftProductType;
  duration: number;
  passingScore: number;
  learningOutcomes: string[];
  sections: CourseDraftSection[];
  assessmentIdeas: CourseDraftAssessmentIdea[];
  meta: CourseDraftMeta;
};

export type AiCourseFormValues = Pick<
  CourseDraft,
  "title" | "description" | "duration" | "passingScore" | "productType" | "level"
>;

/**
 * Converts a reviewed AI blueprint into the fields shared by the creator and
 * institute course forms. Commercial, catalogue, visibility, and media fields
 * are deliberately excluded so AI can never silently change them.
 */
export function aiCourseDraftToFormValues(draft: CourseDraft): AiCourseFormValues {
  const outcomes = draft.learningOutcomes
    .map((outcome) => outcome.trim())
    .filter(Boolean)
    .map((outcome) => `• ${outcome}`)
    .join("\n");
  const description = [
    draft.description.trim(),
    outcomes ? `Learning outcomes\n${outcomes}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 10_000);

  return {
    title: draft.title.trim().slice(0, 200),
    description,
    duration: Math.max(5, Math.min(600, Math.round(draft.duration))),
    passingScore: Math.max(10, Math.min(100, Math.round(draft.passingScore))),
    productType: draft.productType,
    level: draft.level,
  };
}

export type MaterializeCourseDraftProgress = {
  stage: "import";
  completedSections: number;
  completedLessons: number;
  totalSections: number;
  totalLessons: number;
};

export type MaterializedCourseDraft = {
  sectionIds: number[];
  lessonIds: number[];
  completedSections: number;
  completedLessons: number;
};

export class CourseDraftMaterializationError extends Error {
  readonly workspace: CourseDraftWorkspace;
  readonly courseId: number;
  readonly idempotencyKey: string;
  readonly cause?: unknown;

  constructor(options: {
    workspace: CourseDraftWorkspace;
    courseId: number;
    idempotencyKey: string;
    cause: unknown;
  }) {
    const causeMessage = options.cause instanceof Error ? options.cause.message : "The server rejected the request.";
    super(
      "The course was saved, but its curriculum could not be imported. " +
      `The import is atomic, so no partial outline was saved. ${causeMessage}`,
    );
    this.name = "CourseDraftMaterializationError";
    this.workspace = options.workspace;
    this.courseId = options.courseId;
    this.idempotencyKey = options.idempotencyKey;
    this.cause = options.cause;
  }
}

type MaterializeOptions = {
  onProgress?: (progress: MaterializeCourseDraftProgress) => void;
  /** Primarily useful when deliberately replaying a request after a lost response. */
  idempotencyKey?: string;
};

function parseCreatedId(idValue: unknown, resource: "section" | "lesson"): number {
  const id = Number(idValue);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`The server returned an invalid ${resource} ID.`);
  }
  return id;
}

function createImportIdempotencyKey(workspace: CourseDraftWorkspace, courseId: number): string {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `ai-curriculum-${workspace}-${courseId}-${randomPart}`;
}

type CurriculumImportResponse = {
  sections?: Array<{
    id?: unknown;
    lessons?: Array<{ id?: unknown }>;
  }>;
  counts?: { sections?: unknown; lessons?: unknown };
};

/**
 * Atomically imports a reviewed AI outline. The idempotency key protects a
 * committed import when the browser loses the response and the caller retries.
 * The server transaction guarantees that a failure cannot leave half a course.
 */
export async function materializeAiCourseDraft(
  workspace: CourseDraftWorkspace,
  courseId: number,
  draft: CourseDraft,
  options: MaterializeOptions = {},
): Promise<MaterializedCourseDraft> {
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new Error("A valid course ID is required before creating the curriculum.");
  }
  if (!Array.isArray(draft.sections) || draft.sections.length === 0) {
    throw new Error("The accepted draft does not contain any curriculum modules.");
  }

  const totalLessons = draft.sections.reduce((total, section) => total + section.lessons.length, 0);
  const idempotencyKey = options.idempotencyKey
    ?? createImportIdempotencyKey(workspace, courseId);

  options.onProgress?.({
    stage: "import",
    completedSections: 0,
    completedLessons: 0,
    totalSections: draft.sections.length,
    totalLessons,
  });

  try {
    const response = await apiRequest(
      "POST",
      `/api/${workspace}/courses/${courseId}/curriculum/import`,
      {
        sections: draft.sections.map((section) => ({
          title: section.title.trim().slice(0, 120),
          summary: section.summary.trim().slice(0, 1_000),
          lessons: section.lessons.map((lesson) => ({
            title: lesson.title.trim().slice(0, 160),
            kind: lesson.kind,
            objective: lesson.objective.trim().slice(0, 500),
            durationMinutes: Math.max(1, Math.min(600, Math.round(lesson.durationMinutes))),
            isPreview: lesson.isPreview,
          })),
        })),
      },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    const payload = await response.json() as CurriculumImportResponse;
    if (!Array.isArray(payload.sections)) {
      throw new Error("The server did not return the imported curriculum identifiers.");
    }

    const sectionIds = payload.sections.map((section) => parseCreatedId(section.id, "section"));
    const lessonIds = payload.sections.flatMap((section) => {
      if (!Array.isArray(section.lessons)) {
        throw new Error("The server did not return all imported lesson identifiers.");
      }
      return section.lessons.map((lesson) => parseCreatedId(lesson.id, "lesson"));
    });
    const result: MaterializedCourseDraft = {
      sectionIds,
      lessonIds,
      completedSections: sectionIds.length,
      completedLessons: lessonIds.length,
    };

    if (
      Number(payload.counts?.sections) !== result.completedSections
      || Number(payload.counts?.lessons) !== result.completedLessons
    ) {
      throw new Error("The server returned inconsistent curriculum import counts.");
    }

    options.onProgress?.({
      stage: "import",
      completedSections: result.completedSections,
      completedLessons: result.completedLessons,
      totalSections: draft.sections.length,
      totalLessons,
    });
    return result;
  } catch (cause) {
    throw new CourseDraftMaterializationError({
      workspace,
      courseId,
      idempotencyKey,
      cause,
    });
  }
}
