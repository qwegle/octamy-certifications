import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "exceljs";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { courseQuestionBlueprint, creators, questionBanks, questionPackImportRuns, questions, questionTopics } from "@shared/schema";
import { eq, and, count, sql, inArray } from "drizzle-orm";
import { audit } from "../lib/audit";
import {
  canCreateBankFor,
  canEditBank,
  canListBank,
  canViewBank,
  loadUserContext,
  getCreatorLimits,
} from "../lib/qb-permissions";
import {
  governanceAfterQuestionEdit,
  governanceForHumanQuestion,
  governanceForImportedQuestion,
  governanceForQuestionReview,
  parseImportGenerationSource,
  type QuestionGenerationSource,
  type QuestionReviewStatus,
} from "../lib/question-review-policy";
import { neutralizeSpreadsheetCell } from "../lib/csv-safety";
import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET!;
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const MAX_IMPORT_ROWS = 5_000;

class QuestionPlanLimitError extends Error {
  code = "PLAN_LIMIT_QUESTIONS" as const;

  constructor(readonly limit: number) {
    super(`Question-bank plan limit is ${limit}`);
  }
}

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
    const bankPurpose = req.query.purpose === "practice" ? "practice" : req.query.purpose === "certification" ? "certification" : undefined;

    // Aggregate accessible banks: own + public
    const all = await storage.listQuestionBanks({ search, ownerType });
    const accessible = all.filter((b) => canListBank(ctx, b) && (!bankPurpose || (b as any).bankPurpose === bankPurpose));
    res.json(accessible);
  } catch (e: any) {
    console.error("list banks error:", e);
    res.status(500).json({ message: e.message });
  }
});

const createBankSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(160),
  slug: z.string().trim().max(180).optional(),
  description: z.string().trim().max(2_000).optional().nullable(),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  bankPurpose: z.enum(["certification", "practice"]).default("certification"),
  ownerType: z.enum(["admin", "creator", "institute"]).optional(),
  ownerId: z.number().nullable().optional(),
  language: z.string().trim().min(2).max(12).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});

const updateBankSchema = createBankSchema.omit({ ownerType: true, ownerId: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one bank field to update" },
);

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `bank-${Date.now()}`;
}

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function topicBelongsToBank(topicId: number, bankId: number) {
  const [topic] = await db.select({ id: questionTopics.id }).from(questionTopics).where(and(
    eq(questionTopics.id, topicId),
    eq(questionTopics.bankId, bankId),
  ));
  return !!topic;
}

async function questionBelongsToBank(questionId: number, bankId: number) {
  const [question] = await db.select({ id: questions.id }).from(questions).where(and(
    eq(questions.id, questionId),
    eq(questions.bankId, bankId),
  ));
  return !!question;
}

function questionInsertValues(
  data: Record<string, any>,
  bankId: number,
  createdBy: number,
  topicId: number | null = data.topicId ?? null,
) {
  return {
    courseId: null,
    bankId,
    topicId,
    question: data.question,
    options: data.options ?? [],
    correctAnswer: data.correctAnswer ?? 0,
    questionType: data.questionType ?? "multiple_choice",
    questionFormat: data.questionFormat ?? "mcq_single",
    difficulty: data.difficulty ?? "medium",
    maxPoints: data.maxPoints ?? 1,
    negativeMarks: data.negativeMarks ?? 0,
    timeLimitSec: data.timeLimitSec ?? null,
    imageUrl: data.imageUrl ?? null,
    codeLanguage: data.codeLanguage ?? null,
    expectedAnswer: data.expectedAnswer ?? null,
    tags: data.tags ?? [],
    explanation: data.explanation ?? null,
    contentHash: data.contentHash ?? questionContentHash(data),
    reviewStatus: data.reviewStatus ?? "draft",
    generationSource: data.generationSource ?? "human",
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: data.reviewedAt ?? null,
    version: 1,
    createdBy,
    isActive: data.isActive ?? false,
  };
}

