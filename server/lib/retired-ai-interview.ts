import type { RequestHandler } from "express";

export const RETIRED_AI_INTERVIEW_PATHS = [
  "/api/interview-technologies",
  "/api/interviews",
  "/api/interviews/*",
  "/api/interview-responses/*",
  "/api/upload-video",
  "/api/admin/interview-questions",
  "/api/admin/interview-questions/*",
  "/api/user/interviews",
] as const;

export const retiredAiInterviewHandler: RequestHandler = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(410).json({
    message: "The AI Interview feature has been retired. Please use Get Certified assessments instead.",
    code: "FEATURE_REMOVED",
  });
};
