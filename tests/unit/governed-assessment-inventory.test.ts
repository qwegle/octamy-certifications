import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "@jest/globals";
import {
  assertGovernedInventoryReadOnlyMode,
  evaluateGovernedAssessmentInventory,
  governedAssessmentContentManifestSha256,
  governedMachineArtifactReference,
  governedReleaseBundleSha256,
  groupInventoryIssues,
  inventoryBlockerSeverity,
  OFFICER_ITEM_AUTHORSHIP_DISCLOSURE,
  type GovernedAssessmentInventoryInput,
  type InventoryReleaseBundle,
} from "../../scripts/lib/governed-assessment-inventory";
import { governedInventoryGateFailure } from "../../scripts/governed-assessment-inventory";
import {
  assertAuthorizedReleasePrincipals,
  assertSingleOfficerItemIndependence,
} from "../../scripts/record-assessment-release-evidence";
import { assertGrantableReleaseIdentity } from "../../scripts/grant-assessment-release-role";

const EVIDENCE_CODES = [
  "RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE",
  "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED",
  "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED",
];

function blockedFixture(): GovernedAssessmentInventoryInput {
  return {
    id: 42,
    slug: "test-only-governance-fixture",
    title: "Test-only governance fixture",
    ownerType: "admin",
    productType: "assessment",
    assessmentPurpose: "certification",
    passingScore: 70,
    useBlueprintEngine: true,
    visibility: "public",
    reviewStatus: "approved",
    isActive: true,
    blueprintRevisionCount: 0,
    blueprintRevision: null,
    rules: [{
      id: 7,
      bankId: 9,
      topicId: 3,
      questionCount: 20,
      difficulty: "mixed",
      bank: { id: 9, slug: "test-only-practice-bank", purpose: "practice", status: "draft", syllabusVersion: null },
    }],
    questions: [{
      id: 101,
      bankId: 9,
      topicId: 3,
      question: "Which test-only option demonstrates the expected governed behavior?",
      questionFormat: "mcq_single",
      options: ["First", "Second", "Third"],
      correctAnswer: 0,
      difficulty: "medium",
      explanation: null,
      generationSource: "human",
      reviewStatus: "approved",
      isActive: true,
      createdBy: 5,
      reviewedBy: 5,
      reviewedAt: "2026-07-27T00:00:00.000Z",
      version: 2,
      versionHistoryCount: 0,
      contentHash: "a".repeat(64),
      answerMetadata: null,
      imageUrl: "https://example.invalid/test-only.png",
      imageAltText: null,
      optionMedia: [{ url: "https://example.invalid/option.png", alt: "" }],
      sourceLinks: [],
    }],
    releaseEvidence: { accessibilityAcceptances: [], rightsRoleReviews: [], releaseBundles: [] },
  };
}