function questionContentHash(data: { question?: unknown; options?: unknown; expectedAnswer?: unknown }) {
  const canonical = JSON.stringify({
    question: String(data.question ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
    options: Array.isArray(data.options) ? data.options.map((option) => String(option).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()) : [],
    expectedAnswer: String(data.expectedAnswer ?? "").normalize("NFKC").trim().toLowerCase(),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

async function insertQuestionsWithBankLock<T>(
  bankId: number,
  incomingCount: number,
  maxQuestions: number,
  insert: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Both an advisory lock and row lock make the check+insert+counter update
    // serial across PM2 workers and every authoring path using this helper.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7302, ${bankId})`);
    const [lockedBank] = await tx.select({ id: questionBanks.id })
      .from(questionBanks)
      .where(eq(questionBanks.id, bankId))
      .for("update");
    if (!lockedBank) throw new Error("Question bank no longer exists");

    const [{ currentCount }] = await tx.select({
      currentCount: count(),
    }).from(questions).where(eq(questions.bankId, bankId));
    const actualCount = Number(currentCount);
    if (maxQuestions !== -1 && actualCount + incomingCount > maxQuestions) {
      throw new QuestionPlanLimitError(maxQuestions);
    }

    const result = await insert(tx);
    await tx.update(questionBanks).set({
      questionCount: actualCount + incomingCount,
      updatedAt: new Date(),
    }).where(eq(questionBanks.id, bankId));
    return result;
  });
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
      } else {
        const identities = [
          ...(ctx.creatorId ? [{ type: "creator" as const, id: ctx.creatorId }] : []),
          ...Array.from(ctx.instituteRoles.entries())
            .filter(([, role]) => role !== "staff")
            .map(([id]) => ({ type: "institute" as const, id })),
        ];
        if (identities.length === 0) {
          return res.status(403).json({ message: "No creator or institute workspace is available. Complete onboarding first." });
        }
        if (identities.length > 1) {
          return res.status(400).json({
            message: "Choose which workspace owns this question bank.",
            code: "OWNER_REQUIRED",
          });
        }
        ownerType = identities[0].type;
        ownerId = identities[0].id;
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

    const baseSlug = body.slug ? slugify(body.slug) : slugify(body.name);
    let slug = baseSlug;
    for (let suffix = 2; await storage.getQuestionBankBySlug(ownerType, ownerId ?? null, slug); suffix++) {
      slug = `${baseSlug}-${suffix}`;
    }
    const bank = await storage.createQuestionBank({
      name: body.name,
      slug,
      description: body.description ?? null,
      ownerType,
      ownerId: ownerId ?? null,
      visibility: body.visibility,
      bankPurpose: body.bankPurpose,
      language: body.language ?? "en",
      tags: body.tags ?? [],
      createdBy: ctx.user.id,
    } as any);
    res.status(201).json(bank);
  } catch (e: any) {
    console.error("create bank error:", e);
    if (e instanceof z.ZodError) {
      const errors = e.flatten();
      const first = Object.values(errors.fieldErrors).flat().find(Boolean);
      return res.status(400).json({ message: first || errors.formErrors[0] || "Check the bank details", errors });
    }
    res.status(500).json({ message: "Failed to create question bank" });
  }
});

router.get("/blueprint-options", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const all = await storage.listQuestionBanks({});
  const banks = all.filter((bank) => bank.status !== "archived" && canListBank(req.ctx!, bank));
  if (!banks.length) return res.json([]);
  const bankIds = banks.map((bank) => bank.id);
  const topics = await db.select().from(questionTopics).where(inArray(questionTopics.bankId, bankIds));
  const inventory = await db.select({
    bankId: questions.bankId,
    topicId: questions.topicId,
    difficulty: questions.difficulty,
    available: count(),
  }).from(questions).where(and(
    inArray(questions.bankId, bankIds),
    eq(questions.isActive, true),
    eq(questions.reviewStatus, "approved"),
  )).groupBy(questions.bankId, questions.topicId, questions.difficulty);
  res.json(banks.map((bank) => ({
    ...bank,
    topics: topics.filter((topic) => topic.bankId === bank.id),
    inventory: inventory
      .filter((row) => row.bankId === bank.id)
      .map((row) => ({ topicId: row.topicId, difficulty: row.difficulty, available: Number(row.available) })),
  })));
});

