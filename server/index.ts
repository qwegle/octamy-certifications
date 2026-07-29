import "./bootstrap-env";
import "./lib/sentry"; // must precede other imports so Sentry can patch them
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import crypto from "crypto";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logger } from "./lib/logger";
import path from "path";
import { generateCertificateHTML } from "./utils/newCertificateGenerator";
import { fileURLToPath } from "url";
import { isGoogleAuthConfigured } from "./google-auth";
import {
  getInterviewStudioEvaluationQueueHealth,
  startInterviewStudioEvaluationWorker,
  stopInterviewStudioEvaluationWorker,
} from "./lib/interview-studio-evaluation-worker";
import {
  startInterviewStudioRetentionWorker,
  stopInterviewStudioRetentionWorker,
} from "./lib/interview-studio-retention-worker";

const app = express();

// Behind nginx + Cloudflare; trust 1 hop so req.ip / X-Forwarded-* work.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// CORS: explicit allowlist; same-origin SPA always works, cross-origin must be listed.
const APP_ORIGIN = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).origin : "";
  } catch {
    return "";
  }
})();
const CORS_ORIGINS = Array.from(new Set([
  APP_ORIGIN,
  ...(process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()),
].filter(Boolean)));
app.use(
  cors({
    origin: (origin, cb) => {
      // curl / server-to-server requests carry no Origin header. Browser
      // origins must match APP_URL or the explicit cross-origin allowlist.
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      if (process.env.NODE_ENV !== "production" && CORS_ORIGINS.length === 0) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Enhanced security headers for SSL/HTTPS protection
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    if (!APP_ORIGIN || !APP_ORIGIN.startsWith('https://')) {
      return res.status(500).json({ message: 'Secure application origin is not configured' });
    }
    return res.redirect(308, `${APP_ORIGIN}${req.originalUrl}`);
  }

  // Security headers
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Camera and microphone remain disabled across the product by default. The
  // private Interview Studio is the only document allowed to request them,
  // and it still does so only after an explicit learner gesture. Screen
  // capture is a browser-mediated picker and is likewise scoped to this page.
  const isInterviewStudioDocument = req.path === '/interview-studio'
    || req.path.startsWith('/interview-studio/');
  const interviewCapturePolicy = isInterviewStudioDocument
    ? 'camera=(self), microphone=(self), display-capture=(self)'
    : 'camera=(), microphone=(), display-capture=()';
  const isCashfreeFallbackDocument = req.path === '/cashfree-checkout';
  const paymentPolicy = isCashfreeFallbackDocument
    ? 'payment=(self "https://api.cashfree.com" "https://sandbox.cashfree.com")'
    : 'payment=(self "https://secure.payu.in" "https://api.cashfree.com" "https://sandbox.cashfree.com")';
  res.setHeader('Permissions-Policy', `${interviewCapturePolicy}, geolocation=(), ${paymentPolicy}`);
  const contentSecurityPolicy = isCashfreeFallbackDocument
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.cashfree.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com; frame-src https://api.cashfree.com https://sandbox.cashfree.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' https://secure.payu.in https://test.payu.in https://accounts.google.com https://sdk.cashfree.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src 'self' https://secure.payu.in https://test.payu.in https://accounts.google.com https://api.cashfree.com https://sandbox.cashfree.com; connect-src 'self' https://secure.payu.in https://test.payu.in https://accounts.google.com https://api.cashfree.com https://sandbox.cashfree.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self';";
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);

  next();
});

