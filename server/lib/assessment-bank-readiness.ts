export type AssessmentPurpose = "certification" | "practice";

export function requiredQuestionInventory(
  purpose: AssessmentPurpose,
  drawCount: number,
): number {
  const normalizedDraw = Math.max(0, Math.trunc(drawCount));
  return Math.max(
    purpose === "practice" ? 200 : 80,
    normalizedDraw * (purpose === "practice" ? 5 : 4),
  );
}

export function hasReadyQuestionInventory(
  purpose: AssessmentPurpose,
  drawCount: number,
  approvedInventory: number,
): boolean {
  return Math.max(0, Math.trunc(approvedInventory)) >= requiredQuestionInventory(purpose, drawCount);
}