router.get("/:id", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const topics = await storage.listQuestionTopics(id);
  const [inventory] = await db.select({
    questionCount: count(),
    approvedActive: sql<number>`count(*) filter (where ${questions.reviewStatus} = 'approved' and ${questions.isActive} = true)`,
    easyCount: sql<number>`count(*) filter (where ${questions.difficulty} = 'easy' and ${questions.reviewStatus} = 'approved' and ${questions.isActive} = true)`,
    mediumCount: sql<number>`count(*) filter (where ${questions.difficulty} = 'medium' and ${questions.reviewStatus} = 'approved' and ${questions.isActive} = true)`,
    hardCount: sql<number>`count(*) filter (where ${questions.difficulty} = 'hard' and ${questions.reviewStatus} = 'approved' and ${questions.isActive} = true)`,
    draftCount: sql<number>`count(*) filter (where ${questions.reviewStatus} in ('draft', 'pending'))`,
  }).from(questions).where(and(
    eq(questions.bankId, id),
    sql`${questions.reviewStatus} <> 'retired'`,
  ));
  res.json({
    ...bank,
    topics,
    questionCount: Number(inventory.questionCount),
    inventory: {
      approvedActive: Number(inventory.approvedActive),
      easy: Number(inventory.easyCount),
      medium: Number(inventory.mediumCount),
      hard: Number(inventory.hardCount),
      draft: Number(inventory.draftCount),
    },
    canEdit: canEditBank(req.ctx!, bank),
  });
});

router.patch("/:id", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid bank id" });
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const parsed = updateBankSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check the bank details", errors: parsed.error.flatten() });
  const data = { ...parsed.data };
  if (data.slug) data.slug = slugify(data.slug);
  if (data.slug && data.slug !== bank.slug) {
    const collision = await storage.getQuestionBankBySlug(bank.ownerType, bank.ownerId, data.slug);
    if (collision && collision.id !== bank.id) return res.status(409).json({ message: "A bank with this slug already exists in the workspace" });
  }
  const updated = await storage.updateQuestionBank(id, data);
  res.json(updated);
});

router.delete("/:id", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const [{ blueprintUses }] = await db.select({ blueprintUses: count() })
    .from(courseQuestionBlueprint)
    .where(eq(courseQuestionBlueprint.bankId, id));
  if (Number(blueprintUses) > 0) {
    return res.status(409).json({
      message: `This bank is assigned to ${Number(blueprintUses)} assessment blueprint rule(s). Archive it after replacing those rules; it cannot be deleted.`,
      code: "QUESTION_BANK_IN_USE",
    });
  }
  const [{ importRunCount }] = await db.select({ importRunCount: count() })
    .from(questionPackImportRuns)
    .where(eq(questionPackImportRuns.bankId, id));
  if (Number(importRunCount) > 0) {
    return res.status(409).json({
      message: "This bank has immutable import history and cannot be deleted. Make it private and retire its questions instead.",
      code: "QUESTION_BANK_HAS_IMPORT_HISTORY",
    });
  }
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
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    parentId: z.coerce.number().int().positive().nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check the topic details", errors: parsed.error.flatten() });
  const { name, parentId, sortOrder } = parsed.data;
  if (parentId && !(await topicBelongsToBank(parentId, id))) {
    return res.status(400).json({ message: "Parent topic does not belong to this bank" });
  }
  let slug = slugify(name);
  const existingSlugs = new Set((await storage.listQuestionTopics(id)).map((topic) => topic.slug));
  const baseSlug = slug;
  for (let suffix = 2; existingSlugs.has(slug); suffix++) slug = `${baseSlug}-${suffix}`;
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
  const bankId = positiveId(req.params.id);
  const topicId = positiveId(req.params.topicId);
  if (!bankId || !topicId) return res.status(400).json({ message: "Invalid bank or topic id" });
  const bank = await storage.getQuestionBank(bankId);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  if (!(await topicBelongsToBank(topicId, bankId))) return res.status(404).json({ message: "Topic not found in this bank" });
  const parsed = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    parentId: z.coerce.number().int().positive().nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check the topic details", errors: parsed.error.flatten() });
  if (parsed.data.parentId === topicId) return res.status(400).json({ message: "A topic cannot be its own parent" });
  if (parsed.data.parentId && !(await topicBelongsToBank(parsed.data.parentId, bankId))) {
    return res.status(400).json({ message: "Parent topic does not belong to this bank" });
  }
  const updated = await storage.updateQuestionTopic(topicId, {
    ...parsed.data,
    ...(parsed.data.name ? { slug: slugify(parsed.data.name) } : {}),
  });
  res.json(updated);
});

