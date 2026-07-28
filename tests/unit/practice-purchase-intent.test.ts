import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
  normalizePracticePassCycle,
  practiceAccountPath,
  practicePassPath,
  practicePlansPath,
  practicePricingPath,
  PRACTICE_PASS_PRICES,
} from '../../client/src/lib/practice-purchase-intent';

describe('Practice purchase intent', () => {
  it('keeps the legacy selected-plan handoff used by registration', () => {
    const path = practicePricingPath({ cycle: 'yearly', next: '/practice/react', welcome: true });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/pricing');
    expect(url.searchParams.get('role')).toBe('learner');
    expect(url.searchParams.get('selected')).toBe('all_access');
    expect(url.searchParams.get('cycle')).toBe('yearly');
    expect(url.searchParams.get('next')).toBe('/practice/react');
    expect(url.searchParams.get('welcome')).toBe('1');
  });

  it('uses the dedicated Practice Pass surface before selection', () => {
    const path = practicePlansPath({ cycle: 'yearly', next: '/practice/interview' });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/pricing/practice-pass');
    expect(url.searchParams.get('selected')).toBeNull();
    expect(url.searchParams.get('cycle')).toBe('yearly');
    expect(url.searchParams.get('next')).toBe('/practice/interview');
  });

  it('builds a canonical selected Practice Pass URL without losing the assessment slug', () => {
    const path = practicePassPath({ cycle: 'monthly', next: '/practice/ssc-cgl', selected: true, welcome: true });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/pricing/practice-pass');
    expect(url.searchParams.get('selected')).toBe('all_access');
    expect(url.searchParams.get('next')).toBe('/practice/ssc-cgl');
    expect(url.searchParams.get('welcome')).toBe('1');
  });

  it('preserves the pricing review through registration without auto-charge', () => {
    const path = practiceAccountPath('register', { cycle: 'monthly', next: '/practice/ssc' });
    const url = new URL(path, 'https://octamy.test');
    expect(url.pathname).toBe('/register');
    expect(url.searchParams.get('role')).toBe('learner');
    expect(url.searchParams.get('plan')).toBe('all_access');
    expect(url.searchParams.get('cycle')).toBe('monthly');
    expect(url.searchParams.get('next')).toContain('/pricing?');
    expect(decodeURIComponent(url.searchParams.get('next') || '')).toContain('/practice/ssc');
  });

  it('rejects external return destinations and unknown cycles', () => {
    const url = new URL(practicePassPath({ cycle: 'weekly', next: 'https://evil.example' }), 'https://octamy.test');
    expect(url.searchParams.get('cycle')).toBe('monthly');
    expect(url.searchParams.get('next')).toBe('/practice');
    expect(normalizePracticePassCycle('yearly')).toBe('yearly');
  });

  it('keeps prices aligned with the guarded checkout plan', () => {
    expect(PRACTICE_PASS_PRICES).toEqual({ monthly: 299, yearly: 2990 });
  });

  it('registers separated pricing routes before the pricing hub', () => {
    const app = readFileSync('client/src/App.tsx', 'utf8');
    const practice = app.indexOf('<Route path="/pricing/practice-pass"');
    const certification = app.indexOf('<Route path="/pricing/certification"');
    const workspaces = app.indexOf('<Route path="/pricing/workspaces"');
    const hub = app.indexOf('<Route path="/pricing" component={Pricing} />');
    expect(practice).toBeGreaterThan(-1);
    expect(certification).toBeGreaterThan(-1);
    expect(workspaces).toBeGreaterThan(-1);
    expect(practice).toBeLessThan(hub);
    expect(certification).toBeLessThan(hub);
    expect(workspaces).toBeLessThan(hub);
  });
});