function acceptedFixture(): GovernedAssessmentInventoryInput {
  const evidenceSha = "b".repeat(64);
  const questions = Array.from({ length: 80 }, (_, index) => {
    const id = index + 1;
    const correctAnswer = id % 3;
    return {
      id,
      bankId: 9,
      topicId: 3,
      question: `For independently reviewed capacity scenario ${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}, which result follows from ${id + 10} units multiplied by 10?`,
      questionFormat: "mcq_single",
      options: [String((id + 10) * 5), String((id + 10) * 10), String((id + 10) * 20)],
      correctAnswer,
      difficulty: id % 5 === 0 ? "hard" : id % 2 === 0 ? "easy" : "medium",
      explanation: `Multiply ${id + 10} units by 10 to obtain the independently verified keyed result.`,
      generationSource: "human",
      reviewStatus: "approved",
      isActive: true,
      createdBy: 11,
      reviewedBy: 12,
      reviewedAt: "2026-07-27T08:00:00.000Z",
      version: 2,
      versionHistoryCount: 1,
      contentHash: createHash("sha256").update(`question-${id}`).digest("hex"),
      answerMetadata: null,
      releaseEvidence: {
        syllabusVersion: "certification-v1",
        objectiveCode: `OBJECTIVE-${id}`,
        answerValidation: { status: "verified" as const, method: "independent_calculation" as const, reference: `calculation-sheet-${id}` },
        distractorReview: { status: "verified" as const, note: "Both distractors represent plausible calculation mistakes." },
        reviewAttestation: {
          status: "attested" as const,
          note: "I independently checked this exact item, keyed answer, explanation, and distractors.",
          contentHash: createHash("sha256").update(`question-${id}`).digest("hex"),
          contentVersion: 1,
          decisionVersion: 2,
          reviewerId: 12,
        },
      },
      imageUrl: null,
      imageAltText: null,
      optionMedia: null,
      sourceLinks: [{
        sourceId: 21,
        sourceKey: "test-only:owned:v1",
        rightsReviewStatus: "verified",
        commercialUseAllowed: true,
        derivativesAllowed: true,
        evidenceReference: "rights-vault/test-only-owned-v1",
        rightsReviewedAt: "2026-07-26T08:00:00.000Z",
        rightsReviewedBy: "Named legacy rights reviewer",
        sourceProvenance: { rightsReview: { acquiringEntity: "Octamy Learning Private Limited", evidenceSha256: evidenceSha } },
        provenanceContentHash: createHash("sha256").update(`question-${id}`).digest("hex"),
      }],
    };
  });
  return {
    id: 43,
    slug: "release-ready-governance-fixture",
    title: "Release-ready governance fixture",
    ownerType: "admin",
    productType: "assessment",
    assessmentPurpose: "certification",
    passingScore: 70,
    useBlueprintEngine: true,
    visibility: "private",
    reviewStatus: "pending",
    isActive: false,
    blueprintRevisionCount: 1,
    blueprintRevision: 3,
    rules: [{
      id: 8,
      bankId: 9,
      topicId: 3,
      questionCount: 20,
      difficulty: "mixed",
      bank: { id: 9, slug: "test-only-certification-bank", purpose: "certification", status: "active", syllabusVersion: "certification-v1" },
    }],
    questions,
    releaseEvidence: { accessibilityAcceptances: [], rightsRoleReviews: [], releaseBundles: [] },
  };
}

function addCompleteEvidence(input: GovernedAssessmentInventoryInput): GovernedAssessmentInventoryInput {
  const releasedAt = "2026-07-27T12:00:00.000Z";
  input.releaseEvidence.accessibilityAcceptances = [{
    blueprintRevision: 3,
    reviewerUserId: 13,
    standard: "WCAG 2.2 AA assessment acceptance",
    evidenceReference: "evidence/accessibility/assessment-43-revision-3",
    evidenceSha256: "c".repeat(64),
    acceptedAt: "2026-07-27T09:00:00.000Z",
  }];
  input.releaseEvidence.rightsRoleReviews = [{
    blueprintRevision: 3,
    sourceId: 21,
    reviewerUserId: 14,
    evidenceReference: "rights-vault/test-only-owned-v1",
    evidenceSha256: "b".repeat(64),
    reviewedAt: "2026-07-27T09:30:00.000Z",
  }];
  const unsigned: Omit<InventoryReleaseBundle, "bundleSha256"> = {
    blueprintRevision: 3,
    contentManifestSha256: governedAssessmentContentManifestSha256(input),
    formSimulationReference: "evidence/form-simulation/assessment-43-revision-3",
    formSimulationSha256: "d".repeat(64),
    cutScore: 70,
    cutScoreMethod: "Modified Angoff panel approval",
    cutScoreApprovalReference: "evidence/cut-score/assessment-43-revision-3",
    cutScoreApprovalSha256: "e".repeat(64),
    cutScoreApproverUserId: 15,
    cutScoreApprovedAt: "2026-07-27T10:00:00.000Z",
    releaseQaReference: "evidence/release-qa/assessment-43-revision-3",
    releaseQaSha256: "f".repeat(64),
    qaReviewerUserId: 16,
    qaAcceptedAt: "2026-07-27T10:30:00.000Z",
    contentReviewerUserId: 12,
    publisherUserId: 17,
    publisherSignedAt: "2026-07-27T11:00:00.000Z",
    releaseCommit: "1".repeat(40),
    releasedAt,
    rollbackOwnerUserId: 18,
    takedownProcedure: "Disable public access, preserve evidence, notify owners, and open the reviewed rollback runbook.",
    takedownProcedureSha256: "",
  };
  unsigned.takedownProcedureSha256 = createHash("sha256").update(unsigned.takedownProcedure).digest("hex");
  input.releaseEvidence.releaseBundles = [{ ...unsigned, bundleSha256: governedReleaseBundleSha256(unsigned) }];
  return input;
}

