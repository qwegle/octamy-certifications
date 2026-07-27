import { describe, expect, it } from '@jest/globals';
import { isCredentialEligibleAssessment } from '../../server/lib/certificate-policy';

const eligible = {
  productType: 'assessment',
  assessmentPurpose: 'certification',
  certificationMode: 'octamy',
  isActive: true,
  reviewStatus: 'approved',
};

describe('credential assessment policy', () => {
  it('accepts only a live approved certification assessment', () => {
    expect(isCredentialEligibleAssessment(eligible)).toBe(true);
  });

  it.each([
    { assessmentPurpose: 'practice' },
    { certificationMode: 'none' },
    { certificationMode: '' },
    { certificationMode: '   ' },
    { certificationMode: null },
    { certificationMode: undefined },
    { productType: 'video_course' },
    { isActive: false },
    { reviewStatus: 'pending' },
  ])('rejects an ineligible assessment state: %o', (change) => {
    expect(isCredentialEligibleAssessment({ ...eligible, ...change })).toBe(false);
  });

  it('rejects a malformed non-string certification mode at runtime', () => {
    expect(isCredentialEligibleAssessment({ ...eligible, certificationMode: 1 } as unknown as typeof eligible)).toBe(false);
  });
});
