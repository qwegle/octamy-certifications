import "./bootstrap-env";
import "./lib/sentry"; // must precede other imports so Sentry can patch them
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logger } from "./lib/logger";
import path from "path";
import { generateCertificateHTML } from "./utils/newCertificateGenerator";
import { fileURLToPath } from "url";

const app = express();

// Behind nginx + Cloudflare; trust 1 hop so req.ip / X-Forwarded-* work.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// CORS: explicit allowlist; same-origin SPA always works, cross-origin must be listed.
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server: no Origin header → allow.
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.length === 0) return cb(null, true); // dev convenience
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Enhanced security headers for SSL/HTTPS protection
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }

  // Security headers
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://secure.payu.in" "https://api.cashfree.com" "https://sandbox.cashfree.com")');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://secure.payu.in https://test.payu.in https://accounts.google.com https://sdk.cashfree.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; frame-src 'self' https://secure.payu.in https://test.payu.in https://accounts.google.com https://api.cashfree.com https://sandbox.cashfree.com; connect-src 'self' https://secure.payu.in https://test.payu.in https://accounts.google.com https://api.cashfree.com https://sandbox.cashfree.com;");

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
         "/api/recruiter/login", "/api/recruiter/register"], authLimiter);
app.use(["/api/contact", "/api/contact-submission", "/api/sponsors",
         "/api/seller/withdrawal-requests", "/api/referral/track-click"], writeLimiter);

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
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ status: "ready", db: "ok", uptime: process.uptime() });
  } catch (err: any) {
    res.status(503).json({ status: "not_ready", db: "error", error: err?.message });
  }
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
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
