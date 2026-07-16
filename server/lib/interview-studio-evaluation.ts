import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  interviewStudioEvaluationJobs,
  interviewStudioResponses,
  interviewStudioSessions,
} from "@shared/schema";
import {
  canonicalizeInterviewStudioBlueprint,
  interviewStudioBlueprintSchema,
  interviewStudioItemEvaluationSchema,
  interviewStudioOverallEvaluationSchema,
  type InterviewStudioBlueprint,
  type InterviewStudioBlueprintItem,
  type InterviewStudioCodingItem,
  type InterviewStudioItemEvaluation,
  type InterviewStudioOverallEvaluation,
  type InterviewStudioTestRunResult,
} from "@shared/interview-studio";
import { db } from "../db";
import { audit } from "./audit";
import { isCodeRunnerEnabled, runInterviewCode } from "./code-runner";
import {
  INTERVIEW_AI_PROMPT_VERSION,
  configuredInterviewAiModel,
  evaluateInterviewCodeQuality,
  evaluateInterviewStructuredResponse,
  isInterviewAiEnabled,
  type InterviewAiCodeQualityFeedback,
} from "./interview-ai";
import { aggregateInterviewScores } from "./interview-studio-policy";
import { logger } from "./logger";

type InterviewStudioSessionRow = typeof interviewStudioSessions.$inferSelect;
type InterviewStudioResponseRow = typeof interviewStudioResponses.$inferSelect;

