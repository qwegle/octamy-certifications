import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { certificateCreationRequestSchema } from '../../server/lib/certificate-issuance-policy';

describe('certificate issuance mutation safety', () => {
  it('accepts only one positive integer exam-attempt identifier', () => {
    expect(certificateCreationRequestSchema.parse({ examAttemptId: '42' })).toEqual({ examAttemptId: 42 });
    expect(certificateCreationRequestSchema.safeParse({}).success).toBe(false);
    expect(certificateCreationRequestSchema.safeParse({ examAttemptId: 0 }).success).toBe(false);
    expect(certificateCreationRequestSchema.safeParse({ examAttemptId: 2, userId: 99 }).success).toBe(false);
  });

  it('serializes an attempt before checking and inserting its credential', () => {
    const source = readFileSync('server/storage.ts', 'utf8');
    const start = source.indexOf('async createCertificate(insertCertificate');
    const end = source.indexOf('async getCertificate(', start);
    const implementation = source.slice(start, end);
    const lock = implementation.indexOf('pg_advisory_xact_lock(7601');
    const existing = implementation.indexOf('eq(certificates.examAttemptId, examAttemptId)');
    const insert = implementation.lastIndexOf('.insert(certificates)');

    expect(lock).toBeGreaterThan(-1);
    expect(existing).toBeGreaterThan(lock);
    expect(insert).toBeGreaterThan(existing);
    expect(implementation).toContain('if (existing) return existing');
  });
});