// Body parsers — capped to mitigate DoS; raise on specific upload routes if needed.
app.use(express.json({
  limit: "1mb",
  verify: (req: Request, _res, buf) => {
    (req as any).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Request-ID middleware: propagate or generate x-request-id so logs/Sentry can
// correlate user-reported failures with backend traces.
app.use((req, res, next) => {
  const id = (req.header('x-request-id') || crypto.randomUUID()).slice(0, 64);
  (req as any).requestId = id;
  res.setHeader('x-request-id', id);
  next();
});

// Rate limiters: applied to the most abusable endpoints.
// Keyed on IP (works because trust proxy is set above).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Slow down — too many requests." },
});
app.use(["/api/login", "/api/auth/login", "/api/register", "/api/auth/register",
         "/api/admin/login", "/api/sellers/login", "/api/sellers/register",
         "/api/recruiter/login", "/api/recruiter/register",
         "/api/auth/forgot-password", "/api/auth/reset-password",
         "/api/forgot-password", "/api/reset-password"], authLimiter);
app.use(["/api/contact", "/api/contact-submission", "/api/sponsors",
         "/api/seller/withdrawal-requests", "/api/referral/track-click",
         "/api/recruiter/purchase-credits"], writeLimiter);

// Exam submission limiter — 10 submits/minute/IP (a candidate cannot legitimately submit faster).
const examLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Slow down — please wait before submitting again." },
});
app.use(["/api/exam/submit", "/api/exams/submit", "/api/exam-attempt", "/api/exam-attempts"], examLimiter);