export type PreparedInterviewStudioEvaluation = {
  session: InterviewStudioSessionRow;
  responseUpdates: Array<{
    responseId: number;
    evaluation: InterviewStudioItemEvaluation;
    finalTestResult: InterviewStudioTestRunResult | null;
  }>;
  overall: InterviewStudioOverallEvaluation;
  finalSessionStatus: "completed" | "review_required";
  totalItems: number;
  scoredItems: number;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function parseBlueprint(session: InterviewStudioSessionRow): InterviewStudioBlueprint {
  const blueprint = interviewStudioBlueprintSchema.parse(session.blueprintSnapshot);
  const actualHash = sha256(canonicalizeInterviewStudioBlueprint(blueprint));
  if (actualHash !== session.blueprintHash) {
    throw Object.assign(new Error("Interview blueprint integrity check failed"), {
      code: "INTERVIEW_BLUEPRINT_INTEGRITY_FAILED",
    });
  }
  return blueprint;
}

export function interviewCodeTestScore(
  item: InterviewStudioCodingItem,
  result: InterviewStudioTestRunResult,
): number | null {
  if (result.totalCount <= 0) return null;
  const resultByKey = new Map(result.cases.map((testCase) => [testCase.testCaseKey, testCase]));
  const coveredCases = item.testCases.filter((testCase) => resultByKey.has(testCase.key));
  const totalWeight = coveredCases.reduce((total, testCase) => total + testCase.weight, 0);
  if (totalWeight <= 0) return null;
  const passedWeight = coveredCases.reduce((total, testCase) => (
    resultByKey.get(testCase.key)?.passed ? total + testCase.weight : total
  ), 0);
  return Math.round((passedWeight / totalWeight) * 100);
}

export function buildInterviewCodeEvaluation(
  item: InterviewStudioCodingItem,
  result: InterviewStudioTestRunResult,
  now = new Date(),
  qualityFeedback?: InterviewAiCodeQualityFeedback,
): InterviewStudioItemEvaluation {
  const score = interviewCodeTestScore(item, result);
  const correctnessCriterion = item.rubric.find((criterion) => criterion.key === "correctness");
  const unscoredCriteria = item.rubric.filter((criterion) => criterion.key !== "correctness");
  const correctnessAvailable = score != null
    && result.status !== "runner_unavailable"
    && Boolean(correctnessCriterion);
  const qualityScores = new Map(
    (qualityFeedback?.criterionScores ?? []).map((criterion) => [criterion.criterionKey, criterion]),
  );
  const qualityCoverageComplete = unscoredCriteria.every((criterion) => qualityScores.has(criterion.key));
  const needsReview = !correctnessAvailable
    || !qualityCoverageComplete
    || Boolean(qualityFeedback?.humanReviewRequired)
    || Boolean(qualityFeedback?.humanReviewReasons.length);
  const criterionScores = [
    ...(correctnessAvailable ? [{
      criterionKey: correctnessCriterion!.key,
      score: score ?? 0,
      evidence: `${result.passedCount} of ${result.totalCount} deterministic tests passed.`,
    }] : []),
    ...unscoredCriteria.flatMap((criterion) => {
      const quality = qualityScores.get(criterion.key);
      return quality ? [quality] : [];
    }),
  ];
  const totalRubricWeight = item.rubric.reduce((total, criterion) => total + criterion.weight, 0);
  const combinedScore = !needsReview && totalRubricWeight > 0
    ? Math.round(item.rubric.reduce((total, criterion) => {
      const criterionScore = criterionScores.find((entry) => entry.criterionKey === criterion.key)?.score ?? 0;
      return total + criterionScore * criterion.weight;
    }, 0) / totalRubricWeight)
    : null;
  return interviewStudioItemEvaluationSchema.parse({
    rubricVersion: "coding-tests-v1",
    status: needsReview ? "review_required" : "completed",
    // Deterministic tests score correctness only. A rubric dimension such as
    // maintainability is never fabricated from pass/fail test output.
    score: combinedScore,
    criterionScores,
    strengths: [
      ...(score === 100 ? ["The solution passed every public and hidden correctness test."] : []),
      ...(qualityFeedback?.strengths ?? []),
    ],
    improvementAreas: [
      ...(score != null && score < 100 ? ["Review the failing edge cases and revise the solution."] : []),
      ...(!qualityCoverageComplete && unscoredCriteria.length
        ? [`${unscoredCriteria.map((criterion) => criterion.label).join(", ")} still requires human review; Octamy did not invent that score.`]
        : []),
      ...(qualityFeedback?.improvementAreas ?? []),
      ...(qualityFeedback?.humanReviewReasons ?? []),
    ],
    followUpQuestions: qualityFeedback?.followUpQuestions ?? [],
    model: qualityFeedback?.model ?? null,
    promptVersion: qualityFeedback?.promptVersion ?? "deterministic-code-tests-v1",
    evaluatedAt: now.toISOString(),
  });
}

export function buildInterviewOverallEvaluation(input: {
  blueprint: InterviewStudioBlueprint;
  evaluations: Array<{ item: InterviewStudioBlueprintItem; evaluation: InterviewStudioItemEvaluation }>;
  aiRequested: boolean;
  aiConfigured: boolean;
  runnerConfigured: boolean;
  aiLimitReached?: boolean;
  runnerLimitReached?: boolean;
  now?: Date;
}): InterviewStudioOverallEvaluation {
  const aggregate = aggregateInterviewScores(input.blueprint.items.map((item) => ({
    score: input.evaluations.find((entry) => entry.item.key === item.key)?.evaluation.score,
  })));
  const allItemsCovered = input.evaluations.length === input.blueprint.items.length;
  const allItemsComplete = allItemsCovered
    && input.evaluations.every((entry) => entry.evaluation.status === "completed" && entry.evaluation.score != null);
  const score = allItemsComplete && aggregate.coveragePercent === 100 && aggregate.score != null
    ? Math.round(aggregate.score)
    : null;
  const requiresAi = input.blueprint.items.some((item) => item.kind === "structured_response"
    || item.rubric.some((criterion) => criterion.key !== "correctness"));
  const requiresRunner = input.blueprint.items.some((item) => item.kind === "coding");
  if (!input.aiRequested) {
    return interviewStudioOverallEvaluationSchema.parse({
      rubricVersion: input.blueprint.rubricVersion,
      score: null,
      status: "not_requested",
      competencyEvidence: input.evaluations.map(({ item, evaluation }) => ({
        competency: item.competency,
        score: null,
        evidence: evaluation.criterionScores.map((criterion) => criterion.evidence),
      })),
      summary: "Your answers are saved. You chose not to request AI evaluation, so Octamy did not generate a score.",
      strengths: [],
      improvementAreas: input.evaluations.flatMap((entry) => entry.evaluation.improvementAreas).slice(0, 12),
      humanReviewReasons: [],
      model: null,
      promptVersion: null,
      evaluatedAt: (input.now ?? new Date()).toISOString(),
    });
  }
  const reviewReasons = [
    ...(requiresAi && input.aiLimitReached
      ? ["The account's daily AI-feedback allowance was reached; affected rubric criteria were left unscored."]
      : requiresAi && !input.aiConfigured
        ? ["Requested AI practice feedback was unavailable; affected rubric criteria were left unscored."]
        : []),
    ...(requiresRunner && input.runnerLimitReached
      ? ["The account's daily isolated-runner allowance was reached; coding correctness was left unscored."]
      : requiresRunner && !input.runnerConfigured
        ? ["The isolated runner was unavailable; coding correctness was not scored."]
        : []),
    ...(!allItemsCovered
      ? [`${input.blueprint.items.length - input.evaluations.length} interview item(s) had no submitted response.`]
      : []),
    ...(input.evaluations.some((entry) => entry.evaluation.status === "review_required")
      ? ["At least one response remains incomplete or unreliable, so a complete score would not be defensible."]
      : []),
  ];
  return interviewStudioOverallEvaluationSchema.parse({
    rubricVersion: input.blueprint.rubricVersion,
    score,
    status: reviewReasons.length === 0 && allItemsComplete ? "completed" : "review_required",
    competencyEvidence: input.evaluations.map(({ item, evaluation }) => ({
      competency: item.competency,
      score: evaluation.score,
      evidence: evaluation.criterionScores.map((criterion) => criterion.evidence),
    })),
    summary: score == null
      ? "Your responses are saved. Incomplete or unavailable feedback was left unscored instead of being guessed."
      : `Practice feedback covered ${input.evaluations.length} interview items. This is preparation evidence, not a hiring decision.`,
    strengths: input.evaluations.flatMap((entry) => entry.evaluation.strengths).slice(0, 12),
    improvementAreas: input.evaluations.flatMap((entry) => entry.evaluation.improvementAreas).slice(0, 12),
    humanReviewReasons: reviewReasons,
    model: input.aiConfigured ? configuredInterviewAiModel(process.env) : null,
    promptVersion: input.aiConfigured ? INTERVIEW_AI_PROMPT_VERSION : null,
    evaluatedAt: (input.now ?? new Date()).toISOString(),
  });
}

function unavailableItemEvaluation(input: {
  rubricVersion: string;
  promptVersion: string | null;
  improvement: string;
}): InterviewStudioItemEvaluation {
  return interviewStudioItemEvaluationSchema.parse({
    rubricVersion: input.rubricVersion,
    status: "review_required",
    score: null,
    criterionScores: [],
    strengths: [],
    improvementAreas: [input.improvement],
    followUpQuestions: [],
    model: null,
    promptVersion: input.promptVersion,
    evaluatedAt: new Date().toISOString(),
  });
}

function safeEvaluationErrorCode(error: unknown): string {
  const candidate = (error as { code?: unknown })?.code;
  if (typeof candidate === "string" && /^[A-Z0-9_]{3,80}$/.test(candidate)) return candidate;
  const status = (error as { status?: unknown })?.status;
  if (typeof status === "number" && status === 429) return "PROVIDER_RATE_LIMITED";
  if (typeof status === "number" && status >= 500) return "PROVIDER_UNAVAILABLE";
  return "EVALUATION_STEP_FAILED";
}

export function isRetryableInterviewEvaluationError(error: unknown): boolean {
  const code = safeEvaluationErrorCode(error);
  const status = (error as { status?: unknown })?.status;
  return code === "INTERVIEW_AI_TIMEOUT"
    || code === "INTERVIEW_AI_UNAVAILABLE"
    || code === "CODE_RUNNER_UNAVAILABLE"
    || code === "WORKER_ABORTED"
    || (typeof status === "number" && (status === 429 || status >= 500));
}

async function assertEvaluationStillActive(sessionId: string, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw Object.assign(new Error("Evaluation worker stopped"), { code: "WORKER_ABORTED" });
  }
  const [active] = await db.select({ status: interviewStudioSessions.status })
    .from(interviewStudioSessions)
    .where(eq(interviewStudioSessions.id, sessionId))
    .limit(1);
  if (active?.status !== "evaluating") {
    throw Object.assign(new Error("Interview evaluation was cancelled"), {
      code: "EVALUATION_CANCELLED",
    });
  }
}

