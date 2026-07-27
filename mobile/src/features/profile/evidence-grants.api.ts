import { z } from 'zod';

import { apiClient, parseApiResponse } from '@/lib/api-client';

export const EVIDENCE_GRANT_CONSENT_VERSION = 'candidate-evidence-consent.v1' as const;

const certificationSchema = z.object({
  id: z.number().int().positive(),
  certificateId: z.string(),
  courseTitle: z.string(),
  score: z.number(),
  badge: z.string().nullable().transform((value) => value ?? ''),
  issuedAt: z.string().optional(),
  expiresAt: z.string(),
  issuedBy: z.string().optional(),
});

const practiceSummarySchema = z.object({
  id: z.number().int().positive(),
  courseTitle: z.string(),
  score: z.number(),
  totalQuestions: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().nullable().optional(),
  passed: z.boolean().optional(),
  mastered: z.boolean().optional(),
  completedAt: z.string(),
});

const selectedEvidenceSchema = z.object({
  certifications: z.array(certificationSchema),
  practiceSummaries: z.array(practiceSummarySchema),
});

const recruiterSchema = z.object({
  id: z.number().int().positive(),
  companyName: z.string().min(1),
  companyWebsite: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  interactionAt: z.string(),
});

const grantSchema = z.object({
  id: z.string().uuid(),
  targetRecruiterId: z.number().int().positive(),
  recruiterCompany: z.string(),
  purpose: z.string(),
  jobReference: z.string().nullable(),
  consentVersion: z.string(),
  grantedAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  revocationReason: z.string().nullable(),
  version: z.number().int().positive(),
  status: z.enum(['active', 'expired', 'revoked']),
  selectedEvidence: selectedEvidenceSchema,
});

const accessEventSchema = z.object({
  id: z.number().int().positive(),
  grantId: z.string().uuid(),
  recruiterId: z.number().int().positive(),
  recruiterCompany: z.string(),
  action: z.string(),
  scopes: z.array(z.string()),
  selectedCertificateIds: z.array(z.number().int().positive()),
  selectedPracticeSummaryIds: z.array(z.number().int().positive()),
  occurredAt: z.string(),
});

const recruitersResponseSchema = z.object({ recruiters: z.array(recruiterSchema) });
const optionsResponseSchema = selectedEvidenceSchema;
const grantsResponseSchema = z.object({ grants: z.array(grantSchema) });
const accessHistoryResponseSchema = z.object({ events: z.array(accessEventSchema) });
const createResponseSchema = z.object({ grant: z.object({ id: z.string().uuid(), status: z.string() }).passthrough() });
const revokeResponseSchema = z.object({ grant: z.object({ id: z.string().uuid(), status: z.literal('revoked'), version: z.number().int().positive() }).passthrough() });

export type EligibleRecruiter = z.infer<typeof recruiterSchema>;
export type EvidenceCertification = z.infer<typeof certificationSchema>;
export type EvidencePracticeSummary = z.infer<typeof practiceSummarySchema>;
export type EvidenceGrant = z.infer<typeof grantSchema>;
export type EvidenceAccessEvent = z.infer<typeof accessEventSchema>;

export interface CreateEvidenceGrantInput {
  certificateIds: number[];
  expiresAt: string;
  jobReference?: string;
  practiceSummaryIds: number[];
  purpose: string;
  targetRecruiterId: number;
}

export async function getEligibleEvidenceRecruiters() {
  const data = await apiClient.get<unknown>('/api/user/evidence-grants/eligible-recruiters');
  return parseApiResponse(recruitersResponseSchema, data).recruiters;
}

export async function getEvidenceGrantOptions() {
  const data = await apiClient.get<unknown>('/api/user/evidence-grants/options');
  return parseApiResponse(optionsResponseSchema, data);
}

export async function getEvidenceGrants() {
  const data = await apiClient.get<unknown>('/api/user/evidence-grants');
  return parseApiResponse(grantsResponseSchema, data).grants;
}

export async function getEvidenceAccessHistory() {
  const data = await apiClient.get<unknown>('/api/user/evidence-grants/access-history');
  return parseApiResponse(accessHistoryResponseSchema, data).events;
}

export async function createEvidenceGrant(input: CreateEvidenceGrantInput) {
  const data = await apiClient.post<unknown>('/api/user/evidence-grants', {
    ...input,
    consentVersion: EVIDENCE_GRANT_CONSENT_VERSION,
  });
  return parseApiResponse(createResponseSchema, data).grant;
}

export async function revokeEvidenceGrant(grant: Pick<EvidenceGrant, 'id' | 'version'>) {
  const data = await apiClient.post<unknown>(`/api/user/evidence-grants/${encodeURIComponent(grant.id)}/revoke`, {
    reason: 'Revoked by learner',
    version: grant.version,
  });
  return parseApiResponse(revokeResponseSchema, data).grant;
}
