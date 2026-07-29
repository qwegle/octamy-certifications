import { Router, type RequestHandler } from "express";
import { and, count, desc, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { blogPostAssessments, blogPosts, courses, users } from "@shared/schema";
import { publicAssessmentPath, publicPracticePath } from "@shared/public-assessment-routes";

const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const forbiddenBodyControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const markdownLink = /\[([^\]\n]{1,160})\]\(([^)\s]{1,2048})\)/g;

export function safeBlogHref(value: string): string | null {
  const href = value.trim();
  if (!href || href.length > 2048 || forbiddenBodyControls.test(href) || href.includes("\\")) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeBlogBody(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export const blogBodySchema = z.string().transform(normalizeBlogBody).pipe(
  z.string().min(20).max(50_000)
    .refine((body) => !body.includes("<") && !body.includes(">"), "HTML is not allowed; use plain text and Markdown links")
    .refine((body) => !forbiddenBodyControls.test(body), "Control characters are not allowed")
    .refine((body) => Array.from(body.matchAll(markdownLink)).every((match) => safeBlogHref(match[2]) !== null), "Links must use an internal path, http, or https"),
);

const relatedAssessmentIdsSchema = z.array(z.number().int().positive()).max(20)
  .refine((ids) => new Set(ids).size === ids.length, "Related assessment IDs must be unique");

const blogFields = {
  slug: slugSchema,
  title: z.string().trim().min(5).max(180),
  excerpt: z.string().trim().min(20).max(320),
  body: blogBodySchema,
  seoTitle: z.string().trim().min(5).max(70).nullable().optional(),
  seoDescription: z.string().trim().min(20).max(180).nullable().optional(),
  relatedAssessmentIds: relatedAssessmentIdsSchema.default([]),
};

export const createBlogPostSchema = z.object(blogFields).strict();
export const updateBlogPostSchema = z.object({
  ...blogFields,
  relatedAssessmentIds: relatedAssessmentIdsSchema.optional(),
}).partial().strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");
const listBlogPostsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
}).strict();
const idParamSchema = z.coerce.number().int().positive();

export type BlogWriteInput = z.infer<typeof createBlogPostSchema>;
export type BlogUpdateInput = z.infer<typeof updateBlogPostSchema>;

type RelatedAssessment = {
  id: number;
  title: string;
  slug: string;
  purpose: string;
  href: string;
};

type PublicPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  canonicalPath: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date;
  updatedAt: Date;
  authorName: string;
  relatedAssessments: RelatedAssessment[];
  bodyFormat?: "safe-markdown-v1";
};

type WriteResult = { id: number; slug: string; status: string };

export interface BlogStore {
  listPublished(page: number, pageSize: number): Promise<{ items: PublicPost[]; total: number }>;
  findPublished(slug: string): Promise<PublicPost | null>;
  create(authorUserId: number, input: BlogWriteInput): Promise<WriteResult>;
  updateOwned(id: number, authorUserId: number, input: BlogUpdateInput): Promise<WriteResult | null>;
  setPublishedOwned(id: number, authorUserId: number, published: boolean): Promise<WriteResult | null>;
}

type BlogRouterDependencies = {
  store?: BlogStore;
  authenticate?: RequestHandler;
  authorizeAdmin?: RequestHandler;
};

const liveAssessmentConditions = [
  inArray(courses.productType, ["assessment"]),
  inArray(courses.assessmentPurpose, ["certification", "practice"]),
  eq(courses.isActive, true),
  eq(courses.visibility, "public"),
  eq(courses.reviewStatus, "approved"),
] as const;

