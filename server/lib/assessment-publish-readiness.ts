import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import {
  courseQuestionBlueprint,
  questionBanks,
  questions,
} from "@shared/schema";
import { db } from "../db";
import {
  evaluateAssessmentPublishReadiness,
  requiresAssessmentPublishReadiness,
  type AssessmentPublicationState,
  type AssessmentPublishReadiness,
  type AssessmentPurpose,
} from "./assessment-bank-readiness";

export type AssessmentPublishCourseState = AssessmentPublicationState & {
  assessmentPurpose: string;
  useBlueprintEngine: boolean;
};

export class AssessmentPublishReadinessError extends Error {
  readonly code = "ASSESSMENT_BANK_NOT_READY";

  constructor(
    message: string,
    readonly readiness?: AssessmentPublishReadiness,
  ) {
    super(message);
    this.name = "AssessmentPublishReadinessError";
  }
}

const eligibleQuestionFilters = [
  eq(questions.isActive, true),
  eq(questions.reviewStatus, "approved"),
  isNotNull(questions.reviewedBy),
  isNotNull(questions.reviewedAt),
  sql`${questions.questionFormat} IN ('mcq_single', 'true_false')`,
  sql`json_typeof(${questions.options}) = 'array'`,
  sql`${questions.correctAnswer} >= 0`,
  sql`${questions.correctAnswer} < json_array_length(${questions.options})`,
];

function assessmentPurpose(value: string): AssessmentPurpose {
  return value === "practice" ? "practice" : "certification";
}

async function loadAssessmentPublishReadiness(
  courseId: number,
  course: AssessmentPublishCourseState,
  executor: any = db,
): Promise<AssessmentPublishReadiness> {
  const purpose = assessmentPurpose(course.assessmentPurpose);
  const blueprint = await executor
    .select({
      bankId: courseQuestionBlueprint.bankId,
      topicId: courseQuestionBlueprint.topicId,
      questionCount: courseQuestionBlueprint.questionCount,
      difficulty: courseQuestionBlueprint.difficulty,
      bankPurpose: questionBanks.bankPurpose,
      bankStatus: questionBanks.status,
    })
    .from(courseQuestionBlueprint)
    .innerJoin(questionBanks, eq(questionBanks.id, courseQuestionBlueprint.bankId))
    .where(eq(courseQuestionBlueprint.courseId, courseId));

  const rules = await Promise.all(blueprint.map(async (rule: {
    bankId: number;
    topicId: number | null;
    questionCount: number;
    difficulty: string;
    bankPurpose: string;
    bankStatus: string;
  }) => {
    if (rule.bankPurpose !== purpose || rule.bankStatus !== "active") {
      return { ...rule, approvedInventory: 0 };
    }
    const filters = [
      eq(questions.bankId, rule.bankId),
      ...eligibleQuestionFilters,
    ];
    if (rule.topicId) filters.push(eq(questions.topicId, rule.topicId));
    if (rule.difficulty !== "mixed") {
      filters.push(eq(questions.difficulty, rule.difficulty));
    }
    const [inventory] = await executor
      .select({ approvedInventory: count() })
      .from(questions)
      .where(and(...filters));
    return {
      ...rule,
      approvedInventory: Number(inventory?.approvedInventory || 0),
    };
  }));

  const [inventory] = blueprint.length > 0
    ? await executor
      .select({ approvedInventory: count() })
      .from(questions)
      .where(and(
        ...eligibleQuestionFilters,
        sql`EXISTS (
          SELECT 1
          FROM ${courseQuestionBlueprint} scoped_rule
          INNER JOIN ${questionBanks} scoped_bank
            ON scoped_bank.id = scoped_rule.bank_id
           AND scoped_bank.bank_purpose = ${purpose}
           AND scoped_bank.status = 'active'
          WHERE scoped_rule.course_id = ${courseId}
            AND scoped_rule.bank_id = ${questions.bankId}
            AND (scoped_rule.topic_id IS NULL OR scoped_rule.topic_id = ${questions.topicId})
            AND (scoped_rule.difficulty = 'mixed' OR scoped_rule.difficulty = ${questions.difficulty})
        )`,
      ))
    : [{ approvedInventory: 0 }];

  return evaluateAssessmentPublishReadiness({
    purpose,
    useBlueprintEngine: course.useBlueprintEngine,
    approvedInventory: Number(inventory?.approvedInventory || 0),
    rules,
  });
}

/**
 * Enforces publication readiness before a course mutation is persisted. The
 * same assertion is shared by create, update, and review/approval handlers so
 * none of those generic APIs can bypass the reviewed blueprint policy.
 */
export async function assertAssessmentPublishReadiness(input: {
  courseId: number | null;
  previous: AssessmentPublishCourseState | null;
  next: AssessmentPublishCourseState;
  executor?: any;
}): Promise<void> {
  if (!requiresAssessmentPublishReadiness(input.previous, input.next)) return;

  if (input.courseId == null) {
    throw new AssessmentPublishReadinessError(
      "Save this assessment as a draft, add and review its question-bank blueprint, then publish it.",
    );
  }

  const readiness = await loadAssessmentPublishReadiness(
    input.courseId,
    input.next,
    input.executor ?? db,
  );
  if (!readiness.ready) {
    throw new AssessmentPublishReadinessError(
      readiness.issues[0]?.message
        || "Complete and review the question-bank blueprint before publishing this assessment.",
      readiness,
    );
  }
}

/**
 * A question becoming ineligible invalidates every live assessment that draws
 * from its bank. Keep the question mutation and this fail-closed catalogue
 * transition in one database transaction.
 */
export async function unpublishPublishedAssessmentsUsingBanks(
  executor: any,
  bankIdsInput: readonly number[],
): Promise<number> {
  const bankIds = Array.from(new Set(
    bankIdsInput.filter((id) => Number.isInteger(id) && id > 0),
  ));
  if (bankIds.length === 0) return 0;

  // Lock every linked assessment, including drafts. If a question withdrawal
  // races a publication request, one transaction must finish before the other
  // evaluates readiness; otherwise the withdrawal could miss the still-draft
  // course and a stale publisher could make it live afterward.
  await executor.execute(sql`
    SELECT course.id
      FROM courses course
     WHERE EXISTS (
       SELECT 1
         FROM course_question_blueprint blueprint
        WHERE blueprint.course_id = course.id
          AND blueprint.bank_id IN (${sql.join(bankIds.map((id) => sql`${id}`), sql`,`)})
     )
     ORDER BY course.id
     FOR UPDATE
  `);

  const result = await executor.execute(sql`
    UPDATE courses course
       SET is_active = false,
           visibility = 'private',
           review_status = 'pending',
           subscription_eligible = false,
           featured_at = null
     WHERE course.product_type = 'assessment'
       AND course.is_active = true
       AND course.visibility = 'public'
       AND course.review_status = 'approved'
       AND EXISTS (
         SELECT 1
           FROM course_question_blueprint blueprint
          WHERE blueprint.course_id = course.id
            AND blueprint.bank_id IN (${sql.join(bankIds.map((id) => sql`${id}`), sql`,`)})
       )
  `);
  return Number(result.rowCount || 0);
}
