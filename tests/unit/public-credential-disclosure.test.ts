import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("public credential disclosure", () => {
  it("bounds every unauthenticated credential retrieval route", async () => {
    const routes = await source("server/routes/certificateRoutes.ts");
    for (const route of ["/verify/:id", "/:id/download", "/:id"]) {
      const line = routes.split("\n").find((candidate) => candidate.includes(`'${route}'`));
      expect(line).toBeDefined();
      expect(line).toContain("credentialRetrievalLimiter");
    }
    // Owner-only actions must stay authenticated.
    const activation = routes.split("\n").find((line) => line.includes("/:id/activation"));
    expect(activation).toContain("requireUser");
    const create = routes.split("\n").find((line) => line.includes("'/create'"));
    expect(create).toContain("requireUser");
  });

  it("renders a credential from allowlisted public fields only", async () => {
    const controller = await source("server/controllers/certificateController.ts");
    const start = controller.indexOf("static async downloadCertificate");
    const end = controller.indexOf("static async", start + 10);
    expect(start).toBeGreaterThan(-1);
    const download = controller.slice(start, end === -1 ? undefined : end);

    const payloadStart = download.indexOf("const certificateData = {");
    const payloadEnd = download.indexOf("};", payloadStart);
    const payload = download.slice(payloadStart, payloadEnd);

    for (const field of ["certificateId", "userName", "courseTitle", "userScore", "verificationUrl"]) {
      expect(payload).toContain(field);
    }
    // Private evidence must never reach a publicly retrievable credential.
    for (const forbidden of ["userEmail", "answers", "ipAddress", "userAgent", "tabSwitches", "sessionId"]) {
      expect(payload).not.toContain(forbidden);
    }
    // Revoked, unpaid, and expired credentials must still fail closed.
    expect(download).toContain("Payment required");
    expect(download).toContain("revoked");
    expect(download).toContain("expired");
  });
});