router.delete("/:id/topics/:topicId", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bankId = positiveId(req.params.id);
  const topicId = positiveId(req.params.topicId);
  if (!bankId || !topicId) return res.status(400).json({ message: "Invalid bank or topic id" });
  const bank = await storage.getQuestionBank(bankId);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  if (!(await topicBelongsToBank(topicId, bankId))) return res.status(404).json({ message: "Topic not found in this bank" });
  const [{ blueprintUses }] = await db.select({ blueprintUses: count() })
    .from(courseQuestionBlueprint)
    .where(eq(courseQuestionBlueprint.topicId, topicId));
  if (Number(blueprintUses) > 0) {
    return res.status(409).json({
      message: `This topic is used by ${Number(blueprintUses)} assessment blueprint rule(s). Remove or replace those rules before deleting it.`,
      code: "QUESTION_TOPIC_IN_USE",
    });
  }
  await storage.deleteQuestionTopic(topicId);
  res.status(204).end();
});

// ── Questions ──────────────────────────────────────────────────────────────

const questionFields = {
  topicId: z.coerce.number().int().positive().nullable().optional(),
  question: z.string().trim().min(10, "Use a complete question of at least 10 characters").max(10_000),
  options: z.array(z.string().trim().max(2_000)).max(20).default([]),
  correctAnswer: z.coerce.number().int().min(0).default(0),
  questionType: z.enum(["multiple_choice", "ai_interactive"]).default("multiple_choice"),
  questionFormat: z.enum(["mcq_single", "mcq_multi", "true_false", "fill_blank", "short", "long", "code", "numeric", "match"]).default("mcq_single"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  maxPoints: z.coerce.number().int().min(1).max(1_000).default(1),
  negativeMarks: z.coerce.number().int().min(0).max(1_000).default(0),
  timeLimitSec: z.coerce.number().int().min(5).max(86_400).nullable().optional(),
  imageUrl: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  codeLanguage: z.string().trim().max(60).nullable().optional(),
  expectedAnswer: z.string().max(20_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  explanation: z.string().max(20_000).nullable().optional(),
};

const questionCreateSchema = z.object(questionFields).superRefine((data, ctx) => {
  const normalizedOptions = data.options.filter(Boolean).map((option) => option.trim().toLocaleLowerCase("en"));
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Answer options must be distinct" });
  }
  if (data.questionFormat === "mcq_single") {
    const usable = data.options.filter(Boolean);
    if (usable.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Add at least two answer options" });
    if (!data.options[data.correctAnswer]?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctAnswer"], message: "Choose a valid correct option" });
  }
  if (data.questionFormat === "mcq_multi") {
    const indices = (data.expectedAnswer || "").split(",").map(Number).filter(Number.isInteger);
    if (indices.length === 0 || indices.some((index) => !data.options[index]?.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Choose one or more valid correct options" });
    }
  }
  if (data.questionFormat === "true_false" && !["true", "false"].includes(String(data.expectedAnswer || "").toLowerCase())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Choose True or False" });
  }
  if (!["mcq_single", "mcq_multi", "true_false"].includes(data.questionFormat) && !data.expectedAnswer?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Expected answer is required for this format" });
  }
  if (data.negativeMarks > data.maxPoints) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["negativeMarks"], message: "Negative marks cannot exceed the question marks" });
  }
});

const questionPatchSchema = z.object(questionFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one question field to update" },
);

const questionReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  expectedVersion: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "rejected" && (!value.note || value.note.length < 3)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "Add a short rejection reason",
    });
  }
});

function normalizeQuestion(data: z.infer<typeof questionCreateSchema>) {
  if (data.questionFormat === "true_false") {
    const isTrue = data.expectedAnswer !== "false";
    return { ...data, options: ["False", "True"], expectedAnswer: isTrue ? "true" : "false", correctAnswer: isTrue ? 1 : 0 };
  }
  return data;
}

