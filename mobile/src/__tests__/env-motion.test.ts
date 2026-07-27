describe('API environment configuration', () => {
  const originalUrl = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalUrl;
    jest.resetModules();
  });

  function loadEnv() {
    let loaded!: typeof import('@/config/env');
    jest.isolateModules(() => {
      loaded = require('@/config/env') as typeof import('@/config/env');
    });
    return loaded;
  }

  it('keeps a missing API URL undefined and throws only at the API boundary', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const { env, requireApiUrl } = loadEnv();
    expect(env.apiUrl).toBeUndefined();
    expect(requireApiUrl).toThrow('EXPO_PUBLIC_API_URL is required');
  });

  it('trims whitespace and all trailing slashes', () => {
    process.env.EXPO_PUBLIC_API_URL = '  https://api.example.test///  ';
    const { env, requireApiUrl } = loadEnv();
    expect(env.apiUrl).toBe('https://api.example.test');
    expect(requireApiUrl()).toBe('https://api.example.test');
  });
});

import { motion, resolveMotionSettings } from '@/theme/motion';

describe('motion policy', () => {
  it('keeps UI feedback and entrance durations below 300ms', () => {
    expect(motion.duration.fast).toBeLessThan(300);
    expect(motion.duration.feedback).toBeLessThan(300);
    expect(motion.duration.enter).toBeLessThan(300);
  });

  it('never scales from or to zero', () => {
    expect(motion.scale.enterFrom).toBeGreaterThan(0);
    expect(motion.scale.pressed).toBeGreaterThan(0);
  });

  it('collapses nonessential timing and press scale when reduced motion is enabled', () => {
    expect(resolveMotionSettings(true)).toEqual({
      reduceMotion: true,
      duration: motion.duration.instant,
      enterDuration: motion.duration.instant,
      pressedScale: 1,
    });
    expect(resolveMotionSettings(false).enterDuration).toBe(motion.duration.enter);
  });
});