/**
 * Calls external evaluators but does not write partial results. The worker
 * commits every response, the overall report and the job terminal state in one
 * transaction, so a crash can safely rerun this preparation step.
 */
export async function prepareInterviewStudioEvaluation(
  sessionId: string,
  signal?: AbortSignal,
  allowances: { aiEvaluationAllowed: boolean; codeRunnerAllowed: boolean } = {
    aiEvaluationAllowed: true,
    codeRunnerAllowed: true,
  },
): Promise<PreparedInterviewStudioEvaluation | null> {
  const [session] = await db.select().from(interviewStudioSessions)
    .where(eq(interviewStudioSessions.id, sessionId)).limit(1);
  if (!session || session.status !== "evaluating") return null;
  const blueprint = parseBlueprint(session);
  const responses = await db.select().from(interviewStudioResponses)
    .where(eq(interviewStudioResponses.sessionId, session.id));
  const responseByKey = new Map(responses.map((response) => [response.itemKey, response]));
  const evaluations: Array<{ item: InterviewStudioBlueprintItem; evaluation: InterviewStudioItemEvaluation }> = [];
  const responseUpdates: PreparedInterviewStudioEvaluation["responseUpdates"] = [];
  const aiRequested = session.consentSnapshot.aiEvaluation;
  const aiProviderConfigured = isInterviewAiEnabled(process.env);
  const runnerProviderConfigured = isCodeRunnerEnabled(process.env);
  const aiConfigured = aiRequested && aiProviderConfigured && allowances.aiEvaluationAllowed;
  const runnerConfigured = runnerProviderConfigured && allowances.codeRunnerAllowed;

  for (const item of blueprint.items) {
    // Deletion/retention first changes an evaluating session to cancelled.
    // Re-check before every provider boundary so cached answers are not sent
    // to any later provider call after cancellation.
    await assertEvaluationStillActive(session.id, signal);
    const response = responseByKey.get(item.key);
    if (!response) continue;
    let evaluation: InterviewStudioItemEvaluation;
    let finalTestResult: InterviewStudioTestRunResult | null = null;
    if (item.kind === "coding") {
      let qualityFeedback: InterviewAiCodeQualityFeedback | undefined;
      if (runnerConfigured && response.code) {
        try {
          await assertEvaluationStillActive(session.id, signal);
          finalTestResult = await runInterviewCode({ sourceCode: response.code, item, scope: "all", signal });
          await assertEvaluationStillActive(session.id, signal);
          if (finalTestResult.status === "runner_unavailable") {
            throw Object.assign(new Error("The isolated runner is temporarily unavailable"), {
              code: "CODE_RUNNER_UNAVAILABLE",
              status: 503,
            });
          }
          const requiresQualityFeedback = item.rubric.some((criterion) => criterion.key !== "correctness");
          if (aiConfigured && requiresQualityFeedback) {
            try {
              await assertEvaluationStillActive(session.id, signal);
              qualityFeedback = await evaluateInterviewCodeQuality({
                blueprint,
                item,
                sourceCode: response.code,
                deterministicEvidence: {
                  status: finalTestResult.status,
                  passedCount: finalTestResult.passedCount,
                  totalCount: finalTestResult.totalCount,
                },
                signal,
              });
              await assertEvaluationStillActive(session.id, signal);
            } catch (error) {
              if (safeEvaluationErrorCode(error) === "EVALUATION_CANCELLED"
                || isRetryableInterviewEvaluationError(error)) throw error;
              logger.warn("interview_studio.code_quality_evaluation_failed", {
                sessionId: session.id,
                itemKey: item.key,
                errorCode: safeEvaluationErrorCode(error),
              });
            }
          }
          evaluation = buildInterviewCodeEvaluation(item, finalTestResult, new Date(), qualityFeedback);
        } catch (error) {
          if (safeEvaluationErrorCode(error) === "EVALUATION_CANCELLED"
            || isRetryableInterviewEvaluationError(error)) throw error;
          logger.warn("interview_studio.final_run_failed", {
            sessionId: session.id,
            itemKey: item.key,
            errorCode: safeEvaluationErrorCode(error),
          });
          evaluation = unavailableItemEvaluation({
            rubricVersion: "coding-tests-v1",
            promptVersion: "deterministic-code-tests-v1",
            improvement: "The isolated code service could not complete this run; no correctness score was invented.",
          });
        }
      } else {
        evaluation = unavailableItemEvaluation({
          rubricVersion: "coding-tests-v1",
          promptVersion: "deterministic-code-tests-v1",
          improvement: "Run this solution again when the isolated code service is available.",
        });
      }
      if (!aiRequested) {
        evaluation = interviewStudioItemEvaluationSchema.parse({
          ...evaluation,
          status: "not_requested",
          score: null,
          model: null,
          promptVersion: null,
          improvementAreas: [
            ...evaluation.improvementAreas,
            "AI code-quality feedback was not requested.",
          ].slice(0, 20),
        });
      }
    } else if (aiConfigured && response.answerText) {
      try {
        await assertEvaluationStillActive(session.id, signal);
        evaluation = await evaluateInterviewStructuredResponse({
          blueprint,
          item,
          responseText: response.answerText,
          signal,
        });
        await assertEvaluationStillActive(session.id, signal);
      } catch (error) {
        if (safeEvaluationErrorCode(error) === "EVALUATION_CANCELLED"
          || isRetryableInterviewEvaluationError(error)) throw error;
        logger.warn("interview_studio.ai_evaluation_failed", {
          sessionId: session.id,
          itemKey: item.key,
          errorCode: safeEvaluationErrorCode(error),
        });
        evaluation = unavailableItemEvaluation({
          rubricVersion: blueprint.rubricVersion,
          promptVersion: INTERVIEW_AI_PROMPT_VERSION,
          improvement: "AI feedback was temporarily unavailable; no score was invented.",
        });
      }
    } else if (aiRequested) {
      evaluation = unavailableItemEvaluation({
        rubricVersion: blueprint.rubricVersion,
        promptVersion: INTERVIEW_AI_PROMPT_VERSION,
        improvement: "Requested AI feedback was unavailable; no score was invented.",
      });
    } else {
      evaluation = interviewStudioItemEvaluationSchema.parse({
        rubricVersion: blueprint.rubricVersion,
        status: "not_requested",
        score: null,
        criterionScores: [],
        strengths: [],
        improvementAreas: [],
        followUpQuestions: [],
        model: null,
        promptVersion: null,
        evaluatedAt: null,
      });
    }
    evaluations.push({ item, evaluation });
    responseUpdates.push({ responseId: response.id, evaluation, finalTestResult });
  }

  await assertEvaluationStillActive(session.id, signal);
  const overall = buildInterviewOverallEvaluation({
    blueprint,
    evaluations,
    aiRequested,
    aiConfigured,
    runnerConfigured,
    aiLimitReached: aiRequested && aiProviderConfigured && !allowances.aiEvaluationAllowed,
    runnerLimitReached: runnerProviderConfigured && !allowances.codeRunnerAllowed,
  });
  return {
    session,
    responseUpdates,
    overall,
    // Private practice has no hidden human-review queue. It closes as a
    // completed practice even when some automated feedback remains unscored.
    // Verified mode is deliberately unreleased and continues to fail closed.
    finalSessionStatus: session.mode === "verified" ? "review_required" : "completed",
    totalItems: blueprint.items.length,
    scoredItems: evaluations.filter((entry) => entry.evaluation.score != null).length,
  };
}

