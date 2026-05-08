import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { creators, questionBanks, questions } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import {
  canCreateBankFor,
  canEditBank,
  canViewBank,
  loadUserContext,
  getCreatorLimits,
} from "../lib/qb-permissions";

const JWT_SECRET = process.env.JWT_SECRET!;
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface AuthedRequest extends Request {
  user?: { userId: number; email: string; isAdmin?: boolean };
  ctx?: Awaited<ReturnType<typeof loadUserContext>>;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"];
  const token = auth && auth.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

async function withCtx(req: AuthedRequest, res: Response, next: NextFunction) {
  const ctx = await loadUserContext(req.user!.userId);
  if (!ctx) return res.status(401).json({ message: "User not found" });
  req.ctx = ctx;
  next();
}

// ── Banks ──────────────────────────────────────────────────────────────────

router.get("/", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  try {
    const ctx = req.ctx!;
    const search = (req.query.search as string) || undefined;
    const ownerType = (req.query.ownerType as string) || undefined;

    // Aggregate accessible banks: own + public
    const all = await storage.listQuestionBanks({ search, ownerType });
    const accessible = all.filter((b) => canViewBank(ctx, b));
    res.json(accessible);
  } catch (e: any) {
    console.error("list banks error:", e);
    res.status(500).json({ message: e.message });
  }
});

const createBankSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  ownerType: z.enum(["admin", "creator", "institute"]).optional(),
  ownerId: z.number().nullable().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `bank-${Date.now()}`;
}

router.post("/", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  try {
    const ctx = req.ctx!;
    const body = createBankSchema.parse(req.body);

    // Auto-derive ownerType/ownerId from user roles if not provided
    let ownerType = body.ownerType;
    let ownerId: number | null | undefined = body.ownerId;
    if (!ownerType) {
      if (ctx.user.isAdmin) {
        ownerType = "admin";
        ownerId = null;
      } else if (ctx.creatorId) {
        ownerType = "creator";
        ownerId = ctx.creatorId;
      } else if (ctx.instituteRoles.size > 0) {
        ownerType = "institute";
        ownerId = Array.from(ctx.instituteRoles.keys())[0];
      } else {
        return res.status(403).json({ message: "No creator/institute identity. Onboard first." });
      }
    }
    if (ownerType === "admin") ownerId = null;
    if (!canCreateBankFor(ctx, ownerType, ownerId ?? null)) {
      return res.status(403).json({ message: "Not allowed to create banks for this owner" });
    }

    // Plan-limit check for creators
    if (ownerType === "creator" && ownerId) {
      const [creatorRow] = await db.select().from(creators).where(eq(creators.id, ownerId));
      const limits = getCreatorLimits(creatorRow?.plan);
      if (limits.maxBanks !== -1) {
        const existing = await storage.listQuestionBanks({ ownerType: "creator", ownerId });
        if (existing.length >= limits.maxBanks) {
          return res.status(402).json({
            message: `Plan limit reached: ${limits.maxBanks} bank(s) on ${creatorRow?.plan ?? "free"}. Upgrade to add more.`,
            code: "PLAN_LIMIT_BANKS",
          });
        }
      }
    }

    const slug = body.slug ? slugify(body.slug) : slugify(body.name);
    const bank = await storage.createQuestionBank({
      name: body.name,
      slug,
      description: body.description ?? null,
      ownerType,
      ownerId: ownerId ?? null,
      visibility: body.visibility,
      language: body.language ?? "en",
      tags: body.tags ?? [],
      createdBy: ctx.user.id,
    } as any);
    res.status(201).json(bank);
  } catch (e: any) {
    console.error("create bank error:", e);
    res.status(400).json({ message: e.message });
  }
});

router.get("/:id", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const topics = await storage.listQuestionTopics(id);
  const [{ c }] = await db.select({ c: count() }).from(questions).where(eq(questions.bankId, id));
  res.json({ ...bank, topics, questionCount: Number(c), canEdit: canEditBank(req.ctx!, bank) });
});

router.patch("/:id", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const updated = await storage.updateQuestionBank(id, req.body);
  res.json(updated);
});

router.delete("/:id", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  await storage.deleteQuestionBank(id);
  res.status(204).end();
});

// ── Topics ─────────────────────────────────────────────────────────────────

router.get("/:id/topics", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  res.json(await storage.listQuestionTopics(id));
});

router.post("/:id/topics", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const { name, parentId, sortOrder } = req.body || {};
  if (!name) return res.status(400).json({ message: "name required" });
  const slug = slugify(String(name));
  const topic = await storage.createQuestionTopic({
    bankId: id,
    name,
    slug,
    parentId: parentId ?? null,
    sortOrder: sortOrder ?? 0,
  } as any);
  res.status(201).json(topic);
});

router.patch("/:id/topics/:topicId", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bank = await storage.getQuestionBank(Number(req.params.id));
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const updated = await storage.updateQuestionTopic(Number(req.params.topicId), req.body);
  res.json(updated);
});

