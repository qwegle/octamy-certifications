import crypto from "node:crypto";

type CashfreeEnvironment = "sandbox" | "production";

export interface CashfreeConfig {
  appId: string;
  secretKey: string;
  webhookSecret: string;
  environment: CashfreeEnvironment;
}

export interface CreateCashfreeOrderInput {
  orderId: string;
  amount: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
  notes?: Record<string, string>;
}

export interface CashfreeOrderResponse {
  cfOrderId?: string;
  orderId: string;
  orderAmount?: number;
  orderStatus?: string;
  paymentSessionId: string;
  paymentLink?: string;
  raw: unknown;
}

export function getCashfreeConfig(): CashfreeConfig {
  const appId = process.env.CASHFREE_APP_ID?.trim() || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim() || "";
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET?.trim() || "";
  const configuredEnvironment = process.env.CASHFREE_ENV?.trim().toLowerCase() || "production";
  if (configuredEnvironment !== "sandbox" && configuredEnvironment !== "production") {
    throw new Error("CASHFREE_ENV must be either sandbox or production");
  }
  return { appId, secretKey, webhookSecret, environment: configuredEnvironment };
}

export function getDefaultPaymentGateway(): "cashfree" | "payu" {
  const value = (process.env.PAYMENT_DEFAULT_GATEWAY || "cashfree").toLowerCase();
  return value === "payu" ? "payu" : "cashfree";
}

function getApiBase(environment: CashfreeEnvironment): string {
  return environment === "sandbox"
    ? "https://sandbox.cashfree.com/pg"
    : "https://api.cashfree.com/pg";
}

const CASHFREE_ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{8,180}$/;
const CASHFREE_PAYMENT_SESSION_PATTERN = /^session_[A-Za-z0-9_-]{20,800}$/;

function assertCashfreeOrderInput(input: CreateCashfreeOrderInput): number {
  if (!CASHFREE_ORDER_ID_PATTERN.test(input.orderId)) throw new Error("Invalid Cashfree order ID");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000 || !/^\d+(?:\.\d{1,2})?$/.test(input.amount)) {
    throw new Error("Invalid Cashfree order amount");
  }
  for (const [label, value] of [["return", input.returnUrl], ["notification", input.notifyUrl]] as const) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Invalid Cashfree ${label} URL`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error(`Invalid Cashfree ${label} URL`);
    }
  }
  if (!input.customerId.trim() || !input.customerName.trim() || !/^\S+@\S+\.\S+$/.test(input.customerEmail)) {
    throw new Error("Invalid Cashfree customer details");
  }
  return amount;
}

function toPublicOrder(raw: any, expectedOrderId: string, expectedAmount: number): CashfreeOrderResponse {
  if (!raw || typeof raw !== "object" || raw.order_id !== expectedOrderId) {
    throw new Error("Cashfree returned a mismatched order response");
  }
  const responseAmount = Number(raw.order_amount);
  if (!Number.isFinite(responseAmount) || Math.abs(responseAmount - expectedAmount) > 0.009) {
    throw new Error("Cashfree returned a mismatched order amount");
  }
  if (raw.order_currency && raw.order_currency !== "INR") {
    throw new Error("Cashfree returned an unexpected order currency");
  }
  if (!CASHFREE_PAYMENT_SESSION_PATTERN.test(raw.payment_session_id || "")) {
    throw new Error("Cashfree did not return a valid payment session");
  }
  return {
    cfOrderId: raw.cf_order_id,
    orderId: raw.order_id,
    orderAmount: responseAmount,
    orderStatus: raw.order_status,
    paymentSessionId: raw.payment_session_id,
    paymentLink: raw.payment_link || raw.order_meta?.payment_link,
    raw,
  };
}

export async function createCashfreeOrder(input: CreateCashfreeOrderInput): Promise<CashfreeOrderResponse> {
  const amount = assertCashfreeOrderInput(input);
  const cfg = getCashfreeConfig();
  if (!cfg.appId || !cfg.secretKey) {
    throw new Error("Cashfree is not configured. Missing CASHFREE_APP_ID/CASHFREE_SECRET_KEY.");
  }

  const payload = {
    order_id: input.orderId,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: input.customerId,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone || "9999999999",
    },
    order_meta: {
      return_url: input.returnUrl,
      notify_url: input.notifyUrl,
    },
    order_note: input.notes
      ? JSON.stringify(input.notes).slice(0, 180)
      : "Octamy certificate payment",
  };

  const response = await fetch(`${getApiBase(cfg.environment)}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": cfg.appId,
      "x-client-secret": cfg.secretKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.message || data?.error || `Cashfree order create failed (${response.status})`;
    throw new Error(msg);
  }
  return toPublicOrder(data, input.orderId, amount);
}

