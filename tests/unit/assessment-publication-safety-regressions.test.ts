import { afterEach, describe, expect, it } from "@jest/globals";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readRightsEvidence } from "../../scripts/register-question-pack-source";

const root = process.cwd();
const tempDirectories: string[] = [];

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe("assessment publication safety regressions", () => {
  it("quarantines the 0030 restore without deleting provenance", async () => {
    const migration = await source("migrations/0031_quarantine_unreviewed_practice_restore.sql");
    expect(migration).toContain("octamy-original:quant-science:v1");
    expect(migration).toContain('"review_status" = \'retired\'');
    expect(migration).toContain('question."reviewed_by" IS NULL');
    expect(migration).toContain('question."reviewed_at" IS NULL');
    expect(migration).toContain("ssc-cgl-tier-1-quantitative-aptitude-practice");
    expect(migration).toContain("octamy_0031_quarantined_banks");
    expect(migration).toContain('course."is_active" = true');
    expect(migration).toContain('course."visibility" = \'public\'');
    expect(migration).not.toContain('"reviewed_by" = NULL');
    expect(migration).not.toContain('"reviewed_at" = NULL');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);

    const returningIndex = migration.indexOf('RETURNING question."bank_id"');
    const captureIndex = migration.indexOf('INSERT INTO "octamy_0031_quarantined_banks"');
    const bankUpdateIndex = migration.indexOf('UPDATE "question_banks" bank');
    const bankScopeIndex = migration.indexOf('FROM "octamy_0031_quarantined_banks" quarantined_bank');
    const courseUpdateIndex = migration.indexOf('UPDATE "courses" course');
    const courseScopeIndex = migration.indexOf('INNER JOIN "octamy_0031_quarantined_banks" quarantined_bank');
    expect(returningIndex).toBeGreaterThan(0);
    expect(captureIndex).toBeGreaterThan(returningIndex);
    expect(bankUpdateIndex).toBeGreaterThan(captureIndex);
    expect(bankScopeIndex).toBeGreaterThan(bankUpdateIndex);
    expect(courseUpdateIndex).toBeGreaterThan(bankScopeIndex);
    expect(courseScopeIndex).toBeGreaterThan(courseUpdateIndex);

    const snapshots = (await readdir(path.join(root, "migrations/meta")))
      .filter((name) => name.endsWith("_snapshot.json"))
      .sort();
    expect(snapshots).toEqual(["0000_snapshot.json"]);
  });

  it("requires attributable item review with no source-specific runtime exception", async () => {
    const policy = await source("server/lib/question-review-policy.ts");
    const runtimeFunction = policy.slice(policy.indexOf("export function assessmentRuntimeReviewEligibilitySql"));
    expect(runtimeFunction).toContain("questions.reviewedBy");
    expect(runtimeFunction).toContain("questions.reviewedAt");
    expect(runtimeFunction).not.toContain("octamy-original:quant-science:v1");
    expect(runtimeFunction).not.toContain("rights_review_status");
  });

  it("unpublishes every assessment identified by the governed audit without deleting data", async () => {
    const migration = await source("migrations/0033_unpublish_audited_blocked_assessments.sql");
    const unsafeSlugs = [
      "ibps-clerk-quantitative-aptitude-practice",
      "ibps-po-quantitative-aptitude-practice",
      "jee-main-chemistry-numerical-practice",
      "jee-main-physics-numerical-practice",
      "neet-ug-chemistry-numerical-practice",
      "neet-ug-physics-numerical-practice",
      "rrb-group-d-mathematics-practice",
      "rrb-ntpc-mathematics-practice",
      "ssc-cgl-tier-1-quantitative-aptitude-practice",
      "ssc-chsl-tier-1-quantitative-aptitude-practice",
      "ssc-mts-numerical-aptitude-practice",
    ];
    unsafeSlugs.forEach((slug) => expect(migration).toContain(`'${slug}'`));
    expect(migration).toContain('"is_active" = false');
    expect(migration).toContain('"visibility" = \'private\'');
    expect(migration).toContain('"review_status" = \'pending\'');
    expect(migration).toContain('course."is_active" = true');
    expect(migration).toContain('course."visibility" = \'public\'');
    expect(migration).toContain('course."review_status" = \'approved\'');
    expect(migration).not.toMatch(/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i);
  });

  it("materializes every blueprint quota exactly once and fails closed on a short draw", async () => {
    const storage = await source("server/storage.ts");
    const start = storage.indexOf("async materializeBlueprintForAttempt");
    const end = storage.indexOf("\n  }\n}\n\nexport const storage", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const materialize = storage.slice(start, end);

    const exclusion = materialize.indexOf("notInArray(questions.id, selectedIds)");
    const configuredLimit = materialize.indexOf(".limit(item.questionCount)");
    const shortDrawGuard = materialize.indexOf("if (pool.length < item.questionCount)");
    const append = materialize.indexOf("result.push(...pool)");
    const rememberIds = materialize.indexOf("selectedIds.push(...pool.map((question) => question.id))");

    expect(materialize).toContain('throw new Error("Course has no blueprint configured")');
    expect(exclusion).toBeGreaterThan(0);
    expect(configuredLimit).toBeGreaterThan(exclusion);
    expect(shortDrawGuard).toBeGreaterThan(configuredLimit);
    expect(materialize.slice(shortDrawGuard, append)).toContain("blueprint requires ${item.questionCount}");
    expect(append).toBeGreaterThan(shortDrawGuard);
    expect(rememberIds).toBeGreaterThan(append);
  });

  it("rechecks attributable approval before blueprint and direct-bank questions are served", async () => {
    const storage = await source("server/storage.ts");
    const materializeStart = storage.indexOf("async materializeBlueprintForAttempt(courseId: number)");
    const materializeEnd = storage.indexOf("\n  }\n}\n\nexport const storage", materializeStart);
    const materialize = storage.slice(materializeStart, materializeEnd);
    expect(materialize).toContain('eq(questions.reviewStatus, "approved")');
    expect(materialize).toContain("assessmentRuntimeReviewEligibilitySql()");

    const publicRoutes = await source("server/routes.ts");
    const publicStart = publicRoutes.slice(
      publicRoutes.indexOf('app.post("/api/courses/:id/questions"'),
      publicRoutes.indexOf("// EXAM SUBMISSION ENDPOINT", publicRoutes.indexOf('app.post("/api/courses/:id/questions"')),
    );
    expect(publicStart).toContain('course.visibility !== "public"');
    expect(publicStart).toContain('course.reviewStatus !== "approved"');
    expect(publicStart).toContain("assessmentRuntimeReviewEligibilitySql()");
    expect(publicStart).toContain("lockedQuestions.length !== selectedIds.length");

    const featureRoutes = await source("server/routes/featureRoutes.ts");
    const directStart = featureRoutes.slice(
      featureRoutes.indexOf("router.post('/x/:code/start'"),
      featureRoutes.indexOf("router.post('/exam-attempts/:id/heartbeat'"),
    );
    expect(directStart).toContain("eq(questions.reviewStatus, 'approved')");
    expect(directStart).toContain("isNotNull(questions.reviewedBy)");
    expect(directStart).toContain("isNotNull(questions.reviewedAt)");
    expect(directStart).toContain("sourceQuestions.length !== inst.questionCount");
  });

  it("classifies in-house catalog rows explicitly as practice", async () => {
    const sync = await source("scripts/sync-inhouse-assessment-catalog.ts");
    expect(sync).toContain("0022_assessment_purpose_split");
    expect(sync).toContain("ASSESSMENT_BANK_PURPOSE_CONFLICT");
    expect(sync).toContain("ASSESSMENT_PURPOSE_CONFLICT");
    expect(sync).toMatch(/SELECT id, bank_purpose/);
    expect(sync).toMatch(/product_type, assessment_purpose, is_active/);
    expect(sync).toMatch(/bank_purpose[\s\S]{0,200}'practice'/);
    expect(sync).toMatch(/assessment_purpose[\s\S]{0,300}'practice'/);

    const coursePreflightIndex = sync.indexOf("const existingCourseRows");
    const preflightLockIndex = sync.indexOf("FOR UPDATE", coursePreflightIndex);
    const courseMapIndex = sync.indexOf("const existingCoursesBySlug");
    const ownershipGuardIndex = sync.indexOf("ASSESSMENT_SLUG_OWNERSHIP_CONFLICT");
    const purposeGuardIndex = sync.indexOf("ASSESSMENT_PURPOSE_CONFLICT");
    const bankGuardIndex = sync.indexOf("ASSESSMENT_BANK_PURPOSE_CONFLICT");
    const bankInsertIndex = sync.indexOf("`INSERT INTO question_banks");
    const topicInsertIndex = sync.indexOf("`INSERT INTO question_topics");
    const mapUseIndex = sync.indexOf("existingCoursesBySlug.get(assessment.slug)");
    const courseInsertIndex = sync.indexOf("`INSERT INTO courses");
    expect(coursePreflightIndex).toBeGreaterThan(0);
    expect(preflightLockIndex).toBeGreaterThan(coursePreflightIndex);
    expect(courseMapIndex).toBeGreaterThan(preflightLockIndex);
    expect(ownershipGuardIndex).toBeGreaterThan(courseMapIndex);
    expect(purposeGuardIndex).toBeGreaterThan(ownershipGuardIndex);
    expect(bankGuardIndex).toBeGreaterThan(purposeGuardIndex);
    expect(bankInsertIndex).toBeGreaterThan(bankGuardIndex);
    expect(topicInsertIndex).toBeGreaterThan(bankInsertIndex);
    expect(mapUseIndex).toBeGreaterThan(topicInsertIndex);
    expect(courseInsertIndex).toBeGreaterThan(mapUseIndex);
  });

  it("keeps the career catalog seed shell-only and protects existing assets", async () => {
    const seed = await source("scripts/seed-career-certification-catalog.mjs");
    expect(seed).toContain("CAREER_SHELLS_ONLY");
    expect(seed).toContain("protectedExistingCount");
    expect(seed).toContain("CAREER_BANK_ORPHAN_CONFLICT");
    expect(seed).not.toMatch(/UPDATE\s+questions/i);
    expect(seed).not.toMatch(/UPDATE\s+question_banks/i);
    expect(seed).not.toMatch(/UPDATE\s+courses/i);
    expect(seed).not.toMatch(/INSERT\s+INTO\s+course_question_blueprint/i);
  });

  it("documents the certification-grade provenance and release-evidence path", async () => {
    const documentation = await source("docs/QUESTION_IMPORT_FORMAT.md");
    expect(documentation).toContain("Certification-grade imports (JSONL only)");
    expect(documentation).toContain("--evidence-file");
    expect(documentation).toContain("syllabusVersion");
    expect(documentation).toContain("objectiveCode");
    expect(documentation).toContain("distractorReview");
  });
});

describe("rights evidence artifacts", () => {
  it("records a deterministic hash without retaining the proof contents", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "octamy-rights-proof-"));
    tempDirectories.push(directory);
    const evidencePath = path.join(directory, "assignment.txt");
    await writeFile(evidencePath, "signed assignment fixture", "utf8");

    await expect(readRightsEvidence(evidencePath)).resolves.toEqual({
      fileName: "assignment.txt",
      byteLength: 25,
      sha256: "f126a10a95dd20464607b0f87ac26c4f96d28ac835c5ebd6ec7e9c2218eee2f0",
    });
  });

  it("does not follow a symbolic link presented as rights evidence", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "octamy-rights-proof-"));
    tempDirectories.push(directory);
    const target = path.join(directory, "target.txt");
    const link = path.join(directory, "link.txt");
    await writeFile(target, "fixture", "utf8");
    await symlink(target, link);
    await expect(readRightsEvidence(link)).rejects.toThrow("must not be a symbolic link");
  });
});