router.get("/:id/questions", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const bank = await storage.getQuestionBank(id);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  const result = await storage.listQuestionsByBank(id, {
    topicId: req.query.topicId ? Number(req.query.topicId) : undefined,
    format: req.query.format as string | undefined,
    difficulty: req.query.difficulty as string | undefined,
    reviewStatus: req.query.reviewStatus as string | undefined,
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

  const parsed = questionCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check the question details", errors: parsed.error.flatten() });
  if (parsed.data.topicId && !(await topicBelongsToBank(parsed.data.topicId, id))) {
    return res.status(400).json({ message: "Topic does not belong to this bank" });
  }

  let maxQuestions = -1;
  if (bank.ownerType === "creator" && bank.ownerId) {
    const [creatorRow] = await db.select().from(creators).where(eq(creators.id, bank.ownerId));
    maxQuestions = getCreatorLimits(creatorRow?.plan).maxQuestionsPerBank;
  }

  const needsIndependentReview = bank.ownerType === "admin" && bank.bankPurpose === "certification";
  const values = {
    ...normalizeQuestion(parsed.data),
    ...(needsIndependentReview
      ? { generationSource: "human" as const, reviewStatus: "pending" as const, isActive: false, reviewedBy: null, reviewedAt: null }
      : governanceForHumanQuestion(req.ctx!.user.id, new Date())),
  };
  try {
    const [question] = await insertQuestionsWithBankLock<Array<typeof questions.$inferSelect>>(id, 1, maxQuestions, (tx) => (
      tx.insert(questions).values(questionInsertValues(
        values,
        id,
        req.ctx!.user.id,
      )).returning()
    ));
    res.status(201).json(question);
  } catch (error) {
    if (error instanceof QuestionPlanLimitError) {
      return res.status(402).json({
        message: `Plan limit reached: ${error.limit} questions per bank.`,
        code: error.code,
      });
    }
    console.error("create question error:", error);
    return res.status(500).json({ message: "Failed to create question" });
  }
});

router.patch("/:id/questions/:qid", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bankId = positiveId(req.params.id);
  const questionId = positiveId(req.params.qid);
  if (!bankId || !questionId) return res.status(400).json({ message: "Invalid bank or question id" });
  const bank = await storage.getQuestionBank(bankId);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  if (!(await questionBelongsToBank(questionId, bankId))) return res.status(404).json({ message: "Question not found in this bank" });
  const { changeNote, version: expectedVersionValue, ...rest } = req.body || {};
  const parsedChangeNote = z.string().trim().max(500).optional().safeParse(changeNote);
  if (!parsedChangeNote.success) {
    return res.status(400).json({ message: "Change note must be 500 characters or fewer" });
  }
  const parsedExpectedVersion = z.coerce.number().int().positive().optional().safeParse(expectedVersionValue);
  if (!parsedExpectedVersion.success) {
    return res.status(400).json({ message: "Question version must be a positive integer" });
  }
  const patch = questionPatchSchema.safeParse(rest);
  if (!patch.success) return res.status(400).json({ message: "Check the question details", errors: patch.error.flatten() });
  const [existing] = await db.select().from(questions).where(and(eq(questions.id, questionId), eq(questions.bankId, bankId)));
  const merged = questionCreateSchema.safeParse({ ...existing, ...patch.data });
  if (!merged.success) return res.status(400).json({ message: "Check the question details", errors: merged.error.flatten() });
  if (merged.data.topicId && !(await topicBelongsToBank(merged.data.topicId, bankId))) {
    return res.status(400).json({ message: "Topic does not belong to this bank" });
  }
  const normalized = normalizeQuestion(merged.data);
  const allowedUpdate = Object.fromEntries(Object.keys(patch.data).map((key) => [key, (normalized as any)[key]]));
  allowedUpdate.contentHash = questionContentHash(normalized);
  if (normalized.questionFormat === "true_false") {
    allowedUpdate.options = normalized.options;
    allowedUpdate.expectedAnswer = normalized.expectedAnswer;
    allowedUpdate.correctAnswer = normalized.correctAnswer;
  }
  Object.assign(allowedUpdate, governanceAfterQuestionEdit());
  const updated = await storage.updateQuestionWithVersioning(
    questionId,
    allowedUpdate,
    req.ctx!.user.id,
    parsedChangeNote.data,
    parsedExpectedVersion.data,
  );
  if (!updated && parsedExpectedVersion.data !== undefined) {
    return res.status(409).json({
      message: "This question changed after you opened it. Reload before saving your edits.",
      code: "QUESTION_VERSION_CONFLICT",
    });
  }
  res.json(updated);
});

