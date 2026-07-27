import * as WebBrowser from 'expo-web-browser';

import { ApiError } from '@/lib/api-client';

export interface CashfreeCheckoutInput {
  paymentLink?: string;
  paymentSessionId: string;
}

export interface CashfreeCheckoutResult {
  type: 'cancel' | 'opened';
}

const PAYMENT_SESSION_PATTERN = /^session_[A-Za-z0-9_-]{20,800}$/;
const CASHFREE_PAYMENT_HOSTS = new Set(['payments.cashfree.com', 'sandbox.cashfree.com']);

function trustedPaymentLink(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError({ status: 0, code: 'PAYMENT_LINK_INVALID', message: 'Cashfree returned an invalid payment link.' });
  }
  if (url.protocol !== 'https:' || url.username || url.password || !CASHFREE_PAYMENT_HOSTS.has(url.hostname.toLowerCase())) {
    throw new ApiError({ status: 0, code: 'PAYMENT_LINK_UNTRUSTED', message: 'Cashfree returned an untrusted payment link.' });
  }
  return url.toString();
}

function checkoutUrl(input: CashfreeCheckoutInput): string {
  if (!PAYMENT_SESSION_PATTERN.test(input.paymentSessionId)) {
    throw new ApiError({ status: 0, code: 'PAYMENT_SESSION_INVALID', message: 'Cashfree returned an invalid checkout session.' });
  }
  if (input.paymentLink) return trustedPaymentLink(input.paymentLink);
  const configured = process.env.EXPO_PUBLIC_CASHFREE_CHECKOUT_URL?.trim();
  const base = configured || 'https://octamy.com/payment/cashfree/checkout/';
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ApiError({ status: 0, code: 'CHECKOUT_URL_INVALID', message: 'Octamy checkout is not configured correctly.' });
  }
  if (url.protocol !== 'https:') {
    throw new ApiError({ status: 0, code: 'CHECKOUT_URL_INSECURE', message: 'Octamy checkout requires a secure connection.' });
  }
  const mode = process.env.EXPO_PUBLIC_CASHFREE_ENV?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
  url.hash = new URLSearchParams({ mode, payment_session_id: input.paymentSessionId }).toString();
  return url.toString();
}

export async function openCashfreeCheckout(input: CashfreeCheckoutInput): Promise<CashfreeCheckoutResult> {
  const result = await WebBrowser.openBrowserAsync(checkoutUrl(input));
  return { type: result.type === 'cancel' || result.type === 'dismiss' ? 'cancel' : 'opened' };
}
