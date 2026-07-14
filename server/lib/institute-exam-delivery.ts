import crypto from "node:crypto";

const INVITE_BYTES = 32;
const BASE64URL_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type SubscriptionWindow = {
  status: string;
  startsAt: Date | string | null;
  renewsAt: Date | string | null;
};

export function normalizeExamInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function createExamInviteToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(INVITE_BYTES).toString("base64url");
  return { rawToken, tokenHash: hashExamInviteToken(rawToken) };
}

export function isValidExamInviteToken(value: unknown): value is string {
  return typeof value === "string" && BASE64URL_TOKEN.test(value);
}

export function hashExamInviteToken(rawToken: string): string {
  if (!isValidExamInviteToken(rawToken)) throw new Error("Invalid exam invitation token");
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isInstituteSubscriptionActive(
  subscription: SubscriptionWindow | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!subscription || subscription.status !== "active" || !subscription.renewsAt) return false;
  const startsAtMs = subscription.startsAt ? new Date(subscription.startsAt).getTime() : null;
  const renewsAtMs = new Date(subscription.renewsAt).getTime();
  return (startsAtMs === null || Number.isFinite(startsAtMs))
    && Number.isFinite(renewsAtMs)
    && (startsAtMs === null || startsAtMs <= nowMs)
    && renewsAtMs > nowMs;
}

export function instituteInviteExpiry(
  subscriptionRenewsAt: Date | string,
  examEndsAt: Date | string | null,
): Date {
  const subscriptionExpiry = new Date(subscriptionRenewsAt);
  if (!examEndsAt) return subscriptionExpiry;
  const examExpiry = new Date(examEndsAt);
  return examExpiry < subscriptionExpiry ? examExpiry : subscriptionExpiry;
}

export function buildExamInviteLink(
  baseUrl: string,
  shareCode: string,
  rawToken: string,
  email: string,
): string {
  if (!isValidExamInviteToken(rawToken)) throw new Error("Invalid exam invitation token");
  const normalizedEmail = normalizeExamInviteEmail(email);
  return `${baseUrl.replace(/\/$/, "")}/x/${encodeURIComponent(shareCode)}#invite=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(normalizedEmail)}`;
}

export function escapeExamInviteHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}
