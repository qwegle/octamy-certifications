/**
 * Sentry initialisation. No-op when SENTRY_DSN is unset, so dev/CI keep working.
 * Loaded as the very first import in server/index.ts so it can capture startup
 * errors and patch async hooks before any other module runs.
 */
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  });
  // eslint-disable-next-line no-console
  console.log('[sentry] initialised for env', process.env.NODE_ENV || 'development');
}

export { Sentry };