// Health probes — used by uptime monitors and nginx upstream checks.
app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});
app.get("/readyz", async (_req, res) => {
  const checks: Record<string, any> = { status: "ready", uptime: process.uptime() };
  try {
    const t0 = Date.now();
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    checks.db = { ok: true, latencyMs: Date.now() - t0 };
  } catch (err: any) {
    checks.status = "not_ready";
    checks.db = { ok: false, error: err?.message };
  }
  checks.sentry = process.env.SENTRY_DSN ? "configured" : "not_configured";
  checks.googleOAuth = isGoogleAuthConfigured ? "configured" : "not_configured";
  checks.paymentGateway = process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY
    ? "cashfree"
    : process.env.PAYUMONEY_MERCHANT_KEY && process.env.PAYUMONEY_SALT
      ? "payu"
      : "not_configured";
  checks.nodeEnv = process.env.NODE_ENV || "development";
  checks.commit = process.env.GIT_COMMIT || "unknown";
  try {
    checks.interviewEvaluationQueue = await getInterviewStudioEvaluationQueueHealth();
    if (checks.interviewEvaluationQueue.status === "degraded") checks.status = "not_ready";
  } catch (err: any) {
    checks.status = "not_ready";
    checks.interviewEvaluationQueue = { ok: false, error: err?.message };
  }
  res.status(checks.status === "ready" ? 200 : 503).json(checks);
});
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('server/public'));

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    if (!reqPath.startsWith("/api")) return;
    const duration = Date.now() - start;
    const meta: Record<string, any> = {
      method: req.method,
      path: reqPath,
      status: res.statusCode,
      durMs: duration,
      ip: req.header('x-forwarded-for')?.split(',')[0]?.trim() || req.ip,
      reqId: (req as any).requestId,
    };
    if (res.statusCode >= 500) logger.error('http.request', meta);
    else if (res.statusCode >= 400) logger.warn('http.request', meta);
    else logger.info('http.request', meta);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // JSON 404 for unknown /api/* routes — must come before SPA catch-all.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API route not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const rawMessage = err.message || "Internal Server Error";
    if (status >= 500 && process.env.SENTRY_DSN) {
      Sentry.captureException(err);
    }
    // Don't leak internal error details in production responses.
    const isProd = process.env.NODE_ENV === "production";
    const safeMessage = status >= 500 && isProd ? "Internal Server Error" : rawMessage;
    if (!res.headersSent) {
      res.status(status).json({ message: safeMessage });
    }
    logger.error("unhandled.route_error", { status, msg: rawMessage, err });
  });

  // A SPA fallback must not turn unknown URLs into indexable HTTP 200 pages.
  // Keep this after API/redirect routes and before Vite/the production shell.
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const requestPath = req.path;
    const isDevelopmentAsset = app.get("env") === "development"
      && (requestPath.startsWith("/@") || requestPath.startsWith("/src/") || requestPath.startsWith("/node_modules/"));
    const isStaticAsset = isDevelopmentAsset
      || requestPath.startsWith("/assets/")
      || requestPath.startsWith("/uploads/")
      || path.posix.extname(requestPath) !== "";
    if (isStaticAsset) return next();

    const routePath = requestPath.replace(/\/+$/, "") || "/";
    const { isKnownClientRoute, canonicalPublicSlug } = await import("@shared/public-assessment-routes");

    const escapeHtml = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const sendNotFound = () => {
      res.set({
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      });
      return res.status(404).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Page not found | Octamy</title>
<style>body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.6 system-ui,sans-serif}main{max-width:720px;margin:10vh auto;padding:32px}section{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:clamp(28px,6vw,56px);box-shadow:0 18px 50px #0f172a12}p{color:#475569}nav{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}a{background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:11px 16px;border-radius:999px}a:nth-child(2){background:#0f172a}a:nth-child(3){background:#fff;color:#334155;border:1px solid #cbd5e1}code{overflow-wrap:anywhere}</style></head>
<body><main><section><p><strong>404</strong></p><h1>We couldn’t find this page</h1><p>The address <code>${escapeHtml(requestPath)}</code> may be incorrect, or the page may no longer be available.</p>
<nav aria-label="Live Octamy catalogues"><a href="/get-certified">Browse certifications</a><a href="/practice">Browse practice exams</a><a href="/courses">Browse courses</a></nav></section></main></body></html>`);
    };

    if (!isKnownClientRoute(routePath)) return sendNotFound();

    // Route-shape matching alone cannot tell whether a public slug exists.
    // Resolve catalog detail/category routes against the same live database.
    const publicMatch = routePath.match(/^\/(get-certified|practice)(?:\/(categories))?\/([^/]+)$/);
    if (publicMatch) {
      const [, surface, categorySegment, rawSlug] = publicMatch;
      const slug = canonicalPublicSlug(rawSlug);
      if (!slug) return sendNotFound();
      try {
        const { db } = await import("./db");
        const { categories, courses } = await import("@shared/schema");
        const { and, eq, inArray } = await import("drizzle-orm");
        let found = false;
        if (categorySegment) {
          const rows = await db.select({ id: categories.id }).from(categories)
            .where(and(eq(categories.slug, slug), eq(categories.isActive, true))).limit(1);
          found = rows.length > 0;
        } else {
          const purpose = surface === "practice" ? "practice" : "certification";
          const rows = await db.select({ id: courses.id }).from(courses)
            .innerJoin(categories, eq(categories.id, courses.categoryId))
            .where(and(
              eq(courses.slug, slug),
              inArray(courses.productType, ["assessment", "bundle"]),
              eq(courses.assessmentPurpose, purpose),
              eq(courses.isActive, true),
              eq(courses.visibility, "public"),
              eq(courses.reviewStatus, "approved"),
              eq(categories.isActive, true),
            )).limit(1);
          found = rows.length > 0;
        }
        if (!found) return sendNotFound();
      } catch (error) {
        // A lookup outage is not evidence that a valid page disappeared, but it
        // must not fall through as an indexable HTTP 200 soft-404 either.
        logger.warn("spa.public_route_lookup_failed", { path: routePath, error: String(error) });
        res.set({
          "Cache-Control": "no-store",
          "Retry-After": "60",
          "X-Robots-Tag": "noindex, nofollow",
        });
        return res.status(503).type("html").send("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>Catalogue temporarily unavailable | Octamy</title></head><body><main><h1>Catalogue temporarily unavailable</h1><p>Please try again shortly.</p><p><a href=\"/get-certified\">Certifications</a> · <a href=\"/practice\">Practice exams</a></p></main></body></html>");
      }
    }

    // A blog post slug matches the route shape for any value, so an unknown or
    // unpublished post would otherwise be served as an indexable HTTP 200
    // soft-404. Resolve it against the same live database.
    const blogMatch = routePath.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const slug = canonicalPublicSlug(blogMatch[1]);
      if (!slug) return sendNotFound();
      try {
        const { db } = await import("./db");
        const { blogPosts } = await import("@shared/schema");
        const { and, eq, sql } = await import("drizzle-orm");
        const rows = await db.select({ id: blogPosts.id }).from(blogPosts)
          .where(and(
            eq(blogPosts.slug, slug),
            eq(blogPosts.status, "published"),
            sql`${blogPosts.publishedAt} <= now()`,
          )).limit(1);
        if (rows.length === 0) return sendNotFound();
      } catch (error) {
        logger.warn("spa.blog_route_lookup_failed", { path: routePath, error: String(error) });
        res.set({
          "Cache-Control": "no-store",
          "Retry-After": "60",
          "X-Robots-Tag": "noindex, nofollow",
        });
        return res.status(503).type("html").send("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>Article temporarily unavailable | Octamy</title></head><body><main><h1>Article temporarily unavailable</h1><p>Please try again shortly.</p><p><a href=\"/blog\">Blog</a></p></main></body></html>");
      }
    }

    const isCanonicalPublicSurface = routePath === "/get-certified"
      || routePath.startsWith("/get-certified/")
      || routePath === "/practice"
      || routePath.startsWith("/practice/")
      || routePath === "/courses"
      || routePath.startsWith("/learn/");
    if (isCanonicalPublicSurface && requestPath !== routePath) {
      const queryIndex = req.originalUrl.indexOf("?");
      const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
      return res.redirect(308, `${routePath}${query}`);
    }

    return next();
  });

  // Supply crawler-visible metadata for public catalogue pages not handled by
  // the certification detail renderer in serveStatic(). Client Helmet then
  // takes over with the same canonical URL after hydration.
  if (app.get("env") !== "development") {
    app.get([
      "/get-certified",
      "/practice",
      "/practice/categories/:slug",
      "/practice/:slug",
    ], async (req: Request, res: Response, next: NextFunction) => {
      try {
        const [{ readFile }, { canonicalOctamyUrl }] = await Promise.all([
          import("node:fs/promises"),
          import("@shared/public-assessment-routes"),
        ]);
        const indexPath = path.resolve(import.meta.dirname, "public", "index.html");
        const html = await readFile(indexPath, "utf8");
        const baseDescription = "Explore reviewed Octamy assessments with transparent access, scoring, and credential terms.";
        let title = "Professional Certification Exams | Octamy";
        let description = "Take a reviewed certification exam free, see your score, and choose credential activation only after passing.";
        let image = "https://octamy.com/og-image.png";
        let schemaType = "CollectionPage";

        if (req.path === "/practice") {
          title = "Practice Exams and Practice Pass | Octamy";
          description = "Browse reviewed practice exams. Practice Pass access is separate from certification exams and does not issue recruiter credentials.";
        } else if (req.path.startsWith("/practice/categories/")) {
          const { db } = await import("./db");
          const { categories } = await import("@shared/schema");
          const { and, eq } = await import("drizzle-orm");
          const [category] = await db.select({
            name: categories.name,
            description: categories.description,
            metaTitle: categories.metaTitle,
            metaDescription: categories.metaDescription,
          }).from(categories).where(and(
            eq(categories.slug, String(req.params.slug || "").toLowerCase()),
            eq(categories.isActive, true),
          )).limit(1);
          if (category) {
            title = category.metaTitle || `${category.name} Practice Exams | Octamy`;
            description = category.metaDescription || category.description || `Browse reviewed ${category.name} practice exams on Octamy.`;
          }
        } else if (req.path.startsWith("/practice/")) {
          const { db } = await import("./db");
          const { categories, courses } = await import("@shared/schema");
          const { and, eq, inArray } = await import("drizzle-orm");
          const [course] = await db.select({
            title: courses.title,
            description: courses.description,
            metaTitle: courses.metaTitle,
            metaDescription: courses.metaDescription,
            thumbnailUrl: courses.thumbnailUrl,
          }).from(courses).innerJoin(categories, eq(categories.id, courses.categoryId)).where(and(
            eq(courses.slug, String(req.params.slug || "").toLowerCase()),
            inArray(courses.productType, ["assessment", "bundle"]),
            eq(courses.assessmentPurpose, "practice"),
            eq(courses.isActive, true),
            eq(courses.visibility, "public"),
            eq(courses.reviewStatus, "approved"),
            eq(categories.isActive, true),
          )).limit(1);
          if (course) {
            title = course.metaTitle || `${course.title} | Octamy Practice`;
            description = course.metaDescription || course.description || baseDescription;
            image = course.thumbnailUrl || image;
            schemaType = "WebPage";
          }
        }

        const cleanTitle = /octamy/i.test(title) ? title : `${title} | Octamy`;
        const cleanDescription = (description || baseDescription).trim().replace(/\s+/g, " ").slice(0, 300);
        const canonical = canonicalOctamyUrl(req.path);
        const absoluteImage = image.startsWith("/") ? `https://octamy.com${image}` : image;
        const escapeHtml = (value: string) => value
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const jsonLd = JSON.stringify({
          "@context": "https://schema.org",
          "@type": schemaType,
          name: cleanTitle,
          description: cleanDescription,
          url: canonical,
          isPartOf: { "@type": "WebSite", name: "Octamy", url: "https://octamy.com/" },
        }).replace(/</g, "\\u003c");
        const metadata = `<!-- SEO_HEAD -->
<title data-react-helmet="true">${escapeHtml(cleanTitle)}</title>
<meta data-react-helmet="true" name="description" content="${escapeHtml(cleanDescription)}" />
<meta data-react-helmet="true" name="author" content="Octamy Solutions Private Limited" />
<meta data-react-helmet="true" name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<link data-react-helmet="true" rel="canonical" href="${escapeHtml(canonical)}" />
<meta data-react-helmet="true" property="og:site_name" content="Octamy" />
<meta data-react-helmet="true" property="og:locale" content="en_IN" />
<meta data-react-helmet="true" property="og:type" content="website" />
<meta data-react-helmet="true" property="og:title" content="${escapeHtml(cleanTitle)}" />
<meta data-react-helmet="true" property="og:description" content="${escapeHtml(cleanDescription)}" />
<meta data-react-helmet="true" property="og:url" content="${escapeHtml(canonical)}" />
<meta data-react-helmet="true" property="og:image" content="${escapeHtml(absoluteImage)}" />
<meta data-react-helmet="true" name="twitter:card" content="summary_large_image" />
<meta data-react-helmet="true" name="twitter:title" content="${escapeHtml(cleanTitle)}" />
<meta data-react-helmet="true" name="twitter:description" content="${escapeHtml(cleanDescription)}" />
<meta data-react-helmet="true" name="twitter:image" content="${escapeHtml(absoluteImage)}" />
<script id="octamy-page-structured-data" type="application/ld+json">${jsonLd}</script>
<!-- SEO_HEAD_END -->`;
        const output = html.replace(/<!--\s*SEO_HEAD\s*-->[\s\S]*?<!--\s*SEO_HEAD_END\s*-->/, metadata);
        return res.status(200).type("html").send(output);
      } catch (error) {
        logger.warn("spa.public_metadata_failed", { path: req.path, error: String(error) });
        return next();
      }
    });
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT) || 5000;
  const httpServer = server.listen(port, () => {
    log(`serving on port ${port}`);
  });
  startInterviewStudioEvaluationWorker();
  startInterviewStudioRetentionWorker();

  // Tighten timeouts to defeat slowloris-style attacks.
  // headersTimeout must be > keepAliveTimeout per Node docs.
  httpServer.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65_000;
  httpServer.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 70_000;
  httpServer.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 120_000;

  // Graceful shutdown: stop accepting new connections, drain in-flight, then exit.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutdown.begin', { signal });
    stopInterviewStudioEvaluationWorker();
    stopInterviewStudioRetentionWorker();
    // After 25s, force-exit so pm2 / docker can restart us instead of hanging.
    const forceExit = setTimeout(() => {
      logger.error('server.shutdown.force_exit');
      process.exit(1);
    }, 25_000);
    forceExit.unref();
    httpServer.close((err) => {
      if (err) {
        logger.error('server.shutdown.error', { err: err.message });
        process.exit(1);
      }
      logger.info('server.shutdown.done');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Surface unhandled errors instead of dying silently — Sentry already
  // captures via patched hooks, but log them at the application layer too.
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('process.uncaught_exception', { err: err.message, stack: err.stack });
  });
})();