router.post("/:id/questions/:qid/review", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bankId = positiveId(req.params.id);
  const questionId = positiveId(req.params.qid);
  if (!bankId || !questionId) return res.status(400).json({ message: "Invalid bank or question id" });

  const bank = await storage.getQuestionBank(bankId);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });

  const parsedReview = questionReviewSchema.safeParse(req.body);
  if (!parsedReview.success) {
    return res.status(400).json({
      message: "Check the review decision",
      errors: parsedReview.error.flatten(),
    });
  }

  const [existing] = await db.select().from(questions).where(and(
    eq(questions.id, questionId),
    eq(questions.bankId, bankId),
  ));
  if (!existing) return res.status(404).json({ message: "Question not found in this bank" });
  if (existing.version !== parsedReview.data.expectedVersion) {
    return res.status(409).json({
      message: "This question changed after you opened it. Reload the latest version before reviewing.",
      code: "QUESTION_VERSION_CONFLICT",
      currentVersion: existing.version,
    });
  }

  if (parsedReview.data.status === "approved") {
    const reviewable = questionCreateSchema.safeParse(existing);
    if (!reviewable.success) {
      return res.status(409).json({
        message: "Complete the question and answer key before approving it.",
        code: "QUESTION_NOT_REVIEWABLE",
        errors: reviewable.error.flatten(),
      });
    }
    if (bank.ownerType === "admin" && bank.bankPurpose === "certification") {
      if (existing.createdBy === req.ctx!.user.id) {
        return res.status(409).json({
          message: "Octamy certification questions require a reviewer other than the author.",
          code: "INDEPENDENT_REVIEW_REQUIRED",
        });
      }
      if (!existing.topicId || !existing.explanation?.trim() || existing.explanation.trim().length < 10 || !existing.contentHash) {
        return res.status(409).json({
          message: "Add a competency topic, explanation, and content identity before approval.",
          code: "QUESTION_QUALITY_REQUIREMENTS_NOT_MET",
        });
      }
      if (existing.generationSource !== "human") {
        const provenance = await db.execute(sql`
          SELECT 1 FROM question_provenance qp
          INNER JOIN question_pack_sources source ON source.id = qp.source_id
          WHERE qp.question_id = ${questionId} AND source.rights_review_status = 'verified'
          LIMIT 1
        `);
        if (!provenance.rows.length) {
          return res.status(409).json({
            message: "Imported or AI-drafted certification questions require verified provenance before approval.",
            code: "VERIFIED_PROVENANCE_REQUIRED",
          });
        }
      }
    }
  }

  const reviewerId = req.ctx!.user.id;
  const updated = await storage.updateQuestionWithVersioning(
    questionId,
    { ...governanceForQuestionReview(parsedReview.data.status, reviewerId, new Date()) },
    reviewerId,
    parsedReview.data.note
      ? `Review ${parsedReview.data.status}: ${parsedReview.data.note}`
      : `Review ${parsedReview.data.status}`,
    parsedReview.data.expectedVersion,
  );
  if (!updated) {
    return res.status(409).json({
      message: "This question changed while the review was being saved. Reload and review the latest version.",
      code: "QUESTION_VERSION_CONFLICT",
    });
  }

  await audit({
    action: "question.review",
    userId: reviewerId,
    actorRole: req.ctx!.user.isAdmin ? "admin" : bank.ownerType,
    resourceType: "question",
    resourceId: questionId,
    metadata: {
      bankId,
      decision: parsedReview.data.status,
      generationSource: existing.generationSource,
      version: updated?.version,
    },
    req,
  });

  res.json(updated);
});

router.delete("/:id/questions/:qid", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bankId = positiveId(req.params.id);
  const questionId = positiveId(req.params.qid);
  if (!bankId || !questionId) return res.status(400).json({ message: "Invalid bank or question id" });
  const bank = await storage.getQuestionBank(bankId);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canEditBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  if (!(await questionBelongsToBank(questionId, bankId))) return res.status(404).json({ message: "Question not found in this bank" });
  await storage.deleteBankQuestion(questionId, req.ctx!.user.id);
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
  generationSource: Exclude<QuestionGenerationSource, "human">;
  reviewStatus: QuestionReviewStatus;
  isActive: boolean;
  reviewedBy: null;
  reviewedAt: null;
}

