import { describe, expect, it, jest } from "@jest/globals";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  blogBodySchema,
  createBlogPostSchema,
  createBlogRouter,
  safeBlogHref,
  type BlogStore,
} from "../../server/routes/blogRoutes";

const publishedPost = {
  id: 1,
  slug: "assessment-release-notes",
  title: "Assessment release notes",
  excerpt: "A factual summary of changes to one live assessment.",
  body: "Read the [live certification](/get-certified/typescript-skills) before deciding whether to attempt it.",
  bodyFormat: "safe-markdown-v1" as const,
  canonicalPath: "/blog/assessment-release-notes",
  seoTitle: null,
  seoDescription: null,
  publishedAt: new Date("2026-07-29T12:00:00.000Z"),
  updatedAt: new Date("2026-07-29T12:00:00.000Z"),
  authorName: "Admin author",
  relatedAssessments: [{ id: 7, title: "TypeScript Skills", slug: "typescript-skills", purpose: "certification", href: "/get-certified/typescript-skills" }],
};

function fakeStore(): BlogStore {
  return {
    listPublished: jest.fn<BlogStore["listPublished"]>(async () => ({ items: [{ ...publishedPost, body: undefined, bodyFormat: undefined }], total: 1 })),
    findPublished: jest.fn<BlogStore["findPublished"]>(async (slug) => slug === publishedPost.slug ? publishedPost : null),
    create: jest.fn<BlogStore["create"]>(async (authorUserId, input) => ({ id: authorUserId, slug: input.slug, status: "draft" })),
    updateOwned: jest.fn<BlogStore["updateOwned"]>(async (id, authorUserId) => id === 1 && authorUserId === 42 ? { id, slug: publishedPost.slug, status: "draft" } : null),
    setPublishedOwned: jest.fn<BlogStore["setPublishedOwned"]>(async (id, authorUserId, published) => id === 1 && authorUserId === 42 ? { id, slug: publishedPost.slug, status: published ? "published" : "draft" } : null),
  };
}

const authenticate: RequestHandler = (req, _res, next) => {
  const userId = Number(req.header("x-test-user") || 42);
  req.user = { userId, email: `admin-${userId}@example.test`, isAdmin: req.header("x-test-admin") === "true" };
  next();
};
const authorizeAdmin: RequestHandler = (req, res, next) => req.user?.isAdmin ? next() : res.status(403).json({ message: "Admin access required" });
function appWith(store = fakeStore()) {
  const app = express();
  app.use(express.json());
  app.use(createBlogRouter({ store, authenticate, authorizeAdmin }));
  return { app, store };
}

const validInput = {
  slug: "real-release-note",
  title: "Real release note",
  excerpt: "A factual note based on a completed platform release.",
  body: "This is a factual release note with a [live internal link](/get-certified).",
  relatedAssessmentIds: [7],
};

describe("blog content contract", () => {
  it("stores only non-HTML text and permits only internal/http(s) Markdown links", () => {
    expect(blogBodySchema.parse("A safe paragraph with an [internal link](/practice/typescript-skills)."))
      .toContain("internal link");
    expect(blogBodySchema.safeParse("Twenty characters here <script>alert(1)</script>").success).toBe(false);
    expect(blogBodySchema.safeParse("A long enough [bad link](javascript:alert(1)) in this body.").success).toBe(false);
    expect(safeBlogHref("/get-certified/typescript-skills")).toBe("/get-certified/typescript-skills");
    expect(safeBlogHref("https://example.com/reference")).toBe("https://example.com/reference");
    expect(safeBlogHref("//evil.example/path")).toBeNull();
    expect(safeBlogHref("data:text/html,boom")).toBeNull();
    expect(createBlogPostSchema.parse(validInput).relatedAssessmentIds).toEqual([7]);
  });

  it("lists published posts with bounded pagination and reads by canonical slug", async () => {
    const { app, store } = appWith();
    const listing = await request(app).get("/blog?page=2&pageSize=5").expect(200);
    expect(listing.body.pagination).toEqual({ page: 2, pageSize: 5, total: 1, totalPages: 1 });
    expect(listing.body.items[0]).not.toHaveProperty("body");
    expect(store.listPublished).toHaveBeenCalledWith(2, 5);

    const detail = await request(app).get("/blog/assessment-release-notes").expect(200);
    expect(detail.body.post.bodyFormat).toBe("safe-markdown-v1");
    expect(detail.body.post.relatedAssessments[0].href).toBe("/get-certified/typescript-skills");
    await request(app).get("/blog/Dangerous-Slug").expect(404);
    await request(app).get("/blog/missing-post").expect(404);
    await request(app).get("/blog?pageSize=500").expect(400);
  });

  it("requires an administrator and binds create/update/publish to the authenticated author", async () => {
    const { app, store } = appWith();
    await request(app).post("/admin/blog").set("x-test-admin", "false").send(validInput).expect(403);
    const created = await request(app).post("/admin/blog").set("x-test-admin", "true").set("x-test-user", "42").send(validInput).expect(201);
    expect(created.body.post.status).toBe("draft");
    expect(store.create).toHaveBeenCalledWith(42, expect.objectContaining({ slug: validInput.slug }));

    await request(app).patch("/admin/blog/1").set("x-test-admin", "true").set("x-test-user", "99").send({ title: "A changed factual title" }).expect(404);
    await request(app).post("/admin/blog/1/publish").set("x-test-admin", "true").set("x-test-user", "99").expect(404);
    await request(app).post("/admin/blog/1/publish").set("x-test-admin", "true").set("x-test-user", "42").expect(200);
    await request(app).post("/admin/blog/1/unpublish").set("x-test-admin", "true").set("x-test-user", "42").expect(200);
    expect(store.setPublishedOwned).toHaveBeenLastCalledWith(1, 42, false);
  });
});
