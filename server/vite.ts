import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import type { ServerOptions } from "vite";
import { type Server } from "http";
import { PUBLIC_ASSESSMENT_PRODUCT_TYPES } from "@shared/public-assessment-routes";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Vite and its plugins are build/development dependencies. Keep the runtime
  // import inside this development-only function so a production install can
  // safely prune dev dependencies before starting the bundled server.
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();
  const serverOptions: ServerOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${randomUUID()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // SSR meta injection for crawlers — rewrites <!--SEO_HEAD--> in index.html for known dynamic routes.
  const indexPath = path.resolve(distPath, "index.html");
  let indexHtmlCache: string | null = null;
  const loadIndex = () => {
    if (!indexHtmlCache) indexHtmlCache = fs.readFileSync(indexPath, "utf-8");
    return indexHtmlCache;
  };

  // Lazy db import to avoid cycles
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const withOctamyBrand = (title: string) => /octamy/i.test(title) ? title : `${title} | Octamy`;

  const renderMeta = (title: string, description: string, url: string, image: string, noIndex = false) => `
    <title data-react-helmet="true">${escapeHtml(title)}</title>
    <meta data-react-helmet="true" name="description" content="${escapeHtml(description)}" />
    <meta data-react-helmet="true" name="author" content="Octamy Solutions Private Limited" />
    <meta data-react-helmet="true" name="robots" content="${noIndex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}" />
    <link data-react-helmet="true" rel="canonical" href="${escapeHtml(url)}" />
    <meta data-react-helmet="true" property="og:site_name" content="Octamy" />
    <meta data-react-helmet="true" property="og:type" content="website" />
    <meta data-react-helmet="true" property="og:title" content="${escapeHtml(title)}" />
    <meta data-react-helmet="true" property="og:description" content="${escapeHtml(description)}" />
    <meta data-react-helmet="true" property="og:url" content="${escapeHtml(url)}" />
    <meta data-react-helmet="true" property="og:image" content="${escapeHtml(image)}" />
    <meta data-react-helmet="true" property="og:locale" content="en_IN" />
    <meta data-react-helmet="true" name="twitter:card" content="summary_large_image" />
    <meta data-react-helmet="true" name="twitter:title" content="${escapeHtml(title)}" />
    <meta data-react-helmet="true" name="twitter:description" content="${escapeHtml(description)}" />
    <meta data-react-helmet="true" name="twitter:image" content="${escapeHtml(image)}" />
  `;

  const replaceSeoHead = (html: string, meta: string) => {
    const markedHead = /<!--\s*SEO_HEAD\s*-->[\s\S]*?<!--\s*SEO_HEAD_END\s*-->/;
    return markedHead.test(html)
      ? html.replace(markedHead, meta)
      : html.replace(/<!--\s*SEO_HEAD\s*-->/, meta);
  };

  app.get(["/assessments/categories/:slug", "/assessments/:slug"], async (req, res, next) => {
    try {
      const html = loadIndex();
      const slug = String(req.params.slug || "").toLowerCase();
      const isExam = !req.path.startsWith("/assessments/categories/");
      const base = (process.env.APP_URL || "https://octamy.com").replace(/\/+$/, "");
      let title = "Octamy";
      let description = "Take reviewed skill assessments free and choose whether to activate a verifiable credential after passing.";
      let image = `${base}/og-image.png`;
      let resourceFound = false;
      let indexable = false;
      let lookupComplete = false;
      let canonicalPath = req.path;

      try {
        const { db } = await import("./db");
        const { courses, categories } = await import("@shared/schema");
        const { and, eq, inArray, sql } = await import("drizzle-orm");
        if (isExam) {
          const numericId = /^\d+$/.test(slug) ? Number(slug) : null;
          const identityCondition = numericId && Number.isSafeInteger(numericId) && numericId > 0
            ? eq(courses.id, numericId)
            : eq(courses.slug, slug);
          const [c] = await db.select({
            slug: courses.slug,
            title: courses.title,
            description: courses.description,
            metaTitle: courses.metaTitle,
            metaDescription: courses.metaDescription,
            thumbnailUrl: courses.thumbnailUrl,
          }).from(courses)
            .innerJoin(categories, eq(categories.id, courses.categoryId))
            .where(and(
              identityCondition,
              inArray(courses.ownerType, ["admin", "creator"]),
              inArray(courses.productType, [...PUBLIC_ASSESSMENT_PRODUCT_TYPES]),
              eq(courses.isActive, true),
              eq(courses.visibility, "public"),
              eq(courses.reviewStatus, "approved"),
              eq(categories.isActive, true),
            )).limit(1);
          if (c) {
            resourceFound = true;
            indexable = true;
            title = withOctamyBrand(c.metaTitle || `${c.title} assessment`);
            description = (c.metaDescription || c.description || description).slice(0, 300);
            image = c.thumbnailUrl || image;
            canonicalPath = `/assessments/${c.slug}`;
          }
        } else {
          const [c] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
          if (c?.isActive) {
            resourceFound = true;
            title = withOctamyBrand(c.metaTitle || `${c.name} assessments`);
            description = (c.metaDescription || c.description || `Browse reviewed ${c.name.toLowerCase()} assessments on Octamy.`).slice(0, 300);
            canonicalPath = `/assessments/categories/${c.slug}`;

            const [publicAssessment] = await db.select({ id: courses.id }).from(courses)
              .where(and(
                eq(courses.ownerType, "admin"),
                inArray(courses.productType, [...PUBLIC_ASSESSMENT_PRODUCT_TYPES]),
                eq(courses.isActive, true),
                eq(courses.visibility, "public"),
                eq(courses.reviewStatus, "approved"),
                sql`${courses.categoryId} IN (
                  WITH RECURSIVE selected_categories AS (
                    SELECT id FROM ${categories}
                    WHERE id = ${c.id} AND is_active = true
                    UNION ALL
                    SELECT child.id FROM ${categories} child
                    INNER JOIN selected_categories parent ON child.parent_id = parent.id
                    WHERE child.is_active = true
                  )
                  SELECT id FROM selected_categories
                )`,
              )).limit(1);
            indexable = Boolean(publicAssessment);
          }
        }
        lookupComplete = true;
      } catch (e) {
        // db error — serve generic shell, don't fail
      }

      if (image?.startsWith("/")) image = `${base}${image}`;
      if (resourceFound && req.path !== canonicalPath) {
        const queryIndex = req.originalUrl.indexOf("?");
        const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
        return res.redirect(301, `${canonicalPath}${query}`);
      }
      const url = `${base}${canonicalPath}`;
      const out = replaceSeoHead(html, renderMeta(title, description, url, image, !indexable));
      const status = lookupComplete && !resourceFound ? 404 : 200;
      res.status(status).type("html").send(out);
    } catch (e) {
      next(e);
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(indexPath);
  });
}