export function normalizeRow(raw: Record<string, any>): { ok: true; row: ParsedRow } | { ok: false; error: string } {
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
    opts.splice(0, opts.length, "False", "True");
  } else {
    if (!correctRaw) return { ok: false, error: "correctAnswer required" };
    expectedAnswer = correctRaw;
  }

  const topic = (raw.topic ?? "").toString().trim();
  if (topic.length > 120) return { ok: false, error: "Topic must be 120 characters or fewer" };
  const tags = (raw.tags ?? "").toString().split(",").map((s: string) => s.trim()).filter(Boolean);
  const generationSource = parseImportGenerationSource(raw.generationSource);
  if (!generationSource) {
    return { ok: false, error: "generationSource must be 'ai_draft', 'imported', or blank" };
  }

  const candidate = questionCreateSchema.safeParse({
    question,
    options: opts,
    correctAnswer,
    questionFormat: format,
    maxPoints: raw.marks == null || String(raw.marks).trim() === "" ? 1 : Number(raw.marks),
    negativeMarks: raw.negativeMarks == null || String(raw.negativeMarks).trim() === "" ? 0 : Number(raw.negativeMarks),
    timeLimitSec: raw.timeLimitSec == null || String(raw.timeLimitSec).trim() === "" ? null : Number(raw.timeLimitSec),
    difficulty: (raw.difficulty ?? "medium").toString().trim() || "medium",
    expectedAnswer,
    tags,
    explanation: (raw.explanation ?? "").toString().trim() || null,
  });
  if (!candidate.success) {
    return { ok: false, error: candidate.error.issues[0]?.message ?? "Invalid question fields" };
  }
  const normalized = normalizeQuestion(candidate.data);

  return {
    ok: true,
    row: {
      topic: topic || undefined,
      question: normalized.question,
      format,
      options: normalized.options,
      correctAnswer: normalized.correctAnswer,
      expectedAnswer: normalized.expectedAnswer ?? null,
      questionFormat: format,
      maxPoints: normalized.maxPoints,
      negativeMarks: normalized.negativeMarks,
      timeLimitSec: normalized.timeLimitSec ?? null,
      difficulty: normalized.difficulty,
      tags: normalized.tags,
      explanation: normalized.explanation ?? null,
      ...governanceForImportedQuestion(generationSource),
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
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        preview: MAX_IMPORT_ROWS + 1,
      });
      if (parsed.errors.length > 0) {
        return res.status(400).json({ message: "The CSV file could not be parsed. Check its header and quoting." });
      }
      raw = parsed.data;
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const wb = new XLSX.Workbook();
      await wb.xlsx.load(req.file.buffer as any);
      const sheet = wb.worksheets[0];
      if (!sheet) {
        return res.status(400).json({ message: "Workbook has no sheets" });
      }
      if (sheet.actualRowCount - 1 > MAX_IMPORT_ROWS) {
        return res.status(413).json({
          message: `Import files are limited to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} question rows.`,
          code: "QUESTION_IMPORT_ROW_LIMIT",
        });
      }
      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colIdx) => {
        headers[colIdx - 1] = String(cell.value ?? '').trim();
      });
      raw = [];
      for (let rowIdx = 2; rowIdx <= Math.min(sheet.rowCount, MAX_IMPORT_ROWS + 1); rowIdx += 1) {
        const row = sheet.getRow(rowIdx);
        const obj: Record<string, any> = {};
        let hasAny = false;
        row.eachCell((cell, colIdx) => {
          const key = headers[colIdx - 1];
          if (!key) return;
          let v: any = cell.value;
          if (v && typeof v === 'object' && 'text' in v) v = (v as any).text;
          if (v && typeof v === 'object' && 'result' in v) v = (v as any).result;
          if (v != null && v !== '') hasAny = true;
          obj[key] = v;
        });
        if (hasAny) raw.push(obj);
      }
    } else {
      return res.status(400).json({ message: "Only .csv, .xlsx, .xls supported" });
    }

    if (raw.length > MAX_IMPORT_ROWS) {
      return res.status(413).json({
        message: `Import files are limited to ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} question rows.`,
        code: "QUESTION_IMPORT_ROW_LIMIT",
      });
    }

    const valid: ParsedRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    raw.forEach((r, i) => {
      const result = normalizeRow(r);
      if (result.ok) valid.push(result.row);
      else errors.push({ row: i + 1, message: result.error });
    });

    const preview = valid.slice(0, 5);
    if (dryRun) {
      return res.json({
        totalRows: raw.length,
        valid: valid.length,
        errors,
        preview,
        created: 0,
        pendingReview: valid.length,
        reviewRequired: true,
      });
    }

    let maxQuestions = -1;
    if (bank.ownerType === "creator" && bank.ownerId) {
      const [creatorRow] = await db.select().from(creators).where(eq(creators.id, bank.ownerId));
      maxQuestions = getCreatorLimits(creatorRow?.plan).maxQuestionsPerBank;
    }

    const created = await insertQuestionsWithBankLock(id, valid.length, maxQuestions, async (tx) => {
      const existingTopics = await tx.select().from(questionTopics)
        .where(eq(questionTopics.bankId, id));
      const topicCache = new Map<string, number>(
        existingTopics.map((topic: typeof questionTopics.$inferSelect) => [topic.name.toLocaleLowerCase("en"), topic.id]),
      );
      const usedSlugs = new Set(existingTopics.map((topic: typeof questionTopics.$inferSelect) => topic.slug));
      const values: ReturnType<typeof questionInsertValues>[] = [];

      for (const row of valid) {
        let topicId: number | null = null;
        if (row.topic) {
          const topicKey = row.topic.toLocaleLowerCase("en");
          topicId = topicCache.get(topicKey) ?? null;
          if (!topicId) {
            const baseSlug = slugify(row.topic);
            let topicSlug = baseSlug;
            for (let suffix = 2; usedSlugs.has(topicSlug); suffix += 1) topicSlug = `${baseSlug}-${suffix}`;
            const [createdTopic] = await tx.insert(questionTopics).values({
              bankId: id,
              name: row.topic,
              slug: topicSlug,
              sortOrder: 0,
              parentId: null,
            }).returning({ id: questionTopics.id });
            const createdTopicId = Number(createdTopic.id);
            topicId = createdTopicId;
            topicCache.set(topicKey, createdTopicId);
            usedSlugs.add(topicSlug);
          }
        }
        values.push(questionInsertValues(row, id, req.ctx!.user.id, topicId));
      }

      if (values.length === 0) return 0;
      const inserted = await tx.insert(questions).values(values).returning({ id: questions.id });
      return inserted.length;
    });
    res.json({
      totalRows: raw.length,
      created,
      pendingReview: created,
      reviewRequired: true,
      errors,
      preview,
    });
  } catch (e: any) {
    console.error("import error:", e);
    if (e instanceof QuestionPlanLimitError) {
      return res.status(402).json({
        message: `Import would exceed the plan limit of ${e.limit} questions per bank.`,
        code: e.code,
      });
    }
    res.status(500).json({ message: "Question import failed. No questions were added." });
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
  const csv = Papa.unparse(rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, neutralizeSpreadsheetCell(value)]),
  )));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="bank-${id}-questions.csv"`);
  res.send(csv);
});

// ── Question versions ──────────────────────────────────────────────────────
router.get("/:id/questions/:qid/versions", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const bankId = positiveId(req.params.id);
  const questionId = positiveId(req.params.qid);
  if (!bankId || !questionId) return res.status(400).json({ message: "Invalid bank or question id" });
  const bank = await storage.getQuestionBank(bankId);
  if (!bank) return res.status(404).json({ message: "Bank not found" });
  if (!canViewBank(req.ctx!, bank)) return res.status(403).json({ message: "Forbidden" });
  if (!(await questionBelongsToBank(questionId, bankId))) return res.status(404).json({ message: "Question not found in this bank" });
  res.json(await storage.getQuestionVersions(questionId));
});

export default router;

// ── Course blueprint sub-router ────────────────────────────────────────────
export const courseBlueprintRouter = Router();

courseBlueprintRouter.get("/:courseId/blueprint", requireAuth, withCtx, async (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const courseId = Number(req.params.courseId);
  if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ message: "Invalid course id" });
  const course = await storage.getCourse(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });
  let allowed = !!ctx.user.isAdmin;
  if (!allowed && course.ownerType === "creator" && course.ownerId === ctx.creatorId) allowed = true;
  if (!allowed && course.ownerType === "institute" && course.ownerId != null) {
    const role = ctx.instituteRoles.get(course.ownerId);
    if (role && role !== "staff") allowed = true;
  }
  if (!allowed) return res.status(403).json({ message: "Forbidden" });
  const items = await storage.getCourseBlueprint(courseId);
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

  const parsed = z.object({
    items: z.array(z.object({
      bankId: z.number().int().positive(),
      topicId: z.number().int().positive().nullable().optional(),
      questionCount: z.number().int().min(1).max(500),
      difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
      marksPerQuestion: z.number().int().min(1).max(100),
      negativeMarks: z.number().int().min(0).max(100),
      sortOrder: z.number().int().min(0).max(500).optional(),
    }).strict()).max(100),
    changeNote: z.string().trim().max(500).optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Check each question-pool rule", issues: parsed.error.flatten() });
  }
  try {
    const saved = await storage.setCourseBlueprint(
      courseId,
      parsed.data.items,
      req.user?.userId,
      parsed.data.changeNote,
    );
    res.json(saved);
  } catch (error) {
    res.status(409).json({ message: error instanceof Error ? error.message : "Blueprint could not be saved" });
  }
});
