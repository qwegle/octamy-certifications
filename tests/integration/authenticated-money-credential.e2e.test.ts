import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import crypto from 'node:crypto';
import express, { type Express, type Request } from 'express';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { testDb } from '../setup';
import {
  assessmentAccessibilityAcceptances,
  assessmentReleaseBundles,
  assessmentRightsRoleReviews,
  categories,
  certificates,
  courseQuestionBlueprint,
  courseQuestionBlueprintVersions,
  courses,
  examAttempts,
  payments,
  questionBanks,
  questionPackImportRuns,
  questionPackSources,
  questionProvenance,
  questions,
  questionTopics,
  questionVersions,
  sales,
  sellers,
  splitPayouts,
  subscriptions,
  users,
} from '../../shared/schema';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const WEBHOOK_SECRET = 'cashfree-e2e-webhook-secret-32-bytes';
const learner = { name: 'E2E Learner', email: 'learner.e2e@example.com', password: 'ValidPassword123!' };
const otherLearner = { name: 'Other Learner', email: 'other.e2e@example.com', password: 'AnotherPassword123!' };
const publicVerificationKeys = [
  'assessment', 'authentic', 'badge', 'certificateId', 'courseTitle', 'expiresAt',
  'issuedAt', 'issuedBy', 'issuer', 'score', 'status', 'userName', 'valid',
].sort();

