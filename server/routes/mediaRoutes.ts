import { Router, type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { authenticateToken } from "../middleware/auth";
import { canManageMediaLibrary } from "../lib/media-permissions";
import { isDirectPublicMediaKind } from "../lib/protected-media";
import { loadUserContext } from "../lib/qb-permissions";
import {
  courses,
  creators,
  institutes,
  lessons,
  mediaAssets,
  questions,
} from "@shared/schema";

const router = Router();
const LOCAL_MEDIA_DIR = path.join(process.cwd(), "uploads", "media");
const cloudinaryReady = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

if (cloudinaryReady) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const MIME_CONFIG: Record<string, { ext: string; kind: "image" | "video" | "document"; max: number }> = {
  "image/jpeg": { ext: ".jpg", kind: "image", max: 10 * 1024 * 1024 },
  "image/png": { ext: ".png", kind: "image", max: 10 * 1024 * 1024 },
  "image/webp": { ext: ".webp", kind: "image", max: 10 * 1024 * 1024 },
  "image/gif": { ext: ".gif", kind: "image", max: 10 * 1024 * 1024 },
  "video/mp4": { ext: ".mp4", kind: "video", max: 500 * 1024 * 1024 },
  "video/webm": { ext: ".webm", kind: "video", max: 500 * 1024 * 1024 },
  "video/quicktime": { ext: ".mov", kind: "video", max: 500 * 1024 * 1024 },
  "application/pdf": { ext: ".pdf", kind: "document", max: 50 * 1024 * 1024 },
};

fs.mkdirSync(LOCAL_MEDIA_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOCAL_MEDIA_DIR),
    filename: (req, file, cb) => {
      const cfg = MIME_CONFIG[file.mimetype];
      const userId = req.user?.userId ?? "unknown";
      cb(null, `media-${userId}-${crypto.randomUUID()}${cfg?.ext ?? ".bin"}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_CONFIG[file.mimetype]) {
      return cb(new Error("Unsupported file type. Upload JPG, PNG, WebP, GIF, MP4, WebM, MOV, or PDF."));
    }
    cb(null, true);
  },
});

// Immediate process-local abuse guard. A persisted per-workspace byte quota is
// still required before calling this enterprise-ready, but this prevents one
// authenticated account from opening an unbounded number of large uploads.
const mediaUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.userId ?? "unknown"}`,
  message: {
    message: "Media upload limit reached for this hour. Try again later.",
    code: "MEDIA_UPLOAD_RATE_LIMITED",
  },
});

function matchesSignature(filePath: string, mimeType: string) {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(16);
  try {
    fs.readSync(fd, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (mimeType === "image/jpeg") return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimeType === "image/png") return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP";
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString());
  if (mimeType === "application/pdf") return header.subarray(0, 4).toString() === "%PDF";
  if (mimeType === "video/webm") return header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") return header.subarray(4, 8).toString() === "ftyp";
  return false;
}

async function unlinkQuietly(filePath: string) {
  await fs.promises.unlink(filePath).catch(() => undefined);
}

async function findUsage(url: string) {
  const [course, lesson, question, institute, creator] = await Promise.all([
    db.select({ id: courses.id, label: courses.title }).from(courses).where(eq(courses.thumbnailUrl, url)).limit(1),
    db.select({ id: lessons.id, label: lessons.title }).from(lessons).where(eq(lessons.contentUrl, url)).limit(1),
    db.select({ id: questions.id, label: questions.question }).from(questions).where(eq(questions.imageUrl, url)).limit(1),
    db.select({ id: institutes.id, label: institutes.name }).from(institutes).where(eq(institutes.logoUrl, url)).limit(1),
    db.select({ id: creators.id, label: creators.displayName }).from(creators).where(eq(creators.avatarUrl, url)).limit(1),
  ]);
  return [
    ...course.map((row) => ({ type: "course_thumbnail", ...row })),
    ...lesson.map((row) => ({ type: "lesson_content", ...row })),
    ...question.map((row) => ({ type: "question_image", ...row })),
    ...institute.map((row) => ({ type: "institute_logo", ...row })),
    ...creator.map((row) => ({ type: "creator_avatar", ...row })),
  ];
}

async function requireMediaAuthorWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await loadUserContext(req.user!.userId);
    if (!context || !canManageMediaLibrary(context)) {
      return res.status(403).json({
        message: "The media library is available to creator and institute author workspaces.",
        code: "MEDIA_AUTHOR_WORKSPACE_REQUIRED",
      });
    }
    next();
  } catch (error) {
    console.error("media.authorization.error", error);
    res.status(500).json({ message: "Media-library access could not be verified" });
  }
}

router.get("/media", authenticateToken, requireMediaAuthorWorkspace, async (req: Request, res: Response) => {
  try {
    const kind = typeof req.query.kind === "string" ? req.query.kind : "all";
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    if (!["all", "image", "video", "document"].includes(kind)) {
      return res.status(400).json({ message: "Invalid media kind" });
    }
    const where = kind === "all"
      ? eq(mediaAssets.userId, req.user!.userId)
      : and(eq(mediaAssets.userId, req.user!.userId), eq(mediaAssets.kind, kind));
    const rows = await db.select().from(mediaAssets).where(where).orderBy(desc(mediaAssets.createdAt)).limit(250);
    const filtered = search
      ? rows.filter((row) => `${row.originalName} ${row.altText ?? ""} ${row.caption ?? ""}`.toLowerCase().includes(search))
      : rows;
    res.json({ items: filtered, total: filtered.length });
  } catch (error) {
    console.error("media.list.error", error);
    res.status(500).json({ message: "Media library could not be loaded" });
  }
});