router.delete("/:id/topics/:topicId", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bank = await storage.getQuestionBank(Number(req.params.id));
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  await storage.deleteQuestionTopic(Number(req.params.topicId));
  res.status(204).end();
});

// ── Questions ──────────────────────────────────────────────────────────────

router.get("/:id/questions", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const result = await storage.listQuestionsByBank(id, {
    topicId: req.query.topicId ? Number(req.query.topicId) : undefined,
    format: req.query.format as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    perPage: req.query.perPage ? Number(req.query.perPage) : 25,
  });
  res.json(result);
});

router.post("/:id/questions", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });

  // Plan limit on questions per bank
  if (bank.ownerType === "creator" && bank.ownerId) {
    const [creatorRow] = await db.select().from(creators).where(eq(creators.id, bank.ownerId));
    const limits = getCreatorLimits(creatorRow?.plan);
    if (limits.maxQuestionsPerBank !== -1 && bank.questionCount >= limits.maxQuestionsPerBank) {
      return res.status(402).json({
        message: `Plan limit reached: ${limits.maxQuestionsPerBank} questions/bank on ${creatorRow?.plan ?? "free"}.`,
        code: "PLAN_LIMIT_QUESTIONS",
      });
    }
  }

  const q = await storage.createQuestionInBank({
    ...req.body,
    bankId: id,
    createdBy: req.ctx!.user.id,
  });
  res.status(201).json(q);
});

router.patch("/:id/questions/:qid", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bank = await storage.getQuestionBank(Number(req.params.id));
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const { changeNote, ...rest } = req.body || {};
  const updated = await storage.updateQuestionWithVersioning(
    Number(req.params.qid),
    rest,
    req.ctx!.user.id,
    changeNote,
  );
  res.json(updated);
});

router.delete("/:id/questions/:qid", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bank = await storage.getQuestionBank(Number(req.params.id));
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  await storage.deleteBankQuestion(Number(req.params.qid));
  res.status(204).end();
});

// ── Bulk import / export ───────────────────────────────────────────────────

interface ParsedRow {
  topic?: string;
  question: string;
  format: string;
  options: string[];
  correctAnswer: number;
  expectedAnswer: string | null;
  questionFormat: string;
  maxPoints: number;
  negativeMarks: number;
  timeLimitSec: number | null;
  difficulty: string;
  tags: string[];
  explanation: string | null;
}

function normalizeRow(raw: Record<string, any>, idx: number): { ok: true; row: ParsedRow } | { ok: false; error: string } {
  const question = (raw.question ?? "").toString().trim();
  if (!question) return { ok: false, error: "Missing question text" };
  const format = (raw.format ?? "mcq_single").toString().trim();
  const validFormats = ["mcq_single", "mcq_multi", "true_false", "fill_blank", "short", "long", "code", "numeric", "match"];
  if (!validFormats.includes(format)) return { ok: false, error: `Invalid format '${format}'` };

  const opts: string[] = [];
  for (const k of ["optionA", "optionB", "optionC", "optionD"]) {
    if (raw[k] != null && String(raw[k]).trim() !== "") opts.push(String(raw[k]).trim());
  }

  const correctRaw = (raw.correctAnswer ?? "").toString().trim();
  let correctAnswer = 0;
  let expectedAnswer: string | null = null;

  if (format === "mcq_single") {
    const idx = "ABCD".indexOf(correctRaw.toUpperCase());
    if (idx === -1 || idx >= opts.length) return { ok: false, error: "correctAnswer must be A/B/C/D within provided options" };
    correctAnswer = idx;
  } else if (format === "mcq_multi") {
    const indices = correctRaw.split(",").map((s: string) => "ABCD".indexOf(s.trim().toUpperCase())).filter((i: number) => i >= 0);
    if (!indices.length) return { ok: false, error: "correctAnswer must be e.g. 'A,C'" };
    expectedAnswer = indices.join(",");
    correctAnswer = indices[0];
  } else if (format === "true_false") {
    const v = correctRaw.toLowerCase();
    if (v !== "true" && v !== "false") return { ok: false, error: "true_false correctAnswer must be 'true' or 'false'" };
    expectedAnswer = v;
    correctAnswer = v === "true" ? 1 : 0;
  } else {
    if (!correctRaw) return { ok: false, error: "correctAnswer required" };
    expectedAnswer = correctRaw;
  }

  const tags = (raw.tags ?? "").toString().split(",").map((s: string) => s.trim()).filter(Boolean);

  return {
    ok: true,
    row: {
      topic: (raw.topic ?? "").toString().trim() || undefined,
      question,
      format,
      options: opts,
      correctAnswer,
      expectedAnswer,
      questionFormat: format,
      maxPoints: Number(raw.marks ?? 1) || 1,
      negativeMarks: Number(raw.negativeMarks ?? 0) || 0,
      timeLimitSec: raw.timeLimitSec ? Number(raw.timeLimitSec) : null,
      difficulty: (raw.difficulty ?? "medium").toString().trim() || "medium",
      tags,
      explanation: (raw.explanation ?? "").toString().trim() || null,
    },
  };
}

