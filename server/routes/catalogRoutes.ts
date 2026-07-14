import { Router, type Request, type Response } from "express";
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  audienceBands,
  categories,
  courseAudienceBands,
  courses,
  creators,
} from "@shared/schema";
import {
  canonicalPublicSlug,
  PUBLIC_ASSESSMENT_PRODUCT_TYPES,
  publicAssessmentCategoryPath,
  publicAssessmentPath,
} from "@shared/public-assessment-routes";

const router = Router();

export const assessmentCatalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
  search: z.string().trim().max(120).default(""),
  category: z.string().trim().max(120).optional(),
  audience: z.string().trim().max(80).optional(),
  level: z.enum(["novice", "intermediate", "advanced", "expert"]).optional(),
  language: z.string().trim().min(2).max(20).optional(),
  featured: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();

export function catalogCertificationLabel(ownerType: "admin" | "creator", mode: string) {
  if (ownerType === "admin") return "Octamy-certified";
  if (mode === "octamy_creator") return "Octamy + creator certified";
  return "Creator-issued · verified on Octamy";
}

type PublicCategoryNode = {
  id: number;
  name: string;
  description: string;
  icon: string;
  slug: string;
  parentId: number | null;
  kind: string;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
};

export function buildPublicCategoryHierarchy(rows: PublicCategoryNode[], requestedSlug: string) {
  const slug = canonicalPublicSlug(requestedSlug);
  if (!slug) return null;
  const category = rows.find((row) => row.slug === slug);
  if (!category) return null;

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ancestors: PublicCategoryNode[] = [];
  const visited = new Set<number>([category.id]);
  let parentId = category.parentId;
  while (parentId != null && ancestors.length < 30) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }

  return {
    category,
    ancestors,
    children: rows.filter((row) => row.parentId === category.id),
    canonicalPath: publicAssessmentCategoryPath(category.slug),
  };
}

async function assessmentCatalog(req: Request, res: Response, ownerType: "admin" | "creator") {
  const parsed = assessmentCatalogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Review the assessment filters",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const filter = parsed.data;
    const conditions: SQL[] = [
      eq(courses.ownerType, ownerType),
      inArray(courses.productType, [...PUBLIC_ASSESSMENT_PRODUCT_TYPES]),
      eq(courses.isActive, true),
      eq(courses.visibility, "public"),
      eq(courses.reviewStatus, "approved"),
      eq(categories.isActive, true),
    ];
    if (filter.search) {
      const search = `%${filter.search}%`;
      conditions.push(or(
        ilike(courses.title, search),
        ilike(courses.description, search),
        ilike(categories.name, search),
      )!);
    }
    if (filter.category) {
      // Selecting a collection (for example Competitive exams) includes all
      // active descendants, while selecting a leaf still behaves as an exact
      // filter. This keeps one stable URL as taxonomy grows.
      conditions.push(sql`${courses.categoryId} IN (
        WITH RECURSIVE selected_categories AS (
          SELECT id FROM ${categories}
          WHERE slug = ${filter.category} AND is_active = true
          UNION ALL
          SELECT child.id FROM ${categories} child
          INNER JOIN selected_categories parent ON child.parent_id = parent.id
          WHERE child.is_active = true
        )
        SELECT id FROM selected_categories
      )`);
    }
    if (filter.level) conditions.push(eq(courses.level, filter.level));
    if (filter.language) conditions.push(eq(courses.language, filter.language));
    if (filter.featured === true) conditions.push(isNotNull(courses.featuredAt));
    if (filter.audience) {
      conditions.push(sql`EXISTS (
        SELECT 1
        FROM ${courseAudienceBands} cab
        INNER JOIN ${audienceBands} ab ON ab.id = cab.audience_band_id
        WHERE cab.course_id = ${courses.id}
          AND ab.code = ${filter.audience}
          AND ab.is_active = true
      )`);
    }

    const where = and(...conditions)!;
    const offset = (filter.page - 1) * filter.pageSize;
    const [items, totalRows, categoryFacets, audienceFacets] = await Promise.all([
      db.select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        slug: courses.slug,
        duration: courses.duration,
        passingScore: courses.passingScore,
        price: courses.price,
        level: courses.level,
        language: courses.language,
        thumbnailUrl: courses.thumbnailUrl,
        certificationMode: courses.certificationMode,
        subscriptionEligible: courses.subscriptionEligible,
        featuredAt: courses.featuredAt,
        createdAt: courses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          kind: categories.kind,
        },
        creator: {
          id: creators.id,
          displayName: creators.displayName,
          slug: creators.slug,
          avatarUrl: creators.avatarUrl,
        },
      }).from(courses)
        .innerJoin(categories, eq(categories.id, courses.categoryId))
        .leftJoin(creators, and(eq(courses.ownerType, "creator"), eq(creators.id, courses.ownerId)))
        .where(where)
        .orderBy(desc(courses.featuredAt), desc(courses.createdAt), asc(courses.title))
        .limit(filter.pageSize)
        .offset(offset),
      db.select({ total: countDistinct(courses.id) }).from(courses)
        .innerJoin(categories, eq(categories.id, courses.categoryId))
        .where(where),
      db.select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        parentId: categories.parentId,
        kind: categories.kind,
      })
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.select({
        id: audienceBands.id,
        code: audienceBands.code,
        label: audienceBands.label,
        description: audienceBands.description,
      }).from(audienceBands)
        .where(eq(audienceBands.isActive, true))
        .orderBy(asc(audienceBands.sortOrder)),
    ]);

    const courseIds = items.map((item) => item.id);
    const audienceRows = courseIds.length > 0
      ? await db.select({
          courseId: courseAudienceBands.courseId,
          id: audienceBands.id,
          code: audienceBands.code,
          label: audienceBands.label,
        }).from(courseAudienceBands)
          .innerJoin(audienceBands, eq(audienceBands.id, courseAudienceBands.audienceBandId))
          .where(and(
            inArray(courseAudienceBands.courseId, courseIds),
            eq(audienceBands.isActive, true),
          ))
          .orderBy(asc(audienceBands.sortOrder))
      : [];
    const total = Number(totalRows[0]?.total || 0);

    res.json({
      items: items.map((item) => ({
        ...item,
        creator: ownerType === "creator" ? item.creator : null,
        origin: ownerType === "admin" ? "octamy" : "creator",
        originLabel: ownerType === "admin" ? "Octamy in-house" : "Creator marketplace",
        certificationLabel: catalogCertificationLabel(ownerType, item.certificationMode),
        audienceBands: audienceRows
          .filter((row) => row.courseId === item.id)
          .map(({ courseId: _courseId, ...band }) => band),
      })),
      pagination: {
        page: filter.page,
        pageSize: filter.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
      },
      facets: {
        categories: categoryFacets,
        audienceBands: audienceFacets,
        levels: ["novice", "intermediate", "advanced", "expert"],
      },
    });
  } catch {
    res.status(500).json({ message: "The assessment catalogue is temporarily unavailable" });
  }
}

