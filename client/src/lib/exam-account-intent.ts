import { safeInternalReturnTo } from "./navigation-safety";

export type ExamAccountMode = "login" | "register";
export type ExamAccountGateReason = "before-start" | "account-required" | "session-expired";

export type ExamAccountGatePresentation = {
  eyebrow: string;
  title: string;
  description: string;
  createAccountHref: string;
  loginHref: string;
};

type ApiFailure = {
  status?: unknown;
  code?: unknown;
};

export function examIntentPath(value: unknown): string {
  return safeInternalReturnTo(value) || "/get-certified";
}

export function examAccountPath(mode: ExamAccountMode, assessmentPath: unknown): string {
  const params = new URLSearchParams({ next: examIntentPath(assessmentPath) });
  if (mode === "register") params.set("role", "learner");
  return `/${mode}?${params.toString()}`;
}

export function isExamAccountRequiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as ApiFailure;
  return failure.status === 401 || failure.code === "ACCOUNT_REQUIRED";
}

export function examAccountGatePresentation(input: {
  authenticated: boolean;
  assessmentPath: unknown;
  reason?: ExamAccountGateReason | null;
}): ExamAccountGatePresentation | null {
  const reason = input.reason || (input.authenticated ? null : "before-start");
  if (!reason) return null;

  const interrupted = reason !== "before-start";
  return {
    eyebrow: "Free attempt · account required",
    title: interrupted ? "Sign in to continue your exam" : "Save your free exam attempt",
    description: interrupted
      ? "Your answers are still saved on this device. Create an account or log in to continue securely; the exam attempt remains free."
      : "Create an account or log in before you begin. The exam attempt is free; your account saves the attempt and lets Octamy issue your credential if you pass and choose to activate it.",
    createAccountHref: examAccountPath("register", input.assessmentPath),
    loginHref: examAccountPath("login", input.assessmentPath),
  };
}