function sha(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function webhookSignature(rawBody: string, timestamp: string) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}${rawBody}`).digest('base64');
}

function signedWebhook(app: Express, payload: unknown, signatureOverride?: string) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  return request(app)
    .post('/api/webhooks/cashfree')
    .set('Content-Type', 'application/json')
    .set('x-webhook-timestamp', timestamp)
    .set('x-webhook-signature', signatureOverride ?? webhookSignature(rawBody, timestamp))
    .send(rawBody);
}

function correctAnswersFromServed(served: Array<{ id: number; options: string[] }>) {
  return Object.fromEntries(served.map((question) => [
    String(question.id),
    question.options.findIndex((option) => option.startsWith('Correct response')),
  ]));
}

describe('authenticated assessment, Cashfree, and credential E2E', () => {
  let app: Express;
  let learnerToken: string;
  let otherToken: string;
  let learnerId: number;
  let authorId: number;
  let reviewerId: number;
  let rightsReviewerId: number;
  let accessibilityReviewerId: number;
  let cutScoreApproverId: number;
  let qaReviewerId: number;
  let publisherId: number;
  let rollbackOwnerId: number;
  let certificationCourseId: number;
  let practiceCourseId: number;
  let tempExamId: string;
  let sessionId: string;
  let orderId: string;
  let statusToken: string;
  let certificatePublicId: string;
  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must identify a disposable database');
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'e2e-jwt-secret-that-is-longer-than-32-bytes';
    process.env.PAYMENT_STATUS_SECRET = 'e2e-payment-status-secret-longer-than-32-bytes';
    process.env.PAYMENT_DEFAULT_GATEWAY = 'cashfree';
    process.env.CASHFREE_APP_ID = 'e2e-app-id';
    process.env.CASHFREE_SECRET_KEY = 'e2e-secret-key';
    process.env.CASHFREE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.CASHFREE_ENV = 'sandbox';
    process.env.APP_URL = 'http://octamy.e2e.test';
    process.env.BCRYPT_ROUNDS = '4';

    originalFetch = global.fetch;
    global.fetch = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({
        cf_order_id: `provider_${body.order_id}`,
        order_id: body.order_id,
        order_amount: body.order_amount,
        order_currency: 'INR',
        order_status: 'ACTIVE',
        payment_session_id: `session_${'a'.repeat(32)}${body.order_id}`,
        payment_link: 'https://sandbox.cashfree.com/pg/view/order/e2e',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof global.fetch;

    const { registerRoutes } = await import('../../server/routes');
    app = express();
    app.use(express.json({
      limit: '1mb',
      verify: (req: Request, _res, buffer) => { (req as any).rawBody = buffer.toString('utf8'); },
    }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    await registerRoutes(app);

    const registered = await request(app).post('/api/register').send(learner).expect(201);
    learnerId = registered.body.user.id;
    await request(app).post('/api/register').send(otherLearner).expect(201);
    learnerToken = (await request(app).post('/api/login').send({ email: learner.email, password: learner.password }).expect(200)).body.token;
    otherToken = (await request(app).post('/api/login').send({ email: otherLearner.email, password: otherLearner.password }).expect(200)).body.token;

    const [author, reviewer, rightsReviewer, accessibilityReviewer, cutScoreApprover, qaReviewer, publisher, rollbackOwner] = await testDb.insert(users).values([
      { name: 'Attributable Author', email: 'author.e2e@example.com' },
      { name: 'Independent Content Reviewer', email: 'reviewer.e2e@example.com' },
      { name: 'Independent Rights Reviewer', email: 'rights-reviewer.e2e@example.com' },
      { name: 'Independent Accessibility Reviewer', email: 'accessibility-reviewer.e2e@example.com' },
      { name: 'Independent Cut Score Approver', email: 'cut-score.e2e@example.com' },
      { name: 'Independent Release QA Reviewer', email: 'release-qa.e2e@example.com' },
      { name: 'Independent Publisher', email: 'publisher.e2e@example.com' },
      { name: 'Rollback Owner', email: 'rollback.e2e@example.com' },
    ]).returning();
    authorId = author.id;
    reviewerId = reviewer.id;
    rightsReviewerId = rightsReviewer.id;
    accessibilityReviewerId = accessibilityReviewer.id;
    cutScoreApproverId = cutScoreApprover.id;
    qaReviewerId = qaReviewer.id;
    publisherId = publisher.id;
    rollbackOwnerId = rollbackOwner.id;

    const [category] = await testDb.insert(categories).values({
      name: 'E2E Governance', description: 'Disposable governed assessment fixtures', icon: 'Shield', slug: 'e2e-governance',
    }).returning();
    const [certCourse, practiceCourse] = await testDb.insert(courses).values([
      {
        title: 'Governed E2E Certification', description: 'A fully reviewed disposable certification', slug: 'governed-e2e-certification',
        categoryId: category.id, duration: 7, passingScore: 80, price: '125.00', productType: 'assessment', level: 'advanced',
        isActive: true, ownerType: 'admin', visibility: 'public', certificationMode: 'octamy', assessmentPurpose: 'certification',
        reviewStatus: 'approved', useBlueprintEngine: true,
      },
      {
        title: 'Governed E2E Practice', description: 'A disposable Practice Pass assessment', slug: 'governed-e2e-practice',
        categoryId: category.id, duration: 6, passingScore: 60, price: '0.00', productType: 'assessment', level: 'beginner',
        isActive: true, ownerType: 'admin', visibility: 'public', certificationMode: 'none', assessmentPurpose: 'practice',
        reviewStatus: 'approved', useBlueprintEngine: true,
      },
    ]).returning();
    certificationCourseId = certCourse.id;
    practiceCourseId = practiceCourse.id;

    const [certBank, practiceBank] = await testDb.insert(questionBanks).values([
      { slug: 'e2e-cert-bank', name: 'E2E Certification Bank', ownerType: 'admin', visibility: 'public', bankPurpose: 'certification', bankKind: 'assessment_pool', status: 'active', syllabusVersion: 'E2E-SYLLABUS-1', questionCount: 80, createdBy: authorId },
      { slug: 'e2e-practice-bank', name: 'E2E Practice Bank', ownerType: 'admin', visibility: 'public', bankPurpose: 'practice', bankKind: 'assessment_pool', status: 'active', syllabusVersion: 'E2E-PRACTICE-1', questionCount: 200, createdBy: authorId },
    ]).returning();
    const [certTopic, practiceTopic] = await testDb.insert(questionTopics).values([
      { bankId: certBank.id, name: 'Certification Competency', slug: 'certification-competency' },
      { bankId: practiceBank.id, name: 'Practice Competency', slug: 'practice-competency' },
    ]).returning();
    const [certificationRule] = await testDb.insert(courseQuestionBlueprint).values([
      { courseId: certCourse.id, bankId: certBank.id, topicId: certTopic.id, questionCount: 5, difficulty: 'mixed' },
      { courseId: practiceCourse.id, bankId: practiceBank.id, topicId: practiceTopic.id, questionCount: 3, difficulty: 'mixed' },
    ]).returning();
    await testDb.insert(courseQuestionBlueprintVersions).values([
      { courseId: certCourse.id, revision: 1, items: [{ bankId: certBank.id, topicId: certTopic.id, questionCount: 5, difficulty: 'mixed' }], changedBy: reviewerId },
      { courseId: practiceCourse.id, revision: 1, items: [{ bankId: practiceBank.id, topicId: practiceTopic.id, questionCount: 3, difficulty: 'mixed' }], changedBy: reviewerId },
    ]);

    const certRows = Array.from({ length: 80 }, (_, index) => {
      const contentHash = sha(`certification-question-content-${index}`);
      return {
        bankId: certBank.id,
        topicId: certTopic.id,
        question: `For competency ${sha(`stem-${index}`).slice(0, 12)}, which reviewed response satisfies the documented professional requirement?`,
        options: Array.from({ length: 4 }, (_, position) => position === index % 4 ? `Correct response ${index}` : `Plausible alternative ${position} for ${index}`),
        correctAnswer: index % 4,
        difficulty: (['easy', 'medium', 'hard'] as const)[index % 3],
        questionFormat: 'mcq_single',
        explanation: `The keyed response follows the independently checked requirement for competency ${index}; each alternative conflicts with that requirement.`,
        contentHash,
        version: 2,
        answerMetadata: {
          releaseEvidence: {
            syllabusVersion: 'E2E-SYLLABUS-1', objectiveCode: `OBJ-${index}`,
            answerValidation: { status: 'verified', method: 'authoritative_reference', reference: `E2E authoritative reference section ${index}` },
            distractorReview: { status: 'verified', note: 'Independent review confirmed all distractors are plausible but unambiguously incorrect.' },
            reviewAttestation: { status: 'attested', note: 'Independent reviewer checked this exact immutable item content and approved it.', contentHash, contentVersion: 1, decisionVersion: 2, reviewerId },
          },
        },
        generationSource: 'imported', reviewStatus: 'approved', isActive: true, createdBy: authorId, reviewedBy: reviewerId, reviewedAt: new Date(),
      };
    });
    const insertedCertQuestions = await testDb.insert(questions).values(certRows).returning();
    await testDb.insert(questionVersions).values(insertedCertQuestions.map((question) => ({
      questionId: question.id, version: 1, snapshot: { question: question.question, contentHash: question.contentHash }, changeNote: 'Immutable pre-review version', changedBy: authorId,
    })));

    const sourceHash = sha('e2e-source-manifest');
    const rightsEvidenceHash = sha('rights-evidence');
    const rightsEvidenceReference = 'evidence://e2e/rights/source-v1';
    const [source] = await testDb.insert(questionPackSources).values({
      sourceKey: 'e2e.owned.source/v1', name: 'Octamy E2E Owned Source', publisher: 'Octamy Solutions Private Limited', datasetVersion: '1.0.0',
      sourceUrl: 'https://octamy.example/e2e-source', retrievedAt: new Date(), manifestSha256: sourceHash,
      licenseIdentifier: 'OCTAMY-OWNED', licenseName: 'Octamy owned assessment content', licenseUrl: 'https://octamy.example/owned-license',
      rightsBasis: 'owned', commercialUseAllowed: true, derivativesAllowed: true, attributionText: 'Copyright Octamy Solutions Private Limited',
      evidenceReference: rightsEvidenceReference, rightsReviewStatus: 'verified', rightsReviewedAt: new Date(), rightsReviewedBy: 'Independent Rights Reviewer',
      provenance: { rightsReview: { acquiringEntity: 'Octamy Solutions Private Limited', evidenceSha256: rightsEvidenceHash } },
    }).returning();
    const [importRun] = await testDb.insert(questionPackImportRuns).values({
      sourceId: source.id, bankId: certBank.id, inputName: 'e2e.jsonl', inputSha256: sha('e2e-jsonl'), status: 'completed', operator: 'Import Operator One',
      batchSize: 100, totalRows: 80, validRows: 80, processedRows: 80, insertedQuestions: 80, linkedProvenance: 80, completedAt: new Date(),
    }).returning();
    await testDb.insert(questionProvenance).values(insertedCertQuestions.map((question, index) => ({
      questionId: question.id, sourceId: source.id, importRunId: importRun.id, sourceRecordId: `E2E-RECORD-${index}`,
      sourceRecordHash: sha(`source-record-${index}`), contentHash: question.contentHash!, disposition: 'created', language: 'en', syllabus: 'E2E-SYLLABUS-1',
      subject: 'E2E Governance', sourceTopic: 'Certification Competency', objective: `OBJ-${index}`, sourceLocator: `owned-source:${index}`,
      questionOrigin: 'original', answerEvidence: `Authoritative owned answer evidence for item ${index}`, explanationOrigin: 'original',
    })));

    const acceptedAt = new Date(Date.now() - 60_000);
    await testDb.insert(assessmentAccessibilityAcceptances).values({
      assessmentId: certCourse.id, blueprintRevision: 1, reviewerUserId: accessibilityReviewerId,
      standard: 'WCAG 2.2 AA assessment review', evidenceReference: 'evidence://e2e/accessibility/acceptance-v1',
      evidenceSha256: sha('accessibility-acceptance'), acceptedAt, operator: 'Accessibility Reviewer Operator', recordedByUserId: rollbackOwnerId,
    });
    await testDb.insert(assessmentRightsRoleReviews).values({
      assessmentId: certCourse.id, blueprintRevision: 1, sourceId: source.id, reviewerUserId: rightsReviewerId,
      evidenceReference: rightsEvidenceReference, evidenceSha256: rightsEvidenceHash, reviewedAt: acceptedAt, operator: 'Rights Reviewer Operator', recordedByUserId: rollbackOwnerId,
    });
    const { governedAssessmentContentManifestSha256, governedReleaseBundleSha256 } = await import('../../scripts/lib/governed-assessment-inventory');
    const contentManifestSha256 = governedAssessmentContentManifestSha256({
      id: certCourse.id,
      blueprintRevision: 1,
      rules: [{ id: certificationRule.id, bankId: certBank.id, topicId: certTopic.id, questionCount: 5, difficulty: 'mixed', bank: null }],
      questions: insertedCertQuestions.map((question) => ({
        id: question.id, version: question.version, contentHash: question.contentHash,
        sourceLinks: [{ sourceId: source.id, provenanceContentHash: question.contentHash }],
      })) as any,
    });
    const takedownProcedure = 'Suspend catalogue access, preserve evidence, notify owners, and record the governed remediation decision.';
    const unsignedBundle = {
      blueprintRevision: 1,
      contentManifestSha256,
      formSimulationReference: 'evidence://e2e/form-simulation-v1', formSimulationSha256: sha('form-simulation'),
      cutScore: 80, cutScoreMethod: 'Independent Angoff-style review of the governed form and intended learner level.',
      cutScoreApprovalReference: 'evidence://e2e/cut-score-v1', cutScoreApprovalSha256: sha('cut-score-approval'),
      cutScoreApproverUserId: cutScoreApproverId, cutScoreApprovedAt: acceptedAt,
      releaseQaReference: 'evidence://e2e/release-qa-v1', releaseQaSha256: sha('release-qa'),
      qaReviewerUserId: qaReviewerId, qaAcceptedAt: acceptedAt,
      contentReviewerUserId: reviewerId, publisherUserId: publisherId, publisherSignedAt: acceptedAt,
      releaseCommit: sha('e2e-release-commit'), releasedAt: new Date(), rollbackOwnerUserId: rollbackOwnerId,
      takedownProcedure, takedownProcedureSha256: sha(takedownProcedure),
    };
    await testDb.insert(assessmentReleaseBundles).values({
      assessmentId: certCourse.id,
      ...unsignedBundle,
      bundleSha256: governedReleaseBundleSha256(unsignedBundle),
      operator: 'Release Governance Operator',
      recordedByUserId: rollbackOwnerId,
    });

    await testDb.insert(questions).values(Array.from({ length: 200 }, (_, index) => ({
      bankId: practiceBank.id, topicId: practiceTopic.id,
      question: `Practice competency ${sha(`practice-${index}`).slice(0, 12)} asks which response is correct?`,
      options: Array.from({ length: 3 }, (_, position) => position === index % 3 ? `Correct response ${index}` : `Practice alternative ${position} for ${index}`), correctAnswer: index % 3,
      difficulty: (['easy', 'medium', 'hard'] as const)[index % 3], questionFormat: 'mcq_single',
      explanation: 'This disposable practice explanation is long enough to state why the keyed option is correct.',
      reviewStatus: 'approved', isActive: true, createdBy: authorId, reviewedBy: reviewerId, reviewedAt: new Date(),
    })));
    await testDb.insert(subscriptions).values({
      ownerType: 'learner', ownerId: learnerId, userId: learnerId, plan: 'all_access', status: 'active', amount: '499.00',
      startsAt: new Date(Date.now() - 60_000), renewsAt: new Date(Date.now() + 86_400_000),
    });
    await testDb.insert(sellers).values({
      name: 'E2E Partner', email: 'partner.e2e@example.com', referralCode: 'E2EPARTNER', isApproved: true, commissionRate: '10.00',
    });
  }, 120_000);

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('represents the fully attributable published bank as governed release-ready', async () => {
    const { buildGovernedAssessmentInventory } = await import('../../scripts/governed-assessment-inventory');
    const report = await buildGovernedAssessmentInventory({ databaseUrl: TEST_DATABASE_URL!, assessmentSlugs: ['governed-e2e-certification'] });
    expect(report.assessments).toHaveLength(1);
    expect(report.assessments[0].runtimePublishReady).toBe(true);
    expect(report.assessments[0].blockers).toEqual([]);
    expect(report.assessments[0].releaseReady).toBe(true);
  });

  it('registers/logs in, serves configured questions without answers, scores server-side, and replays idempotently', async () => {
    const started = await request(app).post(`/api/courses/${certificationCourseId}/questions`)
      .set('Authorization', `Bearer ${learnerToken}`).send({ evidenceConsent: true }).expect(200);
    expect(started.body.questions).toHaveLength(5);
    expect(started.body.questions.every((question: any) => !Object.hasOwn(question, 'correctAnswer'))).toBe(true);
    expect(started.body.proctorMode).toBe('browser_evidence');
    expect(new Date(started.body.deadlineAt).getTime() - new Date(started.body.startedAt).getTime()).toBe(7 * 60_000);
    sessionId = started.body.sessionId;

    const answers = correctAnswersFromServed(started.body.questions);
    const submitted = await request(app).post('/api/exam/submit').set('Authorization', `Bearer ${learnerToken}`)
      .send({ courseId: certificationCourseId, sessionId, answers, userEmail: 'attacker@example.com', userName: 'Attacker', tabSwitches: 1 }).expect(200);
    expect(submitted.body).toMatchObject({ score: 100, correctAnswers: 5, totalQuestions: 5, passed: true, passingThreshold: 80 });
    tempExamId = submitted.body.tempExamId;

    const replay = await request(app).post('/api/exam/submit').set('Authorization', `Bearer ${learnerToken}`)
      .send({ courseId: certificationCourseId, sessionId, answers: {}, userEmail: learner.email, userName: learner.name }).expect(200);
    expect(replay.body).toMatchObject({ tempExamId, score: 100, passed: true });
    expect(await testDb.select().from(examAttempts).where(eq(examAttempts.sessionId, sessionId))).toHaveLength(0);

    const temporary = await request(app).get(`/api/exam-results-temp/${tempExamId}`).set('Authorization', `Bearer ${learnerToken}`).expect(200);
    expect(temporary.body).toMatchObject({ needsPayment: true, assessmentPurpose: 'certification', score: 100, passed: true });
  });

  it('rejects client-side paid claims and invalid signatures with no durable fulfillment', async () => {
    const checkout = await request(app).post('/api/payment/initiate').set('Authorization', `Bearer ${learnerToken}`)
      .send({ tempExamId, sellerCode: 'E2EPARTNER', paid: true, status: 'completed' }).expect(200);
    expect(checkout.body).toMatchObject({ gateway: 'cashfree', amount: '125.00' });
    orderId = checkout.body.orderId;
    statusToken = checkout.body.statusToken;

    await request(app).get(`/api/payments/cashfree/${orderId}/status?token=client-says-paid`).expect(404);
    await request(app).post('/api/payment/success').send({ txnid: orderId, status: 'success', amount: '125.00' }).expect(302);
    await signedWebhook(app, {
      data: { order: { order_id: orderId, order_amount: 125, order_currency: 'INR' }, payment: { cf_payment_id: 'cf_invalid', payment_status: 'SUCCESS' } },
    }, Buffer.from('invalid-signature-value-that-is-long-enough').toString('base64')).expect(401);

    const [payment] = await testDb.select().from(payments).where(eq(payments.transactionId, orderId));
    expect(payment.status).toBe('pending');
    expect(await testDb.select().from(certificates).where(eq(certificates.courseId, certificationCourseId))).toHaveLength(0);
    const status = await request(app).get(`/api/payments/cashfree/${orderId}/status?token=${encodeURIComponent(statusToken)}`).expect(200);
    expect(status.body.localStatus).toBe('pending');
  });

  it('fulfills a valid Cashfree webhook atomically and exactly once', async () => {
    const payload = {
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: orderId, order_amount: 125, order_currency: 'INR' },
        payment: { cf_payment_id: 'cf_payment_e2e_001', payment_status: 'SUCCESS', payment_amount: 125, payment_currency: 'INR' },
      },
    };
    const first = await signedWebhook(app, payload).expect(200);
    expect(first.body.status).toBe('completed');
    const duplicate = await signedWebhook(app, payload).expect(200);
    expect(duplicate.body.status).toBe('already_completed');

    const [payment] = await testDb.select().from(payments).where(eq(payments.transactionId, orderId));
    expect(payment.status).toBe('completed');
    expect(payment.cashfreePaymentId).toBe('cf_payment_e2e_001');
    const issued = await testDb.select().from(certificates).where(eq(certificates.courseId, certificationCourseId));
    expect(issued).toHaveLength(1);
    expect(issued[0].isPaid).toBe(true);
    certificatePublicId = issued[0].certificateId;
    expect(await testDb.select().from(examAttempts).where(eq(examAttempts.sessionId, sessionId))).toHaveLength(1);
    expect(await testDb.select().from(sales).where(eq(sales.certificateId, issued[0].id))).toHaveLength(1);
    expect(await testDb.select().from(splitPayouts).where(eq(splitPayouts.paymentId, payment.id))).toHaveLength(2);
    const [partner] = await testDb.select().from(sellers).where(eq(sellers.referralCode, 'E2EPARTNER'));
    expect(partner.totalEarnings).toBe('12.50');
  });

  it('allows the owner and allowlists public verification fields', async () => {
    await request(app).get(`/api/certificates/${certificatePublicId}/activation`)
      .set('Authorization', `Bearer ${learnerToken}`).expect(200).expect(({ body }) => expect(body.status).toBe('activated'));
    await request(app).get(`/api/certificates/${certificatePublicId}/download`)
      .set('Authorization', `Bearer ${learnerToken}`).expect(200);

    const verification = await request(app).get(`/api/certificates/verify/${certificatePublicId}`).expect(200);
    expect(Object.keys(verification.body).sort()).toEqual(publicVerificationKeys);
    expect(verification.body).toMatchObject({ authentic: true, valid: true, status: 'active', certificateId: certificatePublicId });
    expect(JSON.stringify(verification.body)).not.toContain(learner.email);
    expect(verification.body).not.toHaveProperty('paymentId');
    expect(verification.body).not.toHaveProperty('userId');
  });

  it('treats credential retrieval as verification-equivalent public disclosure without private evidence', async () => {
    // A credential is deliberately retrievable by its exact public certificate
    // ID, matching what QR verification already discloses. What must never be
    // exposed is private evidence, so assert that instead of owner-only access.
    const rendered = await request(app).get(`/api/certificates/${certificatePublicId}/download`)
      .set('Authorization', `Bearer ${otherToken}`).expect(200);
    const body = rendered.text ?? '';
    expect(body).not.toContain(learner.email);
    for (const forbidden of ['ipAddress', 'userAgent', 'tabSwitches', 'sessionId']) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('persists practice evidence but never issues a credential', async () => {
    const started = await request(app).post(`/api/courses/${practiceCourseId}/questions`)
      .set('Authorization', `Bearer ${learnerToken}`).send({}).expect(200);
    expect(started.body.questions).toHaveLength(3);
    const submitted = await request(app).post('/api/exam/submit').set('Authorization', `Bearer ${learnerToken}`)
      .send({ courseId: practiceCourseId, sessionId: started.body.sessionId, answers: correctAnswersFromServed(started.body.questions) }).expect(200);
    expect(submitted.body).toMatchObject({ passed: true, score: 100 });
    const [attempt] = await testDb.select().from(examAttempts).where(and(
      eq(examAttempts.courseId, practiceCourseId), eq(examAttempts.sessionId, started.body.sessionId),
    ));
    expect(attempt).toBeDefined();
    await request(app).post('/api/certificates/create').set('Authorization', `Bearer ${learnerToken}`)
      .send({ examAttemptId: attempt.id }).expect(409);
    expect(await testDb.select().from(certificates).where(eq(certificates.courseId, practiceCourseId))).toHaveLength(0);
  });
});
