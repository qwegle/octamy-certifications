import { describe, expect, it } from '@jest/globals';
import {
  normalizePracticePassCycle,
  practiceAccountPath,
  practicePlansPath,
  practicePricingPath,
} from '../../client/src/lib/practice-purchase-intent';

describe('Practice purchase intent', () => {
  it('builds a review-before-payment pricing destination', () => {
    const path = practicePricingPath({ cycle: 'yearly', next: '/practice/react', welcome: true });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/pricing');
    expect(url.searchParams.get('role')).toBe('learner');
    expect(url.searchParams.get('selected')).toBe('all_access');
    expect(url.searchParams.get('cycle')).toBe('yearly');
    expect(url.searchParams.get('next')).toBe('/practice/react');
    expect(url.searchParams.get('welcome')).toBe('1');
  });

  it('shows plans before marking Practice Pass as selected', () => {
    const path = practicePlansPath({ cycle: 'yearly', next: '/practice/interview' });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/pricing');
    expect(url.searchParams.get('role')).toBe('learner');
    expect(url.searchParams.get('selected')).toBeNull();
    expect(url.searchParams.get('cycle')).toBe('yearly');
    expect(url.searchParams.get('next')).toBe('/practice/interview');
  });

  it('preserves the pricing review through registration without auto-charge', () => {
    const path = practiceAccountPath('register', { cycle: 'monthly', next: '/practice/ssc' });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/register');
    expect(url.searchParams.get('role')).toBe('learner');
    expect(url.searchParams.get('plan')).toBe('all_access');
    expect(url.searchParams.get('cycle')).toBe('monthly');
    expect(url.searchParams.get('next')).toContain('/pricing?');
  });

  it('rejects external return destinations and unknown cycles', () => {
    expect(practicePricingPath({ cycle: 'weekly', next: 'https://evil.example' }))
      .toContain('cycle=monthly');
    const url = new URL(practicePricingPath({ next: 'https://evil.example' }), 'https://octamy.test');
    expect(url.searchParams.get('next')).toBe('/practice');
    expect(normalizePracticePassCycle('yearly')).toBe('yearly');
  });
});