/** Atomically publishes prepared results only while this worker still owns the lease. */
export async function commitInterviewStudioEvaluation(input: {
  jobId: string;
  workerId: string;
  prepared: PreparedInterviewStudioEvaluation;
}): Promise<boolean> {
  const now = new Date();
  const committed = await db.transaction(async (tx) => {
    const leaseResult: any = await tx.execute(sql`
      SELECT id
      FROM interview_studio_evaluation_jobs
      WHERE id = ${input.jobId}
        AND status = 'running'
        AND locked_by = ${input.workerId}
      FOR UPDATE
    `);
    if ((leaseResult.rowCount ?? leaseResult.rows?.length ?? 0) !== 1) return false;

    const sessionResult: any = await tx.execute(sql`
      SELECT status
      FROM interview_studio_sessions
      WHERE id = ${input.prepared.session.id}
      FOR UPDATE
    `);
    const sessionStatus = sessionResult.rows?.[0]?.status;
    if (sessionStatus === "completed" || sessionStatus === "review_required") {
      await tx.update(interviewStudioEvaluationJobs).set({
        status: "completed",
        lockedAt: null,
        lockedBy: null,
        completedAt: now,
        lastErrorCode: null,
        updatedAt: now,
      }).where(eq(interviewStudioEvaluationJobs.id, input.jobId));
      return true;
    }
    if (sessionStatus !== "evaluating") return false;

    for (const update of input.prepared.responseUpdates) {
      await tx.update(interviewStudioResponses).set({
        finalTestResult: update.finalTestResult,
        evaluationStatus: update.evaluation.status,
        evaluation: update.evaluation,
        evaluationModel: update.evaluation.model,
        evaluationPromptVersion: update.evaluation.promptVersion,
        isFinal: true,
        finalizedAt: now,
        updatedAt: now,
      }).where(and(
        eq(interviewStudioResponses.id, update.responseId),
        eq(interviewStudioResponses.sessionId, input.prepared.session.id),
      ));
    }

    const [sessionUpdated] = await tx.update(interviewStudioSessions).set({
      status: input.prepared.finalSessionStatus,
      evaluationStatus: input.prepared.overall.status,
      overallScore: input.prepared.overall.score,
      evaluation: input.prepared.overall,
      evaluationModel: input.prepared.overall.model,
      evaluationPromptVersion: input.prepared.overall.promptVersion,
      evaluationCompletedAt: now,
      completedAt: now,
      updatedAt: now,
    }).where(and(
      eq(interviewStudioSessions.id, input.prepared.session.id),
      eq(interviewStudioSessions.status, "evaluating"),
    )).returning({ id: interviewStudioSessions.id });
    if (!sessionUpdated) return false;

    await tx.update(interviewStudioEvaluationJobs).set({
      status: "completed",
      lockedAt: null,
      lockedBy: null,
      completedAt: now,
      lastErrorCode: null,
      updatedAt: now,
    }).where(and(
      eq(interviewStudioEvaluationJobs.id, input.jobId),
      eq(interviewStudioEvaluationJobs.status, "running"),
      eq(interviewStudioEvaluationJobs.lockedBy, input.workerId),
    ));
    return true;
  });

  if (committed) {
    await audit({
      action: "interview_studio.evaluation_completed",
      userId: input.prepared.session.userId,
      actorRole: "system",
      resourceType: "interview_studio_session",
      resourceId: input.prepared.session.id,
      metadata: {
        mode: input.prepared.session.mode,
        evaluationStatus: input.prepared.overall.status,
        scoredItems: input.prepared.scoredItems,
        totalItems: input.prepared.totalItems,
      },
    });
  }
  return committed;
}

