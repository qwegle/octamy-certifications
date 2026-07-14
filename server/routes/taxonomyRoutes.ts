import { Router, type Request, type Response } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../lib/audit";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { audienceBands, categories, courseCategories, courses } from "@shared/schema";

const router = Router();

const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1_000),
  icon: z.string().trim().min(1).max(80).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  kind: z.enum(["collection", "audience", "subject", "exam_family", "skill"]).default("collection"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
  metaTitle: z.string().trim().max(180).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
}).strict();

const categoryUpdateSchema = categoryCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one category field",
);

export function taxonomySlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "category";
}

async function unusedCategorySlug(name: string) {
  const base = taxonomySlug(name);
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const [existing] = await db.select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, candidate));
    if (!existing) return candidate;
  }
  throw new Error("A unique category URL could not be allocated");
}

async function validateParent(parentId: number | null | undefined, currentId?: number) {
  if (parentId == null) return;
  let cursor: number | null = parentId;
  for (let depth = 0; cursor != null && depth < 30; depth += 1) {
    if (currentId && cursor === currentId) throw new Error("CATEGORY_CYCLE");
    const [parent] = await db.select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, cursor));
    if (!parent) throw new Error("CATEGORY_PARENT_MISSING");
    cursor = parent.parentId;
  }
  if (cursor != null) throw new Error("CATEGORY_DEPTH_INVALID");
}

router.get("/audience-bands", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(audienceBands)
      .where(eq(audienceBands.isActive, true))
      .orderBy(asc(audienceBands.sortOrder), asc(audienceBands.label));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Audience bands could not be loaded" });
  }
});

router.get("/admin/categories", authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      icon: categories.icon,
      slug: categories.slug,
      parentId: categories.parentId,
      kind: categories.kind,
      isActive: categories.isActive,
      sortOrder: categories.sortOrder,
      metaTitle: categories.metaTitle,
      metaDescription: categories.metaDescription,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      courseCount: sql<number>`count(${courses.id})::int`,
    }).from(categories)
      .leftJoin(courses, eq(courses.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.name));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Categories could not be loaded" });
  }
});

router.post("/admin/categories", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = categoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Review the category details",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    await validateParent(parsed.data.parentId);
    const [created] = await db.insert(categories).values({
      ...parsed.data,
      icon: parsed.data.icon || "BookOpen",
      slug: await unusedCategorySlug(parsed.data.name),
    }).returning();
    await audit({
      action: "taxonomy.category.created",
      userId: req.user!.userId,
      actorRole: "admin",
      resourceType: "category",
      resourceId: created.id,
      req,
    });
    res.status(201).json({ ...created, courseCount: 0 });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_PARENT_MISSING") {
      return res.status(400).json({ message: "Parent category not found" });
    }
    res.status(500).json({ message: "Category could not be created" });
  }
});

async function updateCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const parsed = categoryUpdateSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Use a valid category identifier" });
    }
    if (!parsed.success) {
      return res.status(400).json({
        message: "Review the category details",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    await validateParent(parsed.data.parentId, id);
    const [updated] = await db.update(categories).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Category not found" });
    await audit({
      action: "taxonomy.category.updated",
      userId: req.user!.userId,
      actorRole: "admin",
      resourceType: "category",
      resourceId: id,
      req,
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_CYCLE") {
      return res.status(400).json({ message: "A category cannot be its own parent or descendant" });
    }
    if (error instanceof Error && error.message === "CATEGORY_PARENT_MISSING") {
      return res.status(400).json({ message: "Parent category not found" });
    }
    res.status(500).json({ message: "Category could not be updated" });
  }
}

router.put("/admin/categories/:id", authenticateToken, requireAdmin, updateCategory);
router.patch("/admin/categories/:id", authenticateToken, requireAdmin, updateCategory);

router.delete("/admin/categories/:id", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Use a valid category identifier" });
    }
    const [usage] = await db.select({ count: sql<number>`count(*)::int` })
      .from(courseCategories)
      .where(eq(courseCategories.categoryId, id));
    const [legacyUsage] = await db.select({ count: sql<number>`count(*)::int` })
      .from(courses).where(eq(courses.categoryId, id));
    const [children] = await db.select({ count: sql<number>`count(*)::int` })
      .from(categories).where(eq(categories.parentId, id));
    if (Number(children?.count || 0) > 0) {
      return res.status(409).json({ message: "Move or delete child categories first.", childCount: Number(children.count) });
    }
    const courseCount = Math.max(Number(usage?.count || 0), Number(legacyUsage?.count || 0));
    if (courseCount > 0) {
      return res.status(409).json({
        message: "Reassign this category's courses before deleting it.",
        courseCount,
      });
    }
    const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    await audit({
      action: "taxonomy.category.deleted",
      userId: req.user!.userId,
      actorRole: "admin",
      resourceType: "category",
      resourceId: id,
      req,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Category could not be deleted" });
  }
});

export default router;