router.post("/media", authenticateToken, requireMediaAuthorWorkspace, mediaUploadLimiter, (req: Request, res: Response) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      const status = uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ message: uploadError.message });
    }
    if (!req.file) return res.status(400).json({ message: "Choose a file to upload" });

    const localPath = req.file.path;
    const cfg = MIME_CONFIG[req.file.mimetype];
    try {
      if (!cfg || req.file.size > cfg.max) {
        await unlinkQuietly(localPath);
        return res.status(413).json({ message: `${cfg?.kind ?? "File"} exceeds its upload limit` });
      }
      if (!matchesSignature(localPath, req.file.mimetype)) {
        await unlinkQuietly(localPath);
        return res.status(400).json({ message: "The file content does not match its declared type" });
      }

      let url = `/api/media/files/${encodeURIComponent(req.file.filename)}`;
      let storageProvider = "local";
      let storageKey = req.file.filename;
      let width: number | null = null;
      let height: number | null = null;

      if (cloudinaryReady) {
        const uploaded = await cloudinary.uploader.upload(localPath, {
          folder: `octamy/media/${req.user!.userId}`,
          resource_type: cfg.kind === "video" ? "video" : cfg.kind === "document" ? "raw" : "image",
          // Images may be public catalog assets. Videos and PDFs are uploaded
          // with authenticated delivery and are streamed only by Octamy.
          type: cfg.kind === "image" ? "upload" : "authenticated",
          use_filename: true,
          unique_filename: true,
        });
        url = uploaded.secure_url;
        storageProvider = "cloudinary";
        storageKey = uploaded.public_id;
        width = uploaded.width ?? null;
        height = uploaded.height ?? null;
        await unlinkQuietly(localPath);
      } else if (process.env.NODE_ENV === "production") {
        await unlinkQuietly(localPath);
        return res.status(503).json({
          message: "Media storage is not configured. Set Cloudinary credentials before accepting production uploads.",
        });
      }

      const [created] = await db.insert(mediaAssets).values({
        userId: req.user!.userId,
        originalName: path.basename(req.file.originalname).slice(0, 240),
        mimeType: req.file.mimetype,
        kind: cfg.kind,
        url,
        storageProvider,
        storageKey,
        sizeBytes: req.file.size,
        width,
        height,
        altText: typeof req.body.altText === "string" ? req.body.altText.trim().slice(0, 300) || null : null,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      await unlinkQuietly(localPath);
      console.error("media.upload.error", error);
      res.status(500).json({ message: "Upload failed. Your file was not added to the library." });
    }
  });
});

router.get("/media/files/:filename", async (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!/^media-\d+-[0-9a-f-]+\.[a-z0-9]+$/i.test(filename)) return res.status(404).end();
    const [asset] = await db.select().from(mediaAssets).where(and(
      eq(mediaAssets.storageProvider, "local"),
      eq(mediaAssets.storageKey, filename),
    ));
    if (!asset) return res.status(404).end();
    if (!isDirectPublicMediaKind(asset.kind)) {
      // Videos and documents are never bearer-public storage objects. Owners
      // preview them through /media/:id/content and learners through a lesson.
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(404).end();
    }
    const filePath = path.join(LOCAL_MEDIA_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(asset.mimeType).sendFile(filePath);
  } catch (error) {
    console.error("media.file.error", error);
    res.status(404).end();
  }
});

router.get("/media/:id", authenticateToken, requireMediaAuthorWorkspace, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid media id" });
    const [asset] = await db.select().from(mediaAssets).where(and(
      eq(mediaAssets.id, id),
      eq(mediaAssets.userId, req.user!.userId),
    ));
    if (!asset) return res.status(404).json({ message: "Media item not found" });
    res.json({ ...asset, usage: await findUsage(asset.url) });
  } catch (error) {
    console.error("media.detail.error", error);
    res.status(500).json({ message: "Media details could not be loaded" });
  }
});

router.patch("/media/:id", authenticateToken, requireMediaAuthorWorkspace, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const parsed = z.object({
      originalName: z.string().trim().min(1).max(240).optional(),
      altText: z.string().trim().max(300).nullable().optional(),
      caption: z.string().trim().max(1000).nullable().optional(),
    }).safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ message: "Invalid media details" });
    const [updated] = await db.update(mediaAssets).set({
      ...parsed.data,
      updatedAt: new Date(),
    }).where(and(eq(mediaAssets.id, id), eq(mediaAssets.userId, req.user!.userId))).returning();
    if (!updated) return res.status(404).json({ message: "Media item not found" });
    res.json(updated);
  } catch (error) {
    console.error("media.update.error", error);
    res.status(500).json({ message: "Media details could not be saved" });
  }
});

router.delete("/media/:id", authenticateToken, requireMediaAuthorWorkspace, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid media id" });
    const [asset] = await db.select().from(mediaAssets).where(and(
      eq(mediaAssets.id, id),
      eq(mediaAssets.userId, req.user!.userId),
    ));
    if (!asset) return res.status(404).json({ message: "Media item not found" });
    const usage = await findUsage(asset.url);
    if (usage.length) {
      return res.status(409).json({ message: "Remove this media item from the listed content before deleting it.", usage });
    }

    if (asset.storageProvider === "cloudinary") {
      const resourceType = asset.kind === "video" ? "video" : asset.kind === "document" ? "raw" : "image";
      const deliveryType = asset.url.includes("/authenticated/") ? "authenticated" : "upload";
      await cloudinary.uploader.destroy(asset.storageKey, {
        resource_type: resourceType,
        type: deliveryType,
        invalidate: true,
      });
    } else {
      await unlinkQuietly(path.join(LOCAL_MEDIA_DIR, path.basename(asset.storageKey)));
    }
    await db.delete(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.userId, req.user!.userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error("media.delete.error", error);
    res.status(500).json({ message: "Media item could not be deleted" });
  }
});

export default router;