function machineArtifactReference(
  artifactType: "form_simulation" | "representative_attempt_qa" | "accessibility_content_audit",
  blueprintRevision = 3,
) {
  const reference = governedMachineArtifactReference({
    schemaVersion: "octamy.release-machine-artifact.v1",
    artifactType,
    assessmentId: 43,
    blueprintRevision,
    generatedAt: "2026-07-27T08:30:00.000Z",
    passed: true,
    summary: `Passed ${artifactType.replaceAll("_", " ")} checks.`,
    checks: [{ name: "result", passed: true, detail: "All configured assertions passed." }],
  });
  return { reference, sha256: createHash("sha256").update(reference).digest("hex") };
}

function addSingleOfficerEvidence(input: GovernedAssessmentInventoryInput): GovernedAssessmentInventoryInput {
  addCompleteEvidence(input);
  const officer = 19;
  const form = machineArtifactReference("form_simulation");
  const qa = machineArtifactReference("representative_attempt_qa");
  const accessibility = machineArtifactReference("accessibility_content_audit");
  input.releaseEvidence.accessibilityAcceptances[0] = {
    ...input.releaseEvidence.accessibilityAcceptances[0],
    reviewerUserId: officer,
    evidenceReference: accessibility.reference,
    evidenceSha256: accessibility.sha256,
  };
  input.releaseEvidence.rightsRoleReviews[0].reviewerUserId = officer;
  const prior = input.releaseEvidence.releaseBundles[0];
  const { bundleSha256: _priorHash, ...base } = prior;
  const unsigned: Omit<InventoryReleaseBundle, "bundleSha256"> = {
    ...base,
    attestationMode: "single_accountable_officer",
    accountableOfficerUserId: officer,
    singleOfficerAttestation: "I accept named accountability for this small-organisation release.",
    formSimulationReference: form.reference,
    formSimulationSha256: form.sha256,
    releaseQaReference: qa.reference,
    releaseQaSha256: qa.sha256,
    contentReviewerUserId: officer,
    cutScoreApproverUserId: officer,
    qaReviewerUserId: officer,
    publisherUserId: officer,
    rollbackOwnerUserId: officer,
  };
  input.releaseEvidence.releaseBundles[0] = { ...unsigned, bundleSha256: governedReleaseBundleSha256(unsigned) };
  return input;
}