export async function fetchCashfreeOrderStatus(orderId: string): Promise<unknown> {
  const cfg = getCashfreeConfig();
  if (!cfg.appId || !cfg.secretKey) {
    throw new Error("Cashfree is not configured. Missing CASHFREE_APP_ID/CASHFREE_SECRET_KEY.");
  }
  const response = await fetch(`${getApiBase(cfg.environment)}/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: {
      "x-api-version": "2023-08-01",
      "x-client-id": cfg.appId,
      "x-client-secret": cfg.secretKey,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data as any)?.message || `Cashfree order status fetch failed (${response.status})`;
    throw new Error(msg);
  }
  return data;
}

const CASHFREE_STATUS_TOKEN_TTL_MS = 30 * 60 * 1000;

function cashfreeStatusSecret(): string {
  const secret = process.env.PAYMENT_STATUS_SECRET || process.env.JWT_SECRET || "";
  if (secret.length < 24) throw new Error("PAYMENT_STATUS_SECRET or JWT_SECRET must be at least 24 characters");
  return secret;
}

export function createCashfreeStatusToken(orderId: string, now = Date.now()): string {
  if (!/^[A-Za-z0-9_-]{8,180}$/.test(orderId)) throw new Error("Invalid Cashfree order ID");
  const payload = Buffer.from(JSON.stringify({ orderId, expiresAt: now + CASHFREE_STATUS_TOKEN_TTL_MS })).toString("base64url");
  const signature = crypto.createHmac("sha256", cashfreeStatusSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCashfreeStatusToken(token: string, now = Date.now()): string | null {
  const [payload, signature, extra] = token.split(".");
  if (extra || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", cashfreeStatusSecret()).update(payload).digest("base64url");
  if (!safeEq(expected, signature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^[A-Za-z0-9_-]{8,180}$/.test(parsed?.orderId)) return null;
    if (!Number.isSafeInteger(parsed?.expiresAt) || parsed.expiresAt <= now || parsed.expiresAt > now + CASHFREE_STATUS_TOKEN_TTL_MS) return null;
    return parsed.orderId;
  } catch {
    return null;
  }
}

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function verifyCashfreeWebhookSignature(rawBody: string, signature: string, timestamp?: string): boolean {
  const cfg = getCashfreeConfig();
  const signingSecret = cfg.webhookSecret || cfg.secretKey;
  if (!signingSecret || !timestamp || !/^\d{10,16}$/.test(timestamp) || !/^[A-Za-z0-9+/=]{40,120}$/.test(signature)) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");
  return safeEq(expected, signature);
}

export function normalizeCashfreePaymentStatus(payload: any): "success" | "failed" | "pending" {
  const status = String(
    payload?.data?.payment?.payment_status ||
      payload?.data?.payment?.paymentStatus ||
      payload?.payment_status ||
      payload?.paymentStatus ||
      payload?.order_status ||
      "",
  ).toUpperCase();

  if (status === "SUCCESS" || status === "PAID") return "success";
  if (status === "FAILED" || status === "CANCELLED" || status === "USER_DROPPED") return "failed";
  return "pending";
}

export type PublicPaymentStatus = "pending" | "completed" | "failed";

/**
 * Maps private/internal payment state to the only values safe for public
 * polling. Unknown, legacy, or attacker-controlled persisted text fails closed
 * as pending rather than being reflected in an API response.
 */
export function publicPaymentStatus(status: unknown): PublicPaymentStatus {
  if (status === "completed") return "completed";
  if (status === "failed" || status === "duplicate") return "failed";
  return "pending";
}
