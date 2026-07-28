import { safeInternalReturnTo } from "./navigation-safety";

export const PRACTICE_PASS_PLAN = "all_access" as const;
export const PRACTICE_PASS_PRICES = { monthly: 299, yearly: 2990 } as const;
export type PracticePassCycle = "monthly" | "yearly";

export function normalizePracticePassCycle(value: unknown): PracticePassCycle {
  return value === "yearly" ? "yearly" : "monthly";
}

export function practicePassPath(input: {
  cycle?: unknown;
  next?: string | null;
  welcome?: boolean;
  selected?: boolean;
} = {}): string {
  const params = new URLSearchParams({
    cycle: normalizePracticePassCycle(input.cycle),
    next: safeInternalReturnTo(input.next) || "/practice",
  });
  if (input.selected) params.set("selected", PRACTICE_PASS_PLAN);
  if (input.welcome) params.set("welcome", "1");
  return `/pricing/practice-pass?${params.toString()}`;
}

// Registration currently recognizes this legacy selected-plan destination.
// /pricing immediately canonicalizes it to practicePassPath without dropping
// the originating assessment slug.
export function practicePricingPath(input: {
  cycle?: unknown;
  next?: string | null;
  welcome?: boolean;
} = {}): string {
  const params = new URLSearchParams({
    role: "learner",
    selected: PRACTICE_PASS_PLAN,
    cycle: normalizePracticePassCycle(input.cycle),
  });
  params.set("next", safeInternalReturnTo(input.next) || "/practice");
  if (input.welcome) params.set("welcome", "1");
  return `/pricing?${params.toString()}`;
}

export function practicePlansPath(input: {
  cycle?: unknown;
  next?: string | null;
} = {}): string {
  return practicePassPath({ cycle: input.cycle, next: input.next });
}

export function practiceAccountPath(
  mode: "login" | "register",
  input: { cycle?: unknown; next?: string | null } = {},
): string {
  const next = practicePricingPath({ cycle: input.cycle, next: input.next });
  const params = new URLSearchParams({ next });
  if (mode === "register") {
    params.set("role", "learner");
    params.set("plan", PRACTICE_PASS_PLAN);
    params.set("cycle", normalizePracticePassCycle(input.cycle));
  }
  return `/${mode}?${params.toString()}`;
}
