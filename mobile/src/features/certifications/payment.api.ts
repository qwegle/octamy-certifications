import { z } from 'zod';

import { apiClient, parseApiResponse } from '@/lib/api-client';

const cashfreeCheckoutSchema = z.object({
  success: z.literal(true),
  gateway: z.literal('cashfree'),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{8,180}$/),
  transactionId: z.string().regex(/^[A-Za-z0-9_-]{8,180}$/).optional(),
  amount: z.union([z.string(), z.number()]),
  currency: z.literal('INR').optional().default('INR'),
  paymentSessionId: z.string().regex(/^session_[A-Za-z0-9_-]{20,800}$/),
  paymentLink: z.string().url().optional(),
  statusToken: z.string().min(40).max(800),
});

const payuCheckoutSchema = z.object({
  success: z.literal(true),
  gateway: z.literal('payumoney').optional().default('payumoney'),
  transactionId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().optional().default('INR'),
  paymentForm: z.unknown(),
});

const checkoutSchema = z.union([cashfreeCheckoutSchema, payuCheckoutSchema]);
const localPaymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'duplicate']);
const statusSchema = z.object({
  orderId: z.string().regex(/^[A-Za-z0-9_-]{8,180}$/),
  localStatus: localPaymentStatusSchema.nullable(),
});
const activationSchema = z.object({
  certificateId: z.string(),
  certificateNumber: z.string().nullable().optional(),
  courseTitle: z.string(),
  status: z.enum(['activated', 'revoked', 'ready']),
  isPaid: z.boolean(),
  isActive: z.boolean(),
  pricing: z.object({
    currency: z.literal('INR'),
    digital: z.union([z.string(), z.number()]),
    physicalShipping: z.union([z.string(), z.number()]),
    originalDigital: z.string().nullable(),
    isOnSale: z.boolean(),
  }),
}).passthrough();

export type PaymentCheckout = z.infer<typeof checkoutSchema>;
export type CashfreeCheckout = z.infer<typeof cashfreeCheckoutSchema>;
export type CertificateActivation = z.infer<typeof activationSchema>;

export async function createResultCertificateCheckout(tempExamId: string): Promise<PaymentCheckout> {
  return parseApiResponse(checkoutSchema, await apiClient.post<unknown>('/api/payment/initiate', {
    tempExamId,
    includesPhysicalCopy: false,
  }));
}

export async function getCertificateActivation(certificateId: string): Promise<CertificateActivation> {
  return parseApiResponse(activationSchema, await apiClient.get<unknown>(`/api/certificates/${encodeURIComponent(certificateId)}/activation`));
}

export async function createCertificateActivationCheckout(certificateId: string): Promise<PaymentCheckout> {
  return parseApiResponse(checkoutSchema, await apiClient.post<unknown>('/api/payment/initiate', {
    certificateId,
    includesPhysicalCopy: false,
  }));
}

export async function getCashfreePaymentStatus(orderId: string, statusToken: string) {
  const query = new URLSearchParams({ token: statusToken });
  return parseApiResponse(statusSchema, await apiClient.get<unknown>(`/api/payments/cashfree/${encodeURIComponent(orderId)}/status?${query.toString()}`, { auth: false }));
}

export function cashfreeLocalState(status: z.infer<typeof localPaymentStatusSchema> | null): 'confirmed' | 'failed' | 'pending' {
  if (status === 'completed') return 'confirmed';
  if (status === 'failed' || status === 'duplicate') return 'failed';
  return 'pending';
}