router.get("/assessments", (req, res) => assessmentCatalog(req, res, "admin"));
router.get("/creator-assessments", (req, res) => assessmentCatalog(req, res, "creator"));

router.get("/assessment-categories/:slug", async (req: Request, res: Response) => {
  const slug = canonicalPublicSlug(req.params.slug);
  if (!slug) return res.status(404).json({ message: "Assessment category not found" });

  try {
    const rows = await db.select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      icon: categories.icon,
      slug: categories.slug,
      parentId: categories.parentId,
      kind: categories.kind,
      sortOrder: categories.sortOrder,
      metaTitle: categories.metaTitle,
      metaDescription: categories.metaDescription,
    }).from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    const hierarchy = buildPublicCategoryHierarchy(rows, slug);
    if (!hierarchy) return res.status(404).json({ message: "Assessment category not found" });
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json(hierarchy);
  } catch {
    res.status(500).json({ message: "Assessment category is temporarily unavailable" });
  }
});

router.get("/assessments/:slug", async (req: Request, res: Response) => {
  const slug = canonicalPublicSlug(req.params.slug);
  if (!slug) return res.status(404).json({ message: "Assessment not found" });
  const numericId = /^\d+$/.test(slug) ? Number(slug) : null;
  const identityCondition = numericId && Number.isSafeInteger(numericId) && numericId > 0
    ? eq(courses.id, numericId)
    : eq(courses.slug, slug);

  try {
    const [item] = await db.select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      slug: courses.slug,
      categoryId: courses.categoryId,
      duration: courses.duration,
      passingScore: courses.passingScore,
      price: courses.price,
      productType: courses.productType,
      level: courses.level,
      language: courses.language,
      thumbnailUrl: courses.thumbnailUrl,
      metaTitle: courses.metaTitle,
      metaDescription: courses.metaDescription,
      ownerType: courses.ownerType,
      certificationMode: courses.certificationMode,
      subscriptionEligible: courses.subscriptionEligible,
      category: {
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        kind: categories.kind,
        metaTitle: categories.metaTitle,
        metaDescription: categories.metaDescription,
      },
      creator: {
        displayName: creators.displayName,
        slug: creators.slug,
      },
    }).from(courses)
      .innerJoin(categories, eq(categories.id, courses.categoryId))
      .leftJoin(creators, and(eq(courses.ownerType, "creator"), eq(creators.id, courses.ownerId)))
      .where(and(
        identityCondition,
        inArray(courses.ownerType, ["admin", "creator"]),
        inArray(courses.productType, [...PUBLIC_ASSESSMENT_PRODUCT_TYPES]),
        eq(courses.isActive, true),
        eq(courses.visibility, "public"),
        eq(courses.reviewStatus, "approved"),
        eq(categories.isActive, true),
      ));
    if (!item) return res.status(404).json({ message: "Assessment not found" });

    const ownerType = item.ownerType === "creator" ? "creator" : "admin";
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    res.json({
      ...item,
      creator: ownerType === "creator" ? item.creator : null,
      origin: ownerType === "admin" ? "octamy" : "creator",
      originLabel: ownerType === "admin" ? "Octamy in-house" : "Creator marketplace",
      certificationLabel: catalogCertificationLabel(ownerType, item.certificationMode),
      canonicalPath: publicAssessmentPath(item.slug),
    });
  } catch {
    res.status(500).json({ message: "Assessment is temporarily unavailable" });
  }
});

export default router;
