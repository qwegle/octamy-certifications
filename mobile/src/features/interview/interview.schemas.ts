import { z } from 'zod';

const structuredItemSchema = z.object({
  competency: z.string(),
  instructions: z.string(),
  key: z.string(),
  kind: z.literal('structured_response'),
  maximumWords: z.number().int().nonnegative(),
  minimumWords: z.number().int().nonnegative(),
  prompt: z.string(),
  responseFormat: z.enum(['text', 'text_or_transient_voice']),
  timeLimitSeconds: z.number().int().positive(),
  title: z.string(),
}).strict();

const publicTestCaseSchema = z.object({
  expectedOutput: z.string(),
  input: z.string(),
  key: z.string(),
  title: z.string(),
  visibility: z.literal('public'),
}).strict();

const codingItemSchema = z.object({
  competency: z.string(),
  constraints: z.array(z.string()),
  instructions: z.string(),
  interface: z.literal('stdin_stdout'),
  key: z.string(),
  kind: z.literal('coding'),
  language: z.literal('javascript'),
  problemStatement: z.string(),
  runtime: z.literal('javascript-node20-stdin-stdout-v1'),
  starterCode: z.string(),
  testCases: z.array(publicTestCaseSchema),
  timeLimitSeconds: z.number().int().positive(),
  title: z.string(),
}).strict();

export const interviewItemSchema = z.discriminatedUnion('kind', [structuredItemSchema, codingItemSchema]);

export const blueprintSchema = z.object({
  codingCount: z.number().int().nonnegative(),
  estimatedDurationMinutes: z.number().int().positive(),
  includesCoding: z.boolean(),
  itemCount: z.number().int().positive(),
  items: z.array(interviewItemSchema),
  level: z.string(),
  role: z.string(),
  skills: z.array(z.string()),
  summary: z.string(),
  title: z.string(),
}).strict();

export const interviewStatusSchema = z.object({
  aiEvaluationEnabled: z.boolean(),
  codeRunnerEnabled: z.boolean(),
  consentVersion: z.string(),
  evaluationWorkerEnabled: z.boolean(),
  limitations: z.array(z.string()),
  practiceEnabled: z.boolean(),
  recordingEnabled: z.literal(false),
  verifiedEnabled: z.literal(false),
  voiceTranscriptionEnabled: z.boolean(),
});

export const templateSchema = z.object({
  availableModes: z.array(z.string()),
  codingCount: z.number().int().nonnegative(),
  description: z.string(),
  difficulty: z.string(),
  durationMinutes: z.number().int().positive(),
  id: z.number().int().positive(),
  includesCoding: z.boolean(),
  itemCount: z.number().int().positive(),
  skills: z.array(z.string()),
  targetRole: z.string(),
  templateKey: z.string(),
  title: z.string(),
}).passthrough();

export const templatesResponseSchema = z.object({ items: z.array(templateSchema) });

const evaluationSchema = z.object({
  competencyEvidence: z.array(z.object({
    competency: z.string(),
    evidence: z.array(z.string()),
    score: z.number().nullable(),
  }).strict()).optional(),
  evaluatedAt: z.string().nullable().optional(),
  followUpQuestions: z.array(z.string()).optional().default([]),
  humanReviewReasons: z.array(z.string()).optional().default([]),
  improvementAreas: z.array(z.string()).optional().default([]),
  score: z.number().nullable().optional(),
  status: z.string(),
  strengths: z.array(z.string()).optional().default([]),
  summary: z.string().nullable().optional(),
}).strict();

const responseSchema = z.object({
  answerText: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  evaluation: evaluationSchema.nullable().optional(),
  evaluationStatus: z.string(),
  isFinal: z.boolean(),
  itemKey: z.string(),
  itemKind: z.enum(['coding', 'structured_response']),
  language: z.literal('javascript').nullable(),
  responseText: z.string().nullable().optional(),
  sampleTestResult: z.unknown().nullable(),
  timeSpentSeconds: z.number().int().nonnegative().nullable().optional(),
  updatedAt: z.string(),
}).strict();

export const interviewSessionSchema = z.object({
  blueprint: blueprintSchema,
  completedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  evaluation: evaluationSchema.nullable(),
  evaluationStatus: z.string(),
  id: z.string().min(1),
  mode: z.literal('practice'),
  navigation: z.object({
    canRevealNext: z.boolean(),
    currentIndex: z.number().int().nonnegative().nullable(),
    cursor: z.string().nullable(),
    revealedCount: z.number().int().nonnegative(),
    totalItems: z.number().int().positive(),
  }).strict(),
  overallScore: z.number().nullable(),
  recruiterSharingEnabled: z.literal(false),
  responses: z.array(responseSchema),
  retentionUntil: z.string(),
  startedAt: z.string().nullable(),
  status: z.string(),
  submittedAt: z.string().nullable(),
  templateId: z.number().int().positive(),
  templateKey: z.string(),
}).passthrough();

export const sessionListItemSchema = z.object({
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  evaluationStatus: z.string(),
  id: z.string(),
  mode: z.literal('practice'),
  overallScore: z.number().nullable(),
  retentionUntil: z.string(),
  startedAt: z.string().nullable(),
  status: z.string(),
  templateKey: z.string(),
  templateVersion: z.number().int().positive(),
});

export const sessionsResponseSchema = z.object({ items: z.array(sessionListItemSchema) });

export type InterviewItem = z.infer<typeof interviewItemSchema>;
export type InterviewSession = z.infer<typeof interviewSessionSchema>;
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;
export type InterviewTemplate = z.infer<typeof templateSchema>;
export type SessionListItem = z.infer<typeof sessionListItemSchema>;
