export type AssessmentCatalogFilters = {
  q: string;
  category: string;
  audience: string;
  level: string;
  page: number;
};

const LEVELS = new Set(["novice", "intermediate", "advanced", "expert"]);
const FILTER_VALUE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export const DEFAULT_ASSESSMENT_FILTERS: AssessmentCatalogFilters = {
  q: "",
  category: "all",
  audience: "all",
  level: "all",
  page: 1,
};

export function parseAssessmentCatalogQuery(search: string): AssessmentCatalogFilters {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const q = (params.get("q") || "").trim().slice(0, 120);
  const categoryValue = params.get("category") || "all";
  const audienceValue = params.get("audience") || "all";
  const levelValue = params.get("level") || "all";
  const rawPage = Number(params.get("page") || "1");

  return {
    q,
    category: categoryValue === "all" || FILTER_VALUE.test(categoryValue) ? categoryValue : "all",
    audience: audienceValue === "all" || FILTER_VALUE.test(audienceValue) ? audienceValue : "all",
    level: levelValue === "all" || LEVELS.has(levelValue) ? levelValue : "all",
    page: Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10_000 ? rawPage : 1,
  };
}

export function buildAssessmentCatalogQuery(filters: AssessmentCatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.audience !== "all") params.set("audience", filters.audience);
  if (filters.level !== "all") params.set("level", filters.level);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
