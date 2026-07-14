import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import type { ServerOptions } from "vite";
import { type Server } from "http";

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

  const renderMeta = (title: string, description: string, url: string, image?: string) => `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
  `;

  app.get(["/exam/:slug", "/category/:slug"], async (req, res, next) => {
    try {
      const html = loadIndex();
      const slug = String(req.params.slug || "").toLowerCase();
      const isExam = req.path.startsWith("/exam/");
      let title = "Octamy";
      let description = "Free skill-verification assessments. Pay only for verified certificates.";
      let image: string | undefined;

      try {
        const { db } = await import("./db");
        const { courses, categories } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        if (isExam) {
          const [c] = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
          if (c) {
            title = `${c.title} — Certification Exam | Octamy`;
            description = (c.description || description).slice(0, 200);
            image = undefined;
          }
        } else {
          const [c] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
          if (c) {
            title = `${c.name} Skill Assessments & Certifications | Octamy`;
            description = `Browse free ${c.name.toLowerCase()} assessments on Octamy.`;
          }
        }
      } catch (e) {
        // db error — serve generic shell, don't fail
      }

      const url = `https://octamy.com${req.path}`;
      const out = html.replace(/<!--\s*SEO_HEAD\s*-->/, renderMeta(title, description, url, image));
      res.status(200).type("html").send(out);
    } catch (e) {
      next(e);
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(indexPath);
  });
}
