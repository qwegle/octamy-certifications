export type AssessmentPurpose = "certification" | "practice";

export type PublishableAssessmentQuestion = {
  isActive: boolean;
  reviewStatus: string;
  reviewedBy: number | null;
  reviewedAt: Date | string | null;
  questionFormat: string;
  options: unknown;
  correctAnswer: number;
};

/** Mirrors the fail-closed SQL predicate used by publication and attempts. */
export function isPublishableAssessmentQuestion(
  question: PublishableAssessmentQuestion,
): boolean {
  return question.isActive
    && question.reviewStatus === "approved"
    && question.reviewedBy != null
    && question.reviewedAt != null
    && ["mcq_single", "true_false"].includes(question.questionFormat)
    && Array.isArray(question.options)
    && Number.isInteger(question.correctAnswer)
    && question.correctAnswer >= 0
    && question.correctAnswer < question.options.length;
}

export function questionInventoryRotationMultiplier(
  purpose: AssessmentPurpose,
): number {
  return purpose === "practice" ? 5 : 4;
}

export function requiredQuestionInventory(
  purpose: AssessmentPurpose,
  drawCount: number,
): number {
  const normalizedDraw = Math.max(0, Math.trunc(drawCount));
  return Math.max(
    purpose === "practice" ? 200 : 80,
    normalizedDraw * questionInventoryRotationMultiplier(purpose),
  );
}

export function hasReadyQuestionInventory(
  purpose: AssessmentPurpose,
  drawCount: number,
  approvedInventory: number,
): boolean {
  return Math.max(0, Math.trunc(approvedInventory)) >= requiredQuestionInventory(purpose, drawCount);
}

export type AssessmentBlueprintRuleReadiness = {
  bankId: number;
  topicId: number | null;
  questionCount: number;
  difficulty: string;
  approvedInventory: number;
};

export type AssessmentPublishReadinessInput = {
  purpose: AssessmentPurpose;
  useBlueprintEngine: boolean;
  approvedInventory: number;
  rules: AssessmentBlueprintRuleReadiness[];
};

export type AssessmentPublishReadinessIssue =
  | {
      code: "BLUEPRINT_ENGINE_REQUIRED" | "BLUEPRINT_REQUIRED";
      message: string;
    }
  | {
      code: "BLUEPRINT_RULE_INVENTORY_INCOMPLETE";
      message: string;
      bankId: number;
      topicId: number | null;
      difficulty: string;
      required: number;
      available: number;
    }
  | {
      code: "BLUEPRINT_RULE_SCOPE_OVERLAP";
      message: string;
      bankId: number;
      topicId: number | null;
      difficulty: string;
      conflictingTopicId: number | null;
      conflictingDifficulty: string;
    }
  | {
      code: "ASSESSMENT_INVENTORY_INCOMPLETE";
      message: string;
      required: number;
      available: number;
    };

export type AssessmentPublishReadiness = {
  ready: boolean;
  drawCount: number;
  requiredInventory: number;
  approvedInventory: number;
  issues: AssessmentPublishReadinessIssue[];
};

/**
 * One fail-closed publication policy for every assessment mutation path.
 * Inventory passed to this function must already be limited to active,
 * approved, attributable-review, runtime-compatible questions.
 */
