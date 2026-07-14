import { describe, expect, it } from '@jest/globals';
import {
  amountsMatch,
  isCredentialOwnedBy,
} from '../../server/lib/credential-activation-policy';

describe('Credential activation security helpers', () => {
  it('accepts the persisted owner id without relying on client identity fields', () => {
    expect(isCredentialOwnedBy(
      { userId: 42, userEmail: 'old@example.com' } as any,
      { id: 42, email: 'current@example.com' } as any,
    )).toBe(true);
  });

  it('never lets a matching email override a different persisted owner id', () => {
    expect(isCredentialOwnedBy(
      { userId: 7, userEmail: 'shared@example.com' } as any,
      { id: 42, email: 'shared@example.com' } as any,
    )).toBe(false);
  });

  it('recovers an unclaimed legacy row only on an exact normalized email match', () => {
    expect(isCredentialOwnedBy(
      { userId: null, userEmail: ' Learner@Example.com ' } as any,
      { id: 42, email: 'learner@example.com' } as any,
    )).toBe(true);
    expect(isCredentialOwnedBy(
      { userId: null, userEmail: 'another@example.com' } as any,
      { id: 42, email: 'learner@example.com' } as any,
    )).toBe(false);
  });

  it('compares verified provider totals at currency precision', () => {
    expect(amountsMatch('149.50', 149.5)).toBe(true);
    expect(amountsMatch('149.50', '149.49')).toBe(false);
    expect(amountsMatch('149.50', undefined)).toBe(false);
  });
});