function codes(input: GovernedAssessmentInventoryInput) {
  return evaluateGovernedAssessmentInventory(input).issues.map((found) => found.code);
}

  it("aligns the release trigger with officer-item-authorship disclosure policy", () => {
    const sql = readFileSync(
      "migrations/0043_align_officer_item_authorship_disclosure.sql",
      "utf8",
    );
    const functionBody = sql.match(
      /CREATE OR REPLACE FUNCTION\s+enforce_assessment_release_role_separation\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$ LANGUAGE plpgsql;/,
    )?.[1];

    expect(sql).toMatch(
      /CREATE TRIGGER\s+assessment_release_bundles_role_separation[\s\S]*?ON\s+"assessment_release_bundles"[\s\S]*?EXECUTE FUNCTION\s+enforce_assessment_release_role_separation\(\);/,
    );
    expect(functionBody).toBeDefined();
    expect(functionBody).not.toMatch(/question\."created_by"\s*=\s*single_officer\s+OR\s+question\."reviewed_by"/);
    expect(functionBody).toContain('question."reviewed_by" = single_officer');
    expect(functionBody).toContain('question."created_by" = single_officer');
    expect(functionBody).toContain('NEW."single_officer_attestation"');
    expect(functionBody).toContain('NEW."takedown_procedure"');
    expect(functionBody?.match(/ACCOUNTABLE_OFFICER_ITEM_AUTHORSHIP_DISCLOSURE/g)).toHaveLength(1);
    expect(functionBody).toContain("Single accountable officer must be a platform administrator");
    expect(functionBody).toContain("Single accountable officer requires a current release_operator grant");
    expect(functionBody).toContain("Release attestation mode must be multi_party or single_accountable_officer");
    expect(functionBody).toContain("Release sign-off roles must be independent from accessibility and rights reviewers");
  });

