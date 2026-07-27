import { describe, expect, it } from '@jest/globals';
import { assertDestructiveSeedAllowed } from '../../server/lib/destructive-seed-guard';

describe('destructive comprehensive seed guard', () => {
  it('always refuses production even with the opt-in set', () => {
    expect(() => assertDestructiveSeedAllowed({
      NODE_ENV: 'production',
      ALLOW_DESTRUCTIVE_SEED: 'true',
    })).toThrow('disabled in production');
  });

  it('refuses non-production execution without the exact opt-in', () => {
    expect(() => assertDestructiveSeedAllowed({
      NODE_ENV: 'development',
    })).toThrow('Refusing to truncate seed tables');
  });

  it('allows an explicitly opted-in non-production environment', () => {
    expect(() => assertDestructiveSeedAllowed({
      NODE_ENV: 'development',
      ALLOW_DESTRUCTIVE_SEED: 'true',
    })).not.toThrow();
  });
});