async function relatedFor(postIds: number[]): Promise<Map<number, RelatedAssessment[]>> {
  const grouped = new Map<number, RelatedAssessment[]>();
  if (postIds.length === 0) return grouped;
  const rows = await db.select({
    postId: blogPostAssessments.blogPostId,
    id: courses.id,
    title: courses.title,
    slug: courses.slug,
    purpose: courses.assessmentPurpose,
  }).from(blogPostAssessments)
    .innerJoin(courses, eq(courses.id, blogPostAssessments.courseId))
    .where(and(inArray(blogPostAssessments.blogPostId, postIds), ...liveAssessmentConditions))
    .orderBy(courses.title);
  for (const row of rows) {
    const assessment = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      purpose: row.purpose,
      href: row.purpose === "practice" ? publicPracticePath(row.slug) : publicAssessmentPath(row.slug),
    };
    grouped.set(row.postId, [...(grouped.get(row.postId) ?? []), assessment]);
  }
  return grouped;
}

async function assertLiveAssessmentIds(executor: any, ids: number[]) {
  if (ids.length === 0) return;
  const rows = await executor.select({ id: courses.id }).from(courses)
    .where(and(inArray(courses.id, ids), ...liveAssessmentConditions));
  if (rows.length !== ids.length) throw new BlogInputError("Every related assessment must be live, public, and approved");
}

class BlogInputError extends Error {}

const defaultStore: BlogStore = {
  async listPublished(page, pageSize) {
    const now = new Date();
    const where = and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, now));
    const [rows, totals] = await Promise.all([
      db.select({
        id: blogPosts.id, slug: blogPosts.slug, title: blogPosts.title, excerpt: blogPosts.excerpt,
        canonicalPath: blogPosts.canonicalPath, seoTitle: blogPosts.seoTitle,
        seoDescription: blogPosts.seoDescription, publishedAt: blogPosts.publishedAt,
        updatedAt: blogPosts.updatedAt, authorName: users.name,
      }).from(blogPosts).innerJoin(users, eq(users.id, blogPosts.authorUserId))
        .where(where).orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
        .limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(blogPosts).where(where),
    ]);
    const related = await relatedFor(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({ ...row, publishedAt: row.publishedAt!, relatedAssessments: related.get(row.id) ?? [] })),
      total: Number(totals[0]?.total ?? 0),
    };
  },
  async findPublished(slug) {
    const rows = await db.select({
      id: blogPosts.id, slug: blogPosts.slug, title: blogPosts.title, excerpt: blogPosts.excerpt,
      body: blogPosts.body, canonicalPath: blogPosts.canonicalPath, seoTitle: blogPosts.seoTitle,
      seoDescription: blogPosts.seoDescription, publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt, authorName: users.name,
    }).from(blogPosts).innerJoin(users, eq(users.id, blogPosts.authorUserId))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const related = await relatedFor([row.id]);
    return { ...row, publishedAt: row.publishedAt!, relatedAssessments: related.get(row.id) ?? [], bodyFormat: "safe-markdown-v1" };
  },
  async create(authorUserId, input) {
    return db.transaction(async (tx) => {
      await assertLiveAssessmentIds(tx, input.relatedAssessmentIds);
      const [post] = await tx.insert(blogPosts).values({
        slug: input.slug, title: input.title, excerpt: input.excerpt, body: input.body,
        status: "draft", authorUserId, publishedAt: null, canonicalPath: `/blog/${input.slug}`,
        seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null,
      }).returning({ id: blogPosts.id, slug: blogPosts.slug, status: blogPosts.status });
      if (input.relatedAssessmentIds.length > 0) await tx.insert(blogPostAssessments).values(input.relatedAssessmentIds.map((courseId) => ({ blogPostId: post.id, courseId })));
      return post;
    });
  },
  async updateOwned(id, authorUserId, input) {
    return db.transaction(async (tx) => {
      const owned = await tx.select({ id: blogPosts.id, slug: blogPosts.slug }).from(blogPosts)
        .where(and(eq(blogPosts.id, id), eq(blogPosts.authorUserId, authorUserId))).limit(1);
      if (!owned[0]) return null;
      if (input.relatedAssessmentIds) await assertLiveAssessmentIds(tx, input.relatedAssessmentIds);
      const { relatedAssessmentIds, ...fields } = input;
      const values: Record<string, unknown> = { ...fields, updatedAt: new Date() };
      if (fields.slug) values.canonicalPath = `/blog/${fields.slug}`;
      const [post] = await tx.update(blogPosts).set(values).where(and(eq(blogPosts.id, id), eq(blogPosts.authorUserId, authorUserId)))
        .returning({ id: blogPosts.id, slug: blogPosts.slug, status: blogPosts.status });
      if (relatedAssessmentIds) {
        await tx.delete(blogPostAssessments).where(eq(blogPostAssessments.blogPostId, id));
        if (relatedAssessmentIds.length > 0) await tx.insert(blogPostAssessments).values(relatedAssessmentIds.map((courseId) => ({ blogPostId: id, courseId })));
      }
      return post;
    });
  },
  async setPublishedOwned(id, authorUserId, published) {
    const [post] = await db.update(blogPosts).set({
      status: published ? "published" : "draft",
      publishedAt: published ? new Date() : null,
      updatedAt: new Date(),
    }).where(and(eq(blogPosts.id, id), eq(blogPosts.authorUserId, authorUserId)))
      .returning({ id: blogPosts.id, slug: blogPosts.slug, status: blogPosts.status });
    return post ?? null;
  },
};

