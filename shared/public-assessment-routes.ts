export const ASSESSMENT_HUB_PATH = "/assessments";
export const ASSESSMENT_CATEGORY_PREFIX = `${ASSESSMENT_HUB_PATH}/categories`;
export const OCTAMY_PUBLIC_ORIGIN = "https://octamy.com";

export type PublicProductType = "assessment" | "video_course" | "ebook" | "bundle";
export const PUBLIC_ASSESSMENT_PRODUCT_TYPES = ["assessment", "bundle"] as const;

const PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function canonicalPublicSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return slug.length <= 220 && PUBLIC_SLUG.test(slug) ? slug : null;
}

export function publicAssessmentPath(slug: unknown): string {
  const canonical = canonicalPublicSlug(slug);
  return canonical ? `${ASSESSMENT_HUB_PATH}/${canonical}` : ASSESSMENT_HUB_PATH;
}

export function publicAssessmentCategoryPath(slug: unknown): string {
  const canonical = canonicalPublicSlug(slug);
  return canonical ? `${ASSESSMENT_CATEGORY_PREFIX}/${canonical}` : ASSESSMENT_HUB_PATH;
}

export function publicLearningPath(slug: unknown): string {
  const canonical = canonicalPublicSlug(slug);
  return canonical ? `/learn/${canonical}` : "/courses";
}

/**
 * Returns the primary public product page. A bundle is primarily a learning
 * product even though its assessment component also has an /assessments URL.
 */
export function publicProductPath(slug: unknown, productType: PublicProductType | string): string {
  return productType === "assessment"
    ? publicAssessmentPath(slug)
    : publicLearningPath(slug);
}

export function canonicalOctamyUrl(path: string): string {
  try {
    const url = new URL(path || "/", OCTAMY_PUBLIC_ORIGIN);
    if (url.origin !== OCTAMY_PUBLIC_ORIGIN) return `${OCTAMY_PUBLIC_ORIGIN}/`;
    url.hash = "";
    return url.toString();
  } catch {
    return `${OCTAMY_PUBLIC_ORIGIN}/`;
  }
}
