import { describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = (relative: string) => readFile(path.join(root, relative), 'utf8');

describe('commerce and publication source invariants', () => {
  it('retires legacy recruiter payment signing and callbacks', async () => {
    const routes = await source('server/routes/recruiterRoutes.ts');
    const legacy = routes.slice(routes.indexOf("app.post('/recruiter/generate-payment-hash'"), routes.indexOf("app.post('/recruiter/access-interview-video'"));
    expect(legacy).toContain("status(410)");
    expect(legacy).toContain('LEGACY_RECRUITER_PAYMENT_RETIRED');
    expect(legacy).not.toContain('PAYUMONEY_SALT');
    expect(legacy).not.toContain("createHash('sha512')");
  });

  it('blocks bulk assessment publication without retaining a direct SQL mutation path', async () => {
    const routes = await source('server/routes.ts');
    const publishStart = routes.indexOf('if (parsed.data.action === "publish")');
    const branch = routes.slice(publishStart, routes.indexOf('const result = await db.execute(sql`', publishStart));
    expect(branch).toContain('BULK_ASSESSMENT_PUBLISH_DISABLED');
    expect(branch).toContain('return res.status(409)');
    expect(branch).not.toContain('UPDATE courses');
    expect(branch).not.toContain('tx.execute');
  });

  it('creates a local subscription reservation before provider checkout', async () => {
    const routes = await source('server/routes/dashboardRoutes.ts');
    const checkout = routes.slice(routes.indexOf("router.post('/subscriptions/checkout'"), routes.indexOf('// Used by the Cashfree webhook'));
    expect(checkout).toContain('PRACTICE_INVENTORY_UNAVAILABLE');
    expect(checkout).toContain('pg_advisory_xact_lock');
    expect(checkout.indexOf('tx.insert(subscriptions)')).toBeLessThan(checkout.indexOf('createCashfreeOrder'));
    expect(checkout).toContain("status: 'cancelled'");
    expect(checkout).toContain('SUBSCRIPTION_CHECKOUT_PENDING');
  });

  it('fulfills from a locked local reservation and exposes owner-scoped status', async () => {
    const routes = await source('server/routes/dashboardRoutes.ts');
    const activation = routes.slice(routes.indexOf('export async function activatePlan'), routes.indexOf("router.get('/subscriptions/orders/:orderId/status'"));
    expect(activation).toContain(".for('update')");
    expect(activation).toContain("status === 'active'");
    expect(activation).toContain("already_fulfilled");
    const statusRoute = routes.slice(routes.indexOf("router.get('/subscriptions/orders/:orderId/status'"), routes.indexOf("router.get('/me/subscription'"));
    expect(statusRoute).toContain('subscriptions.userId');
    expect(statusRoute).toContain("Cache-Control', 'private, no-store");
  });

  it('never activates an unknown subscription from webhook notes', async () => {
    const routes = await source('server/routes.ts');
    const webhook = routes.slice(routes.indexOf('app.post("/api/webhooks/cashfree"'), routes.indexOf('const meta = activationMetadata'));
    expect(webhook).toContain('subscription.payment_mismatch');
    expect(webhook).toContain('ignored: "unknown_order"');
    expect(webhook).not.toContain('orderNote.ownerType');
    expect(webhook).not.toContain('orderNote.ownerId');
  });

  it('revalidates credential eligibility across legacy orders, callbacks, activation, and vouchers', async () => {
    const routes = await source('server/routes.ts');
    expect(routes.match(/isCredentialEligibleAssessment\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(routes).toContain('failed_assessment_ineligible');

    const activation = await source('server/lib/credential-activation.ts');
    const fulfillment = activation.slice(activation.indexOf('export async function finalizeCredentialActivation'));
    expect(fulfillment).toContain('.from(courses)');
    expect(fulfillment).toContain('.for("update")');
    expect(fulfillment).toContain('isCredentialEligibleAssessment(course)');

    const vouchers = await source('server/routes/certificationBenefitRoutes.ts');
    expect(vouchers).toContain('course.ownerType !== "admin" || !isCredentialEligibleAssessment(course)');
  });

  it('keeps recruiter search free of global activity and Practice credential evidence', async () => {
    const storage = await source('server/storage.ts');
    const search = storage.slice(storage.indexOf('async searchCandidates'), storage.indexOf('async getCandidateProfile'));
    expect(search).not.toContain('lastActive: users.lastActive');
    expect(search).toContain("credential_course.assessment_purpose = 'certification'");
    expect(search).toContain('certificates: []');
    expect(search).toContain('evidenceGrantRequired: true');
    expect(search).not.toContain('certificates: certs');
    const ui = await source('recruiter/pages/CandidateSearch.tsx');
    expect(ui).not.toContain('candidate.lastActive');
  });

  it('uses the authenticated exact local subscription order in mobile Practice', async () => {
    const api = await source('mobile/src/features/practice/practice.api.ts');
    expect(api).toContain('/api/subscriptions/orders/');
    expect(api).not.toContain('/api/payments/cashfree/${encodeURIComponent(orderId)}/status');
    const screen = await source('mobile/src/app/(tabs)/practice.tsx');
    expect(screen).toContain("orderStatus.ownerType === 'learner'");
    expect(screen).toContain("orderStatus.plan === 'all_access'");
    expect(screen).toContain("orderStatus.status === 'active'");
  });

  it('keeps coupon redemption and revenue splits idempotent by local payment id', async () => {
    const routes = await source('server/routes.ts');
    const splits = routes.slice(routes.indexOf('async function ensureRevenueSplits'), routes.indexOf('// Middleware to verify JWT token'));
    expect(splits).toContain('pg_advisory_xact_lock(${input.paymentId})');
    expect(splits).toContain('.where(eq(splitPayouts.paymentId, input.paymentId))');

    const coupons = await source('server/lib/coupons.ts');
    const redemption = coupons.slice(coupons.indexOf('export async function recordCouponRedemption'));
    expect(redemption).toContain('pg_advisory_xact_lock(7301, ${input.payment.id})');
    expect(redemption).toContain('externalKey: `payment:${input.payment.id}`');
    expect(redemption).toContain('onConflictDoNothing');
  });

  it('does not grant course access from the checkout response or public status poll', async () => {
    const featureRoutes = await source('server/routes/featureRoutes.ts');
    const checkout = featureRoutes.slice(featureRoutes.indexOf("router.post('/courses/:id/access-checkout'"), featureRoutes.indexOf('async function assertCreatorOwnsCourse'));
    expect(checkout).toContain("status: 'pending'");
    expect(checkout).not.toContain('courseEntitlements).values');

    const routes = await source('server/routes.ts');
    const status = routes.slice(routes.indexOf('app.get("/api/payments/cashfree/:orderId/status"'), routes.indexOf('app.post("/api/webhooks/cashfree"'));
    expect(status).not.toContain('courseEntitlements');
    const webhook = routes.slice(routes.indexOf('app.post("/api/webhooks/cashfree"'), routes.indexOf('// PayUMoney success callback'));
    expect(webhook).toContain("meta.kind === 'course_access'");
    expect(webhook).toContain('courseEntitlements).values');
  });
});


  it('keeps recruiter browser returns non-authoritative and fulfills the locked reservation only from the signed webhook', async () => {
    const recruiterRoutes = await source('server/routes/recruiterRoutes.ts');
    const checkout = recruiterRoutes.slice(recruiterRoutes.indexOf("app.post('/recruiter/credit-orders'"), recruiterRoutes.indexOf("app.post('/recruiter/purchase-credits'"));
    expect(checkout.indexOf('tx.insert(payments)')).toBeLessThan(checkout.indexOf('createCashfreeOrder'));
    expect(checkout).toContain('createCashfreeStatusToken(orderId)');

    const browserReturn = recruiterRoutes.slice(recruiterRoutes.indexOf("app.post('/recruiter/purchase-credits'"), recruiterRoutes.indexOf('// Get Candidate Profile by ID'));
    expect(browserReturn).toContain('verifyCashfreeStatusToken');
    expect(browserReturn).toContain('publicPaymentStatus(payment.status)');
    expect(browserReturn).not.toContain('fetchCashfreeOrderStatus');
    expect(browserReturn).not.toContain('purchaseCredits');

    const routes = await source('server/routes.ts');
    const webhook = routes.slice(routes.indexOf('app.post("/api/webhooks/cashfree"'), routes.indexOf('// PayUMoney success callback'));
    expect(webhook).toContain('meta.kind === "recruiter_credits"');
    expect(webhook).toContain('fulfillRecruiterCreditPayment');
  });

  it('atomically and idempotently fulfills direct certificate payments', async () => {
    const routes = await source('server/routes.ts');
    const start = routes.indexOf('async function finalizePaidExamCertificate');
    const end = routes.indexOf('async function fulfillRecruiterCreditPayment', start);
    const fulfillment = routes.slice(start, end);
    expect(fulfillment).toContain('return db.transaction(async (tx)');
    expect(fulfillment).toContain('pg_advisory_xact_lock(7201');
    expect(fulfillment).toContain('.for("update")');
    expect(fulfillment).toContain('payment.status === "completed"');
    expect(fulfillment).toContain('"already_completed"');
    expect(fulfillment).toContain('recordCouponRedemptionInTransaction');
    expect(fulfillment).toContain('ensureRevenueSplitsInTransaction');
    expect(fulfillment).toContain('recordSellerCommissionInTransaction');
    expect(routes).toContain('onConflictDoNothing({ target: salesTable.certificateId })');
    expect(routes.match(/finalizePaidExamCertificate\(\{/g)?.length).toBe(2);
  });

  it('verifies sponsor success and failure callbacks against the exact local reservation before mutation', async () => {
    const routes = await source('server/routes.ts');
    const helper = routes.slice(routes.indexOf('async function updateVerifiedSponsorPayment'), routes.indexOf('// Middleware to verify JWT token'));
    expect(helper).toContain('sponsor.transactionId !== responseData.txnid');
    expect(helper).toContain('amountsMatch(sponsor.amount, responseData.amount)');
    expect(helper).toContain('.for("update")');
    expect(helper).toContain('eq(sponsorsTable.paymentStatus, "pending")');

    const failure = routes.slice(routes.indexOf('"/api/sponsor/payment/failure"'), routes.indexOf('// Referral tracking API'));
    expect(failure.indexOf('payuMoneyService.verifyHash(responseData)')).toBeLessThan(failure.indexOf('updateVerifiedSponsorPayment(responseData, "failed")'));
    expect(failure).not.toContain('updateSponsorPaymentStatus');
  });

  it('uses constant-time PayU hash comparison and escapes every generated form interpolation', async () => {
    const payu = await source('server/payumoney.ts');
    const verification = payu.slice(payu.indexOf('verifyHash('), payu.indexOf('/** Escape untrusted values'));
    expect(verification).toContain('crypto.timingSafeEqual(expectedHash, providedHash)');
    expect(verification).not.toContain('calculatedHash === hash');
    const form = payu.slice(payu.indexOf('generatePaymentForm('), payu.indexOf('generateTransactionId()'));
    expect(form).toContain('this.escapeHtmlAttribute(key)');
    expect(form).toContain('this.escapeHtmlAttribute(value)');
    expect(form).toContain('this.escapeHtmlAttribute(this.config.baseUrl)');
    expect(payu).toContain(".replace(/&/g, '&amp;')");
    expect(payu).toContain(".replace(/</g, '&lt;')");
    expect(payu).toContain(".replace(/>/g, '&gt;')");
    expect(payu).toContain(`.replace(/"/g, '&quot;')`);
    expect(payu).toContain(".replace(/'/g, '&#39;')");
  });
