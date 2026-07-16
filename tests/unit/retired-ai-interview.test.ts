import { describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";
import {
  RETIRED_AI_INTERVIEW_PATHS,
  retiredAiInterviewHandler,
} from "../../server/lib/retired-ai-interview";

function retiredFeatureApp() {
  const app = express();
  app.all([...RETIRED_AI_INTERVIEW_PATHS], retiredAiInterviewHandler);
  return app;
}

describe("retired AI interview boundary", () => {
  it.each([
    ["GET", "/api/interview-technologies"],
    ["POST", "/api/interviews/initiate-payment"],
    ["GET", "/api/interviews/42"],
    ["POST", "/api/interviews/42/submit"],
    ["GET", "/api/interview-responses/42"],
    ["POST", "/api/upload-video"],
    ["GET", "/api/admin/interview-questions"],
    ["PUT", "/api/admin/interview-questions/7"],
    ["GET", "/api/user/interviews"],
  ])("returns 410 for %s %s", async (method, path) => {
    const response = await request(retiredFeatureApp())
      [method.toLowerCase() as "get"](path)
      .expect(410);

    expect(response.body).toEqual(expect.objectContaining({
      code: "FEATURE_REMOVED",
    }));
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