describe("governed assessment inventory", () => {
  it("refuses every mode except dry-run", () => {
    expect(() => assertGovernedInventoryReadOnlyMode("dry-run")).not.toThrow();
    expect(() => assertGovernedInventoryReadOnlyMode("publish")).toThrow(/READ_ONLY_ONLY/);
    expect(() => assertGovernedInventoryReadOnlyMode("apply")).toThrow(/READ_ONLY_ONLY/);
  });

  it("fails closed with exact governance reasons and marks unsafe published rows", () => {
    const report = evaluateGovernedAssessmentInventory(blockedFixture());
    expect(report.status).toBe("blocked");
    expect(report.releaseReady).toBe(false);
    expect(report.unsafePublished).toBe(true);
    expect(report.issues.map((found) => found.code)).toEqual(expect.arrayContaining([
      "BLUEPRINT_REVISION_REQUIRED", "BANK_PURPOSE_MISMATCH", "BANK_NOT_ACTIVE", "BANK_SYLLABUS_VERSION_REQUIRED",
      "QUESTION_PROVENANCE_REQUIRED", "QUESTION_VERSION_HISTORY_REQUIRED", "QUESTION_IMAGE_ALT_TEXT_REQUIRED",
      "OPTION_MEDIA_ALT_TEXT_REQUIRED", ...EVIDENCE_CODES, "INDEPENDENT_REVIEW_REQUIRED",
      "FACTUAL_ANSWER_VALIDATION_REQUIRED", "ITEM_REVIEW_ATTESTATION_REQUIRED",
      "BLUEPRINT_RULE_INVENTORY_INCOMPLETE", "ASSESSMENT_INVENTORY_INCOMPLETE",
    ]));
  });

  it("keeps all representational blockers when evidence is absent", () => {
    expect(codes(acceptedFixture())).toEqual(expect.arrayContaining(EVIDENCE_CODES));
  });

  it("does not mark a published assessment unsafe when only release evidence is missing", () => {
    const fixture = acceptedFixture();
    fixture.visibility = "public";
    fixture.reviewStatus = "approved";
    fixture.isActive = true;
    const report = evaluateGovernedAssessmentInventory(fixture);

    expect(report.releaseReady).toBe(false);
    expect(report.unsafePublished).toBe(false);
    expect(report.publishedMissingReleaseEvidence).toBe(true);
    expect(report.issues).toHaveLength(EVIDENCE_CODES.length);
    expect(report.issues.every((found) => found.blockerSeverity === "RELEASE_EVIDENCE")).toBe(true);
  });

  it("marks a published assessment unsafe when any substantive blocker exists", () => {
    const fixture = acceptedFixture();
    fixture.visibility = "public";
    fixture.reviewStatus = "approved";
    fixture.isActive = true;
    fixture.questions[0].explanation = null;
    const report = evaluateGovernedAssessmentInventory(fixture);

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "EXPLANATION_REQUIRED", blockerSeverity: "SUBSTANTIVE" }),
    ]));
    expect(report.unsafePublished).toBe(true);
  });

  it("makes release-evidence-only publication fail only under the strict CLI option", () => {
    const summary = { publishedWithSubstantiveBlockers: 0, publishedMissingReleaseEvidence: 1 };
    expect(governedInventoryGateFailure(summary, { failOnUnsafePublished: true })).toBeNull();
    expect(governedInventoryGateFailure(summary, { requireReleaseEvidence: true }))
      .toMatch(/lack strict administrative release evidence/);
    expect(governedInventoryGateFailure(
      { publishedWithSubstantiveBlockers: 1, publishedMissingReleaseEvidence: 0 },
      { requireReleaseEvidence: true },
    )).toMatch(/substantive content or legal blockers/);
  });

  it("permits officer-as-item-author only with the explicit disclosure acknowledgement", () => {
    const questions = [{ created_by: 19, reviewed_by: 12 }];
    expect(() => assertSingleOfficerItemIndependence(19, questions, false))
      .toThrow(/OFFICER_ITEM_AUTHORSHIP_DISCLOSURE_REQUIRED/);
    expect(assertSingleOfficerItemIndependence(19, questions, true)).toEqual({
      officerIsItemAuthor: true,
      officerIsRecordedItemReviewer: false,
      disclosure: OFFICER_ITEM_AUTHORSHIP_DISCLOSURE,
    });
  });

  it("still refuses an officer who is the recorded independent item reviewer", () => {
    expect(() => assertSingleOfficerItemIndependence(19, [{ created_by: 11, reviewed_by: 19 }], false))
      .toThrow(/SELF_APPROVAL_FORBIDDEN.*recorded independent item reviewer/);
  });

  it("surfaces the immutable officer-authorship disclosure and lack of multi-party review", () => {
    const fixture = acceptedFixture();
    fixture.questions[0].createdBy = 19;
    addSingleOfficerEvidence(fixture);
    const bundle = fixture.releaseEvidence.releaseBundles[0];
    bundle.singleOfficerAttestation = `${bundle.singleOfficerAttestation}\n\n${OFFICER_ITEM_AUTHORSHIP_DISCLOSURE}`;
    bundle.takedownProcedure = `${bundle.takedownProcedure}\n\n${OFFICER_ITEM_AUTHORSHIP_DISCLOSURE}`;
    bundle.takedownProcedureSha256 = createHash("sha256").update(bundle.takedownProcedure).digest("hex");
    const { bundleSha256: _old, ...unsigned } = bundle;
    bundle.bundleSha256 = governedReleaseBundleSha256(unsigned);

    const report = evaluateGovernedAssessmentInventory(fixture);
    expect(report.releaseReady).toBe(true);
    expect(report.releaseAttestation).toEqual({
      mode: "single_accountable_officer",
      accountableOfficerUserId: 19,
      officerIsItemAuthor: true,
      officerIsRecordedItemReviewer: false,
      independentMultiPartyReleaseReview: false,
      officerItemAuthorshipDisclosure: OFFICER_ITEM_AUTHORSHIP_DISCLOSURE,
    });
  });

  it("does not accept officer authorship when the immutable disclosure is absent", () => {
    const fixture = acceptedFixture();
    fixture.questions[0].createdBy = 19;
    const report = evaluateGovernedAssessmentInventory(addSingleOfficerEvidence(fixture));
    expect(report.releaseReady).toBe(false);
    expect(report.releaseAttestation.officerIsItemAuthor).toBe(true);
    expect(report.releaseAttestation.officerItemAuthorshipDisclosure).toBeNull();
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED" }),
    ]));
  });

  it("evaluator refuses a single officer recorded as the item reviewer", () => {
    const fixture = acceptedFixture();
    fixture.questions[0].reviewedBy = 19;
    if (fixture.questions[0].releaseEvidence?.reviewAttestation) {
      fixture.questions[0].releaseEvidence.reviewAttestation.reviewerId = 19;
    }
    const report = evaluateGovernedAssessmentInventory(addSingleOfficerEvidence(fixture));
    expect(report.releaseReady).toBe(false);
    expect(report.releaseAttestation.officerIsRecordedItemReviewer).toBe(true);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "RIGHTS_ROLE_SEPARATION_VIOLATED", blockerSeverity: "SUBSTANTIVE" }),
      expect.objectContaining({ code: "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED" }),
    ]));
  });

  it("clears the blockers only for complete attributable current-revision evidence", () => {
    const report = evaluateGovernedAssessmentInventory(addCompleteEvidence(acceptedFixture()));
    expect(report.issues).toEqual([]);
    expect(report.releaseReady).toBe(true);
    expect(report.status).toBe("release_ready");
    expect(report.evidenceRepresentation).toEqual({
      itemAccessibilityFields: true,
      assessmentAccessibilityAcceptance: true,
      immutableReleaseBundle: true,
      attributableRightsReviewerIdentity: true,
    });
  });

  it("accepts single-accountable-officer mode only with all complete current machine artifacts", () => {
    const report = evaluateGovernedAssessmentInventory(addSingleOfficerEvidence(acceptedFixture()));
    expect(report.issues).toEqual([]);
    expect(report.releaseReady).toBe(true);
  });

  it("refuses single-accountable-officer mode without all three machine artifacts", () => {
    const fixture = addSingleOfficerEvidence(acceptedFixture());
    fixture.releaseEvidence.releaseBundles[0].formSimulationReference = "evidence/form-simulation/bare-human-claim";
    const { bundleSha256: _old, ...unsigned } = fixture.releaseEvidence.releaseBundles[0];
    fixture.releaseEvidence.releaseBundles[0].bundleSha256 = governedReleaseBundleSha256(unsigned);
    expect(codes(fixture)).toContain("IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED");
  });

  it("refuses stale or hash-mismatched single-officer artifacts", () => {
    const stale = addSingleOfficerEvidence(acceptedFixture());
    const oldAccessibility = machineArtifactReference("accessibility_content_audit", 2);
    stale.releaseEvidence.accessibilityAcceptances[0].evidenceReference = oldAccessibility.reference;
    stale.releaseEvidence.accessibilityAcceptances[0].evidenceSha256 = oldAccessibility.sha256;
    expect(codes(stale)).toContain("ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED");

    const mismatched = addSingleOfficerEvidence(acceptedFixture());
    mismatched.releaseEvidence.releaseBundles[0].releaseQaSha256 = "0".repeat(64);
    const { bundleSha256: _old, ...unsigned } = mismatched.releaseEvidence.releaseBundles[0];
    mismatched.releaseEvidence.releaseBundles[0].bundleSha256 = governedReleaseBundleSha256(unsigned);
    expect(codes(mismatched)).toContain("IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED");
  });

  it("keeps six distinct approval principals mandatory in multi-party mode", () => {
    const fixture = addCompleteEvidence(acceptedFixture());
    fixture.releaseEvidence.releaseBundles[0].qaReviewerUserId = fixture.releaseEvidence.releaseBundles[0].publisherUserId;
    const { bundleSha256: _old, ...unsigned } = fixture.releaseEvidence.releaseBundles[0];
    fixture.releaseEvidence.releaseBundles[0].bundleSha256 = governedReleaseBundleSha256(unsigned);
    expect(codes(fixture)).toContain("IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED");
  });

  it("does not clear blockers with partial evidence", () => {
    const fixture = acceptedFixture();
    fixture.releaseEvidence.accessibilityAcceptances = [{
      blueprintRevision: 3,
      reviewerUserId: 13,
      standard: "WCAG 2.2 AA",
      evidenceReference: "short",
      evidenceSha256: "not-a-hash",
      acceptedAt: "invalid",
    }];
    expect(codes(fixture)).toEqual(expect.arrayContaining(EVIDENCE_CODES));
  });

  it("does not clear blockers with self-approved or conflicting reviewer roles", () => {
    const fixture = addCompleteEvidence(acceptedFixture());
    fixture.releaseEvidence.accessibilityAcceptances[0].reviewerUserId = 12;
    fixture.releaseEvidence.rightsRoleReviews[0].reviewerUserId = 11;
    const bundle = fixture.releaseEvidence.releaseBundles[0];
    bundle.qaReviewerUserId = bundle.contentReviewerUserId;
    const { bundleSha256: _oldHash, ...unsigned } = bundle;
    bundle.bundleSha256 = governedReleaseBundleSha256(unsigned);
    expect(codes(fixture)).toEqual(expect.arrayContaining([
      "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED",
      "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED",
      "RIGHTS_ROLE_SEPARATION_VIOLATED",
    ]));
    expect(evaluateGovernedAssessmentInventory(fixture).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "RIGHTS_ROLE_SEPARATION_VIOLATED", blockerSeverity: "SUBSTANTIVE" }),
    ]));
  });

  it("fails closed for an unclassified future blocker code", () => {
    expect(() => inventoryBlockerSeverity("FUTURE_UNCLASSIFIED_BLOCKER")).toThrow(/UNCLASSIFIED_GOVERNANCE_BLOCKER/);
  });

  it("groups exact affected identifiers without losing occurrences or classification", () => {
    expect(groupInventoryIssues([
      { severity: "blocker", blockerSeverity: "SUBSTANTIVE", code: "RIGHTS", message: "Missing", questionId: 2, bankId: 7, sourceId: 11 },
      { severity: "blocker", blockerSeverity: "SUBSTANTIVE", code: "RIGHTS", message: "Missing", questionId: 3, bankId: 7, sourceId: 11 },
    ])).toEqual([{
      severity: "blocker", blockerSeverity: "SUBSTANTIVE", code: "RIGHTS", message: "Missing", occurrences: 2,
      questionIds: [2, 3], bankIds: [7], sourceIds: [11],
    }]);
  });
});


