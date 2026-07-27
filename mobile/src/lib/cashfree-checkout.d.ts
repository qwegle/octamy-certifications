export interface CashfreeCheckoutInput {
  paymentLink?: string;
  paymentSessionId: string;
}

export interface CashfreeCheckoutResult {
  type: 'cancel' | 'opened';
}

export function openCashfreeCheckout(input: CashfreeCheckoutInput): Promise<CashfreeCheckoutResult>;