export function evaluateAssessmentPublishReadiness(
  input: AssessmentPublishReadinessInput,
): AssessmentPublishReadiness {
  const approvedInventory = Math.max(0, Math.trunc(input.approvedInventory));
  const drawCount = input.rules.reduce(
    (total, rule) => total + Math.max(0, Math.trunc(rule.questionCount)),
    0,
  );
  const requiredInventory = requiredQuestionInventory(input.purpose, drawCount);
  const issues: AssessmentPublishReadinessIssue[] = [];

  if (!input.useBlueprintEngine) {
    issues.push({
      code: "BLUEPRINT_ENGINE_REQUIRED",
      message: "Enable the reviewed question-bank blueprint before publishing this assessment.",
    });
  }

  if (input.rules.length === 0 || drawCount === 0) {
    issues.push({
      code: "BLUEPRINT_REQUIRED",
      message: "Add at least one question-bank blueprint rule before publishing this assessment.",
    });
  }

  const rotationMultiplier = questionInventoryRotationMultiplier(input.purpose);
  for (let leftIndex = 0; leftIndex < input.rules.length; leftIndex += 1) {
    const left = input.rules[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < input.rules.length; rightIndex += 1) {
      const right = input.rules[rightIndex];
      if (left.bankId !== right.bankId) continue;
      const topicsOverlap = left.topicId == null
        || right.topicId == null
        || left.topicId === right.topicId;
      const difficultiesOverlap = left.difficulty === "mixed"
        || right.difficulty === "mixed"
        || left.difficulty === right.difficulty;
      if (!topicsOverlap || !difficultiesOverlap) continue;
      issues.push({
        code: "BLUEPRINT_RULE_SCOPE_OVERLAP",
        message: `Question bank ${left.bankId} has overlapping blueprint scopes (${left.topicId ?? "all topics"}/${left.difficulty} and ${right.topicId ?? "all topics"}/${right.difficulty}); distinct rotation inventory cannot be proven.`,
        bankId: left.bankId,
        topicId: left.topicId,
        difficulty: left.difficulty,
        conflictingTopicId: right.topicId,
        conflictingDifficulty: right.difficulty,
      });
    }
  }

  for (const rule of input.rules) {
    const required = Math.max(0, Math.trunc(rule.questionCount)) * rotationMultiplier;
    const available = Math.max(0, Math.trunc(rule.approvedInventory));
    if (available < required) {
      issues.push({
        code: "BLUEPRINT_RULE_INVENTORY_INCOMPLETE",
        message: `Question bank ${rule.bankId}${rule.topicId ? ` / topic ${rule.topicId}` : ""} needs ${required} approved ${rule.difficulty} questions before publication; ${available} are ready.`,
        bankId: rule.bankId,
        topicId: rule.topicId,
        difficulty: rule.difficulty,
        required,
        available,
      });
    }
  }

  if (!hasReadyQuestionInventory(input.purpose, drawCount, approvedInventory)) {
    issues.push({
      code: "ASSESSMENT_INVENTORY_INCOMPLETE",
      message: `This assessment needs ${requiredInventory} approved questions across its assigned banks before publication; ${approvedInventory} are ready.`,
      required: requiredInventory,
      available: approvedInventory,
    });
  }

  return {
    ready: issues.length === 0,
    drawCount,
    requiredInventory,
    approvedInventory,
    issues,
  };
}

export type AssessmentPublicationState = {
  productType: string;
  visibility: string;
  reviewStatus: string;
  isActive: boolean;
  assessmentPurpose?: string;
  useBlueprintEngine?: boolean;
};

export function isPublishedAssessment(
  state: AssessmentPublicationState,
): boolean {
  return state.productType === "assessment"
    && state.isActive
    && state.visibility === "public"
    && state.reviewStatus === "approved";
}

/**
 * A public, approved, or active transition can make an assessment reachable
 * through one of the platform's catalog/access paths. Existing published
 * assessments are also checked when a readiness-critical field changes;
 * routine metadata edits do not become unexpectedly blocked.
 */
export function requiresAssessmentPublishReadiness(
  previous: AssessmentPublicationState | null,
  next: AssessmentPublicationState,
): boolean {
  if (next.productType !== "assessment") return false;

  if (!previous) {
    // A newly-created public draft is not exposed because it is inactive and
    // unapproved. Creation cannot attach a blueprint atomically, so only an
    // activation/approval request is rejected here.
    return next.isActive || next.reviewStatus === "approved";
  }

  const readinessCriticalFieldChanged = (
    previous.assessmentPurpose !== next.assessmentPurpose
    || previous.useBlueprintEngine !== next.useBlueprintEngine
  );

  return (
    (!previous.isActive && next.isActive)
    || (previous.visibility !== "public" && next.visibility === "public")
    || (previous.reviewStatus !== "approved" && next.reviewStatus === "approved")
    || (previous.productType !== "assessment"
      && (next.isActive || next.visibility === "public" || next.reviewStatus === "approved"))
    || (isPublishedAssessment(next) && readinessCriticalFieldChanged)
  );
}
