export const CERTIFICATION_HUB_PATH = "/get-certified";
export const CERTIFICATION_CATEGORY_PREFIX = `${CERTIFICATION_HUB_PATH}/categories`;
export const PRACTICE_HUB_PATH = "/practice";
export const PRACTICE_CATEGORY_PREFIX = `${PRACTICE_HUB_PATH}/categories`;
// Kept as aliases because internal authoring and scoring still use the precise
// domain term "assessment". Public discovery uses outcome-led certification
// language and URLs.
export const ASSESSMENT_HUB_PATH = CERTIFICATION_HUB_PATH;
export const ASSESSMENT_CATEGORY_PREFIX = CERTIFICATION_CATEGORY_PREFIX;
export const LEGACY_ASSESSMENT_HUB_PATH = "/assessments";
export const LEGACY_ASSESSMENT_CATEGORY_PREFIX = `${LEGACY_ASSESSMENT_HUB_PATH}/categories`;
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

export function publicPracticePath(slug: unknown): string {
  const canonical = canonicalPublicSlug(slug);
  return canonical ? `${PRACTICE_HUB_PATH}/${canonical}` : PRACTICE_HUB_PATH;
}

export function publicPracticeCategoryPath(slug: unknown): string {
  const canonical = canonicalPublicSlug(slug);
  return canonical ? `${PRACTICE_CATEGORY_PREFIX}/${canonical}` : PRACTICE_HUB_PATH;
}

export function publicLearningPath(slug: unknown): string {
  const canonical = canonicalPublicSlug(slug);
  return canonical ? `/learn/${canonical}` : "/courses";
}

/**
 * Returns the primary public product page. A bundle is primarily a learning
 * product even though its assessment component also has a certification URL.
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
    url.search = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return `${OCTAMY_PUBLIC_ORIGIN}${url.pathname}`;
  } catch {
    return `${OCTAMY_PUBLIC_ORIGIN}/`;
  }
}

/**
 * The explicit route surface rendered by client/src/App.tsx. Keeping this
 * registry shared lets Express distinguish a legitimate SPA deep-link from an
 * unknown path instead of returning index.html with a misleading HTTP 200.
 */
export const CLIENT_APP_ROUTE_TEMPLATES = [
  "/", "/auth", "/login", "/register", "/forgot-password",
  "/reset-password/:token", "/logout", "/partners/login", "/partners/register",
  "/recruiter/login", "/recruiter/register", "/creator/login", "/creator/register",
  "/institute/login", "/institute/register", "/creator", "/creators",
  "/teach-on-octamy", "/institute", "/institutes", "/for-recruiters", "/pricing",
  "/pricing/practice-pass", "/pricing/certification", "/pricing/workspaces",
  "/billing/return", "/exams", "/get-certified/categories/:slug",
  "/get-certified/:slug", "/get-certified", "/practice/categories/:slug",
  "/practice/:slug", "/practice", "/assessments/categories/:slug",
  "/assessments/:slug", "/assessments", "/creator-assessments", "/courses",
  "/learn/:slug", "/skill-verification", "/virtual-internships",
  "/business-certifications", "/learning-paths", "/sponsor", "/intern-payment",
  "/qwegle/login", "/admin/login", "/qwegle/benefits", "/admin/benefits",
  "/qwegle/dashboard", "/admin/dashboard", "/admin", "/admin/approvals",
  "/qwegle/approvals", "/enhanced-admin", "/exam/:slug",
  "/exam-results-temp/:tempExamId", "/payment", "/payment/cashfree/checkout/",
  "/checkout/:courseId", "/payment/success", "/payment/failure",
  "/payment/:certificateId", "/internship-payment/:certificateId",
  "/certificate/:certificateId", "/dashboard", "/creator/dashboard",
  "/creator/courses", "/creator/courses/new", "/creator/media", "/creator/payouts",
  "/creator/vouchers", "/creator/coupons", "/x/:code", "/institute/dashboard",
  "/institute/courses", "/institute/courses/new", "/institute/courses/:id/curriculum",
  "/institute/students", "/institute/cohorts", "/institute/exams",
  "/institute/exams/new", "/institute/exams/:id/edit", "/institute/exams/:id/results",
  "/institute/reports", "/institute/team", "/institute/payouts",
  "/institute/settings", "/institute/vouchers", "/institute/coupons",
  "/institute/media", "/creator/courses/:id/curriculum", "/creator/earnings",
  "/recruiter/saved-searches", "/progress", "/interview-studio/:sessionId",
  "/interview-studio", "/preferences", "/qwegle", "/verify",
  "/verify/:certificateId", "/evidence-sharing", "/evidence/:token",
  "/certificates/:certificateId", "/help-center", "/about", "/vision",
  "/category/:slug", "/privacy-policy", "/terms-of-service", "/user-deletion",
  "/trust", "/legal", "/compliance", "/refund-policy", "/cookie-policy",
  "/acceptable-use", "/disclaimer", "/reseller-agreement", "/accessibility",
  "/seller-auth", "/partners", "/partner-dashboard", "/payment-success",
  "/payment-failed", "/business-certificates", "/internship/:slug", "/contact",
  "/profile-edit", "/profile", "/my-certificates", "/recruiter/auth",
  "/recruiter/onboarding", "/recruiter/dashboard", "/recruiter/analytics",
  "/recruiter/search", "/recruiter/profile/:id", "/recruiter/wallet",
  "/recruiter/profile", "/recruiter/settings", "/recruiter/payment-success",
  "/recruiter/payment-failed", "/question-banks", "/question-banks/:id",
  "/institute/question-banks", "/institute/question-banks/:id",
  "/creator/question-banks", "/creator/question-banks/:id",
  "/admin/courses/:courseId/blueprint", "/admin/question-banks/:id",
] as const;

function routeSegments(pathname: string): string[] | null {
  try {
    const normalized = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
    return normalized === "/" ? [] : normalized.slice(1).split("/");
  } catch {
    return null;
  }
}

export function isKnownClientRoute(pathname: string): boolean {
  const candidate = routeSegments(pathname);
  if (!candidate) return false;
  return CLIENT_APP_ROUTE_TEMPLATES.some((template) => {
    const expected = routeSegments(template);
    return expected != null
      && expected.length === candidate.length
      && expected.every((segment, index) => segment.startsWith(":") || segment === candidate[index]);
  });
}
