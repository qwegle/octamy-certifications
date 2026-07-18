import { describe, expect, it } from "@jest/globals";
import {
  assessmentCatalogQuerySchema,
  buildPublicCategoryHierarchy,
  catalogCertificationLabel,
} from "../../server/routes/catalogRoutes";
import {
  canonicalOctamyUrl,
  canonicalPublicSlug,
  publicAssessmentCategoryPath,
  publicAssessmentPath,
  publicProductPath,
} from "../../shared/public-assessment-routes";

describe("assessment catalogue contract", () => {
  it("normalizes bounded public filters", () => {
    expect(assessmentCatalogQuerySchema.parse({
      page: "2",
      pageSize: "24",
      search: "  algebra  ",
      audience: "grade_6_10",
      level: "intermediate",
      featured: "true",
    })).toEqual({
      page: 2,
      pageSize: 24,
      search: "algebra",
      audience: "grade_6_10",
      level: "intermediate",
      featured: true,
    });
    expect(assessmentCatalogQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(assessmentCatalogQuerySchema.safeParse({ level: "beginner" }).success).toBe(false);
  });

  it("keeps issuer claims distinct and truthful", () => {
    expect(catalogCertificationLabel("admin", "octamy")).toBe("Octamy-certified");
    expect(catalogCertificationLabel("creator", "creator")).toBe("Creator-issued · verified on Octamy");
    expect(catalogCertificationLabel("creator", "octamy_creator")).toBe("Octamy + creator certified");
    expect(catalogCertificationLabel("admin", "none", "practice")).toBe("Practice only");
  });

  it("keeps category and assessment slugs on distinct canonical routes", () => {
    expect(publicAssessmentPath("Data-Literacy")).toBe("/get-certified/data-literacy");
    expect(publicAssessmentCategoryPath("Data-Literacy")).toBe("/get-certified/categories/data-literacy");
    expect(canonicalPublicSlug("//external.example")).toBeNull();
    expect(publicAssessmentPath("not/a/slug")).toBe("/get-certified");
    expect(publicProductPath("Number-Sense", "assessment")).toBe("/get-certified/number-sense");
    expect(publicProductPath("Number-Sense", "video_course")).toBe("/learn/number-sense");
    expect(publicProductPath("Number-Sense", "bundle")).toBe("/learn/number-sense");
    expect(canonicalOctamyUrl("/get-certified/data-literacy#attempt")).toBe("https://octamy.com/get-certified/data-literacy");
    expect(canonicalOctamyUrl("https://external.example/phish")).toBe("https://octamy.com/");
  });

  it("builds a stable root-to-leaf public category hierarchy", () => {
    const node = (overrides: Partial<{
      id: number; name: string; description: string; icon: string; slug: string;
      parentId: number | null; kind: string; sortOrder: number;
      metaTitle: string | null; metaDescription: string | null;
    }> = {}) => ({
      id: 1,
      name: "School education",
      description: "School assessments",
      icon: "BookOpen",
      slug: "school-education",
      parentId: null,
      kind: "collection",
      sortOrder: 1,
      metaTitle: null,
      metaDescription: null,
      ...overrides,
    });
    const hierarchy = buildPublicCategoryHierarchy([
      node(),
      node({ id: 2, name: "Science", slug: "science", parentId: 1, kind: "subject" }),
      node({ id: 3, name: "Physics", slug: "physics", parentId: 2, kind: "subject" }),
      node({ id: 4, name: "Chemistry", slug: "chemistry", parentId: 2, kind: "subject", sortOrder: 2 }),
    ], "SCIENCE");

    expect(hierarchy?.ancestors.map((item) => item.slug)).toEqual(["school-education"]);
    expect(hierarchy?.children.map((item) => item.slug)).toEqual(["physics", "chemistry"]);
    expect(hierarchy?.canonicalPath).toBe("/get-certified/categories/science");
  });
});
