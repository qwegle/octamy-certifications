import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createCashfreeOrder,
  createCashfreeStatusToken,
  publicPaymentStatus,
  verifyCashfreeStatusToken,
  verifyCashfreeWebhookSignature,
} from "../../server/lib/cashfree";

describe("Cashfree status polling tokens", () => {
  const previousPaymentSecret = process.env.PAYMENT_STATUS_SECRET;
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousAppId = process.env.CASHFREE_APP_ID;
  const previousSecretKey = process.env.CASHFREE_SECRET_KEY;
  const previousWebhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
  const previousEnvironment = process.env.CASHFREE_ENV;

  beforeAll(() => {
    process.env.PAYMENT_STATUS_SECRET = "test-payment-status-secret-at-least-32-characters";
    process.env.CASHFREE_APP_ID = "test-cashfree-app-id";
    process.env.CASHFREE_SECRET_KEY = "test-cashfree-secret-key-at-least-32-characters";
    process.env.CASHFREE_WEBHOOK_SECRET = "test-cashfree-webhook-secret-at-least-32-characters";
    process.env.CASHFREE_ENV = "sandbox";
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (previousPaymentSecret === undefined) delete process.env.PAYMENT_STATUS_SECRET;
    else process.env.PAYMENT_STATUS_SECRET = previousPaymentSecret;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousAppId === undefined) delete process.env.CASHFREE_APP_ID;
    else process.env.CASHFREE_APP_ID = previousAppId;
    if (previousSecretKey === undefined) delete process.env.CASHFREE_SECRET_KEY;
    else process.env.CASHFREE_SECRET_KEY = previousSecretKey;
    if (previousWebhookSecret === undefined) delete process.env.CASHFREE_WEBHOOK_SECRET;
    else process.env.CASHFREE_WEBHOOK_SECRET = previousWebhookSecret;
    if (previousEnvironment === undefined) delete process.env.CASHFREE_ENV;
    else process.env.CASHFREE_ENV = previousEnvironment;
  });

  it("accepts only the exact order before expiry", () => {
    const now = Date.UTC(2026, 0, 1);
    const token = createCashfreeStatusToken("cert-order_123", now);
    expect(verifyCashfreeStatusToken(token, now + 1)).toBe("cert-order_123");
    expect(verifyCashfreeStatusToken(token, now + 1)).not.toBe("cert-order_999");
    expect(verifyCashfreeStatusToken(token, now + 30 * 60 * 1000)).toBeNull();
  });

  it("rejects tampered and malformed tokens", () => {
    const token = createCashfreeStatusToken("cert-order_456");
    const [payload, signature] = token.split(".");
    const tamperedSignature = `${signature![0] === "A" ? "B" : "A"}${signature!.slice(1)}`;
    expect(verifyCashfreeStatusToken(`${payload}.${tamperedSignature}`)).toBeNull();
    expect(verifyCashfreeStatusToken(`${token}.extra`)).toBeNull();
    expect(() => createCashfreeStatusToken("bad/order")).toThrow("Invalid Cashfree order ID");
  });

  it("maps persisted payment states through a strict public allowlist", () => {
    expect(publicPaymentStatus("completed")).toBe("completed");
    expect(publicPaymentStatus("failed")).toBe("failed");
    expect(publicPaymentStatus("duplicate")).toBe("failed");
    expect(publicPaymentStatus("pending")).toBe("pending");
    expect(publicPaymentStatus("PROVIDER_APPROVED<script>")).toBe("pending");
    expect(publicPaymentStatus(null)).toBe("pending");
  });

  it("rejects malformed order inputs before contacting Cashfree", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    await expect(createCashfreeOrder({
      orderId: "bad/order",
      amount: "0.00",
      customerId: "oct_user_7",
      customerName: "Learner",

      customerEmail: "learner@example.test",
      customerPhone: "9999999999",
      returnUrl: "https://octamy.com/payment-success",
      notifyUrl: "https://octamy.com/api/webhooks/cashfree",
    })).rejects.toThrow("Invalid Cashfree order ID");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a successful provider response for a different local order", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      order_id: "CF_ORDER_DIFFERENT",
      order_amount: 999,
      order_currency: "INR",
      payment_session_id: "session_abcdefghijklmnopqrstuvwxyz123456",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(createCashfreeOrder({
      orderId: "CF_ORDER_EXPECTED",
      amount: "999.00",
      customerId: "oct_user_7",
      customerName: "Learner",
      customerEmail: "learner@example.test",
      customerPhone: "9999999999",
      returnUrl: "https://octamy.com/payment-success",
      notifyUrl: "https://octamy.com/api/webhooks/cashfree",
    })).rejects.toThrow("mismatched order response");
  });

  it("accepts only timestamp-bound Cashfree webhook signatures", () => {
    const rawBody = JSON.stringify({ data: { order: { order_id: "CF_ORDER_EXPECTED" } } });
    const timestamp = "1767225600000";
    const secret = process.env.CASHFREE_WEBHOOK_SECRET!;
    const valid = crypto.createHmac("sha256", secret).update(`${timestamp}${rawBody}`).digest("base64");
    const bodyOnly = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");

    expect(verifyCashfreeWebhookSignature(rawBody, valid, timestamp)).toBe(true);
    expect(verifyCashfreeWebhookSignature(rawBody, bodyOnly, timestamp)).toBe(false);
    expect(verifyCashfreeWebhookSignature(rawBody, valid)).toBe(false);
  });

  it("keeps the public status route local-only, token-bound, and allowlisted", async () => {
    const source = await readFile(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const start = source.indexOf('app.get("/api/payments/cashfree/:orderId/status"');
    const end = source.indexOf('app.post("/api/webhooks/cashfree"', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const route = source.slice(start, end);
    expect(route).toContain("cashfreeStatusLimiter");
    expect(route).toContain("verifyCashfreeStatusToken(parsed.data.token)");
    expect(route).toContain("getPaymentByTransactionId");
    expect(route).toContain("orderId: parsed.data.orderId");
    expect(route).toContain("localStatus: publicPaymentStatus(localPayment.status)");
    expect(route).not.toContain("fetchCashfreeOrderStatus");
    expect(route).not.toContain("providerStatus");
    expect(route).not.toContain("gatewayStatusRaw");
  });
});