router.post("/:id/questions/import", requireAuth, withCtx, upload.single("file"), async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const bank = await storage.getQuestionBank(id);
    if (!bank) return res.status(404).json({ message: "Bank not found" });
    if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
    if (!req.file) return res.status(400).json({ message: "file required (multipart field 'file')" });

    const dryRun = req.body.dryRun === "true" || req.body.dryRun === true;
    const filename = req.file.originalname.toLowerCase();
    let raw: Record<string, any>[] = [];

    if (filename.endsWith(".csv")) {
      const text = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
      raw = parsed.data;
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    } else {
      return res.status(400).json({ message: "Only .csv, .xlsx, .xls supported" });
    }

    const valid: ParsedRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    raw.forEach((r, i) => {
      const result = normalizeRow(r, i);
      if (result.ok) valid.push(result.row);
      else errors.push({ row: i + 1, message: result.error });
    });

    const preview = valid.slice(0, 5);
    if (dryRun) {
      return res.json({ totalRows: raw.length, valid: valid.length, errors, preview, created: 0 });
    }

    // Plan limit check
    if (bank.ownerType === "creator" && bank.ownerId) {
      const [creatorRow] = await db.select().from(creators).where(eq(creators.id, bank.ownerId));
      const limits = getCreatorLimits(creatorRow?.plan);
      if (limits.maxQuestionsPerBank !== -1) {
        const projected = bank.questionCount + valid.length;
        if (projected > limits.maxQuestionsPerBank) {
          return res.status(402).json({
            message: `Import would exceed plan limit (${limits.maxQuestionsPerBank} questions/bank).`,
            code: "PLAN_LIMIT_QUESTIONS",
          });
        }
      }
    }

    const result = await storage.bulkCreateQuestions(id, valid as any[], req.ctx!.user.id);
    res.json({
      totalRows: raw.length,
      created: result.created,
      errors: [...errors, ...result.errors],
      preview,
    });
  } catch (e: any) {
    console.error("import error:", e);
    res.status(500).json({ message: e.message });
  }
});

router.get("/:id/questions/export", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const all = await storage.listQuestionsByBank(id, { page: 1, perPage: 10000 });
  const topics = await storage.listQuestionTopics(id);
  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const rows = all.items.map((q) => {
    const opts = (q.options as string[]) || [];
    const fmt = q.questionFormat || "mcq_single";
    let correct = "";
    if (fmt === "mcq_single") correct = "ABCD"[q.correctAnswer] || "";
    else if (fmt === "mcq_multi") correct = q.expectedAnswer
      ? q.expectedAnswer.split(",").map((i: string) => "ABCD"[Number(i)] || "").filter(Boolean).join(",")
      : "";
    else correct = q.expectedAnswer ?? "";
    return {
      topic: q.topicId ? topicMap.get(q.topicId) ?? "" : "",
      question: q.question,
      format: fmt,
      optionA: opts[0] ?? "",
      optionB: opts[1] ?? "",
      optionC: opts[2] ?? "",
      optionD: opts[3] ?? "",
      correctAnswer: correct,
      marks: q.maxPoints,
      negativeMarks: q.negativeMarks ?? 0,
      timeLimitSec: q.timeLimitSec ?? "",
      difficulty: q.difficulty,
      tags: Array.isArray(q.tags) ? (q.tags as string[]).join(",") : "",
      explanation: q.explanation ?? "",
    };
  });
  const csv = Papa.unparse(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="bank-${id}-questions.csv"`);
  res.send(csv);
});

// ── Question versions ──────────────────────────────────────────────────────
router.get("/:id/questions/:qid/versions", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bank = await storage.getQuestionBank(Number(req.params.id));
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  res.json(await storage.getQuestionVersions(Number(req.params.qid)));
});

export default router;

// ── Course blueprint sub-router ────────────────────────────────────────────
export const courseBlueprintRouter = Router();

courseBlueprintRouter.get("/:courseId/blueprint", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const items = await storage.getCourseBlueprint(Number(req.params.courseId));
  res.json(items);
});

courseBlueprintRouter.put("/:courseId/blueprint", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const courseId = Number(req.params.courseId);
  const course = await storage.getCourse(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });
  // Edit gate: admin, OR creator owns, OR institute member of owner.
  let allowed = !!ctx.user.isAdmin;
  if (!allowed && course.ownerType === "creator" && course.ownerId === ctx.creatorId) allowed = true;
  if (!allowed && course.ownerType === "institute" && course.ownerId != null) {
    const role = ctx.instituteRoles.get(course.ownerId);
    if (role && role !== "staff") allowed = true;
  }
  if (!allowed) return res.status(403).json({ message: "Forbidden" });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const saved = await storage.setCourseBlueprint(courseId, items);
  res.json(saved);
});