export function buildTerminalEvaluationFailure(
  session: InterviewStudioSessionRow,
  now = new Date(),
): InterviewStudioOverallEvaluation {
  const blueprint = parseBlueprint(session);
  return interviewStudioOverallEvaluationSchema.parse({
    rubricVersion: blueprint.rubricVersion,
    score: null,
    status: "review_required",
    competencyEvidence: [],
    summary: "Your responses are safely stored, but automated feedback could not be completed after the retry allowance. No score was invented.",
    strengths: [],
    improvementAreas: [],
    humanReviewReasons: ["No human review was queued. Start a new private practice session if you want to request automated feedback again."],
    model: null,
    promptVersion: null,
    evaluatedAt: now.toISOString(),
  });
}

export async function finalizeInterviewStudioEvaluationFailure(input: {
  jobId: string;
  sessionId: string;
  workerId: string;
  errorCode: string;
}): Promise<boolean> {
  const now = new Date();
  const [session] = await db.select().from(interviewStudioSessions)
    .where(eq(interviewStudioSessions.id, input.sessionId)).limit(1);
  if (!session) return false;
  const fallback = buildTerminalEvaluationFailure(session, now);
  const finalized = await db.transaction(async (tx) => {
    const leaseResult: any = await tx.execute(sql`
      SELECT id
      FROM interview_studio_evaluation_jobs
      WHERE id = ${input.jobId}
        AND status = 'running'
        AND locked_by = ${input.workerId}
      FOR UPDATE
    `);
    if ((leaseResult.rowCount ?? leaseResult.rows?.length ?? 0) !== 1) return false;

    const sessionResult: any = await tx.execute(sql`
      SELECT status
      FROM interview_studio_sessions
      WHERE id = ${input.sessionId}
      FOR UPDATE
    `);
    if (sessionResult.rows?.[0]?.status === "evaluating") {
      await tx.update(interviewStudioResponses).set({
        evaluationStatus: "failed",
        isFinal: true,
        finalizedAt: now,
        updatedAt: now,
      }).where(and(
        eq(interviewStudioResponses.sessionId, input.sessionId),
        eq(interviewStudioResponses.isFinal, false),
      ));
      await tx.update(interviewStudioSessions).set({
        status: session.mode === "verified" ? "review_required" : "completed",
        evaluationStatus: "failed",
        overallScore: null,
        evaluation: fallback,
        evaluationModel: null,
        evaluationPromptVersion: null,
        evaluationCompletedAt: now,
        completedAt: now,
        updatedAt: now,
      }).where(and(
        eq(interviewStudioSessions.id, input.sessionId),
        eq(interviewStudioSessions.status, "evaluating"),
      ));
    }
    await tx.update(interviewStudioEvaluationJobs).set({
      status: "failed",
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: input.errorCode,
      completedAt: now,
      updatedAt: now,
    }).where(and(
      eq(interviewStudioEvaluationJobs.id, input.jobId),
      eq(interviewStudioEvaluationJobs.status, "running"),
      eq(interviewStudioEvaluationJobs.lockedBy, input.workerId),
    ));
    return true;
  });
  if (finalized) {
    await audit({
      action: "interview_studio.evaluation_failed",
      userId: session.userId,
      actorRole: "system",
      resourceType: "interview_studio_session",
      resourceId: session.id,
      status: "failure",
      metadata: { errorCode: input.errorCode },
    });
  }
  return finalized;
}

export type { InterviewStudioResponseRow };