describe("release evidence revocation and principal authorization", () => {
  const roleIds = {
    operator: 101,
    accessibility: 102,
    content: 103,
    rights: 104,
    cutScore: 105,
    qa: 106,
    publisher: 107,
    rollback: 108,
  };
  const roleNames = [
    "release_operator",
    "accessibility_reviewer",
    "content_reviewer",
    "rights_reviewer",
    "cut_score_approver",
    "qa_reviewer",
    "publisher",
    "rollback_owner",
  ];
  const users = Object.values(roleIds).map((id) => ({
    id,
    name: `Named human reviewer ${id}`,
    email: `reviewer-${id}@example.invalid`,
  }));
  const grants = Object.values(roleIds).map((userId, index) => ({
    grantId: index + 1,
    userId,
    releaseRole: roleNames[index],
    expiresAt: null,
    revokedAt: null,
  }));

  it("restores missing-release-evidence blockers when current evidence is voided", () => {
    const fixture = addCompleteEvidence(acceptedFixture());
    fixture.visibility = "public";
    fixture.reviewStatus = "approved";
    fixture.isActive = true;
    fixture.releaseEvidence.accessibilityAcceptances[0].voided = true;
    fixture.releaseEvidence.releaseBundles[0].voided = true;

    const report = evaluateGovernedAssessmentInventory(fixture);
    expect(report.releaseReady).toBe(false);
    expect(report.unsafePublished).toBe(false);
    expect(report.publishedMissingReleaseEvidence).toBe(true);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED", blockerSeverity: "RELEASE_EVIDENCE" }),
      expect.objectContaining({ code: "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED", blockerSeverity: "RELEASE_EVIDENCE" }),
    ]));
  });

  it("requires operators to grant release roles before recording evidence", () => {
    expect(() => assertAuthorizedReleasePrincipals(roleIds, users, []))
      .toThrow(/NO_RELEASE_ROLE_AUTHORIZATIONS.*grant roles first/);
  });

  it("accepts every principal only when an exact current grant exists", () => {
    expect(() => assertAuthorizedReleasePrincipals(roleIds, users, grants))
      .not.toThrow();
    expect(() => assertAuthorizedReleasePrincipals(roleIds, users, grants.filter((grant) => grant.releaseRole !== "rights_reviewer")))
      .toThrow(/rights user 104 lacks a current, unrevoked, unexpired rights_reviewer grant/);
  });

  it("refuses evidence when an exact grant is revoked", () => {
    const revoked = grants.map((grant) => grant.releaseRole === "qa_reviewer"
      ? { ...grant, revokedAt: "2026-07-29T08:00:00.000Z" }
      : grant);
    expect(() => assertAuthorizedReleasePrincipals(roleIds, users, revoked, new Date("2026-07-29T09:00:00.000Z")))
      .toThrow(/qa user 106 lacks a current, unrevoked, unexpired qa_reviewer grant/);
  });

  it("refuses evidence when an exact grant is expired", () => {
    const expired = grants.map((grant) => grant.releaseRole === "publisher"
      ? { ...grant, expiresAt: "2026-07-29T08:00:00.000Z" }
      : grant);
    expect(() => assertAuthorizedReleasePrincipals(roleIds, users, expired, new Date("2026-07-29T09:00:00.000Z")))
      .toThrow(/publisher user 107 lacks a current, unrevoked, unexpired publisher grant/);
  });

  it.each([
    ["Release automation bot", "owner@example.invalid"],
    ["Named Reviewer", "smoke-test@example.invalid"],
    ["AI assessment authoring", "human@example.invalid"],
  ])("refuses automation, test, smoke, and AI-authoring grant targets", (name, email) => {
    expect(() => assertGrantableReleaseIdentity({ id: 99, name, email }))
      .toThrow(/RELEASE_ROLE_TARGET_FORBIDDEN/);
  });

  it.each([3, 5, 6, 7])("refuses confirmed non-real production user %i regardless of display name", (userId) => {
    const singleOfficerRoles = {
      operator: userId, accessibility: userId, content: userId, rights: userId,
      cutScore: userId, qa: userId, publisher: userId, rollback: userId,
    };
    expect(() => assertAuthorizedReleasePrincipals(
      singleOfficerRoles,
      [{ id: userId, name: "Apparently Named Human", email: "named-human@example.invalid" }],
      [{ grantId: 1, userId, releaseRole: "release_operator", expiresAt: null, revokedAt: null }],
      new Date("2026-07-29T09:00:00.000Z"),
      "single_accountable_officer",
    )).toThrow(/RELEASE_PRINCIPAL_IDENTITY_FORBIDDEN/);
  });

  it("refuses test, smoke, automation, and AI-authoring principals even when granted", () => {
    const unsafeUsers = users.map((user) => user.id === roleIds.qa
      ? { ...user, name: "Octamy Assessment Authoring" }
      : user);
    expect(() => assertAuthorizedReleasePrincipals(roleIds, unsafeUsers, grants))
      .toThrow(/RELEASE_PRINCIPAL_IDENTITY_FORBIDDEN.*AI-authoring, test, or smoke/);
  });

  it.each([
    ["Release automation bot", "owner@example.invalid"],
    ["Junk fixture account", "owner@example.invalid"],
    ["Named Officer", "test-officer@example.invalid"],
    ["AI assessment authoring", "officer@example.invalid"],
  ])("refuses automation, test, and AI-authoring accountable officers", (name, email) => {
    const singleOfficerRoles = {
      operator: 1, accessibility: 1, content: 1, rights: 1,
      cutScore: 1, qa: 1, publisher: 1, rollback: 1,
    };
    expect(() => assertAuthorizedReleasePrincipals(
      singleOfficerRoles,
      [{ id: 1, name, email }],
      [{ grantId: 1, userId: 1, releaseRole: "release_operator", expiresAt: null, revokedAt: null }],
      new Date("2026-07-29T09:00:00.000Z"),
      "single_accountable_officer",
    )).toThrow(/RELEASE_PRINCIPAL_IDENTITY_FORBIDDEN/);
  });
});