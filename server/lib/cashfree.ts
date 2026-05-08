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
  paymentSessionId?: string;
  paymentLink?: string;
  raw: unknown;
}

export function getCashfreeConfig(): CashfreeConfig {
  const appId = process.env.CASHFREE_APP_ID || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY || "";
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || "";
  const environment = (process.env.CASHFREE_ENV || "production") as CashfreeEnvironment;
  return { appId, secretKey, webhookSecret, environment };
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

function toPublicOrder(raw: any): CashfreeOrderResponse {
  return {
    cfOrderId: raw?.cf_order_id,
    orderId: raw?.order_id,
    orderAmount: raw?.order_amount,
    orderStatus: raw?.order_status,
    paymentSessionId: raw?.payment_session_id,
    paymentLink: raw?.payment_link || raw?.order_meta?.payment_link,
    raw,
  };
}

export async function createCashfreeOrder(input: CreateCashfreeOrderInput): Promise<CashfreeOrderResponse> {
  const cfg = getCashfreeConfig();
  if (!cfg.appId || !cfg.secretKey) {
    throw new Error("Cashfree is not configured. Missing CASHFREE_APP_ID/CASHFREE_SECRET_KEY.");
  }

  const payload = {
    order_id: input.orderId,
    order_amount: Number(input.amount),
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
      ...(input.notes ? { notes: input.notes } : {}),
    },
    order_note: "Octamy certificate payment",
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
  return toPublicOrder(data);
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

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function verifyCashfreeWebhookSignature(rawBody: string, signature: string, timestamp?: string): boolean {
  const cfg = getCashfreeConfig();
  if (!cfg.webhookSecret) return false;
  const bodySig = crypto.createHmac("sha256", cfg.webhookSecret).update(rawBody).digest("base64");
  if (safeEq(bodySig, signature)) return true;
  if (timestamp) {
    const tsSig = crypto
      .createHmac("sha256", cfg.webhookSecret)
      .update(`${timestamp}${rawBody}`)
      .digest("base64");
    if (safeEq(tsSig, signature)) return true;
  }
  return false;
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