function validationError(res: any, error: z.ZodError) {
  return res.status(400).json({ message: "Review the blog post fields", errors: error.flatten().fieldErrors });
}

function writeError(res: any, error: unknown) {
  if (error instanceof BlogInputError) return res.status(400).json({ message: error.message });
  if ((error as { code?: string })?.code === "23505") return res.status(409).json({ message: "A blog post already uses this slug" });
  console.error("blog write failed", error);
  return res.status(500).json({ message: "The blog post could not be saved" });
}

export function createBlogRouter(dependencies: BlogRouterDependencies = {}) {
  const router = Router();
  const store = dependencies.store ?? defaultStore;
  const authenticate = dependencies.authenticate ?? authenticateToken;
  const authorizeAdmin = dependencies.authorizeAdmin ?? requireAdmin;

  router.get("/blog", async (req, res) => {
    const parsed = listBlogPostsSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const { page, pageSize } = parsed.data;
      const result = await store.listPublished(page, pageSize);
      return res.json({ items: result.items, pagination: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) } });
    } catch (error) {
      console.error("blog listing failed", error);
      return res.status(500).json({ message: "The blog could not be loaded" });
    }
  });

  router.get("/blog/:slug", async (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) return res.status(404).json({ message: "Blog post not found" });
    try {
      const post = await store.findPublished(slug.data);
      if (!post) return res.status(404).json({ message: "Blog post not found" });
      return res.json({ post });
    } catch (error) {
      console.error("blog post read failed", error);
      return res.status(500).json({ message: "The blog post could not be loaded" });
    }
  });

  router.post("/admin/blog", authenticate, authorizeAdmin, async (req, res) => {
    const parsed = createBlogPostSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const post = await store.create(req.user!.userId, parsed.data);
      return res.status(201).json({ post });
    } catch (error) { return writeError(res, error); }
  });

  router.patch("/admin/blog/:id", authenticate, authorizeAdmin, async (req, res) => {
    const id = idParamSchema.safeParse(req.params.id);
    const body = updateBlogPostSchema.safeParse(req.body);
    if (!id.success || !body.success) return res.status(400).json({ message: "Review the blog post request" });
    try {
      const post = await store.updateOwned(id.data, req.user!.userId, body.data);
      if (!post) return res.status(404).json({ message: "Blog post not found" });
      return res.json({ post });
    } catch (error) { return writeError(res, error); }
  });

  for (const [action, published] of [["publish", true], ["unpublish", false]] as const) {
    router.post(`/admin/blog/:id/${action}`, authenticate, authorizeAdmin, async (req, res) => {
      const id = idParamSchema.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: "Invalid blog post ID" });
      try {
        const post = await store.setPublishedOwned(id.data, req.user!.userId, published);
        if (!post) return res.status(404).json({ message: "Blog post not found" });
        return res.json({ post });
      } catch (error) { return writeError(res, error); }
    });
  }

  return router;
}

export default createBlogRouter();
