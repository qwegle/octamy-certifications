/**
 * Minimal structured (JSON) logger. No new deps to keep the bundle lean.
 * In production: emits one JSON object per line for ingestion by Loki / CloudWatch / Datadog.
 * In development: prints a colourless human-readable line.
 *
 *   import { logger } from './lib/logger';
 *   logger.info('payment.captured', { orderId, amountINR });
 *   logger.warn('payment.partial', { orderId });
 *   logger.error('payment.failed', { orderId, err });
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[(process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')];
const isProd = process.env.NODE_ENV === 'production';

function safeMeta(meta?: Record<string, any>) {
  if (!meta) return undefined;
  const out: Record<string, any> = {};
  for (const k of Object.keys(meta)) {
    const v = meta[k];
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message, stack: v.stack };
    } else if (typeof v === 'function') {
      continue;
    } else if (typeof v === 'bigint') {
      out[k] = v.toString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, msg: string, meta?: Record<string, any>) {
  if (LEVELS[level] < minLevel) return;
  const ts = new Date().toISOString();
  const safe = safeMeta(meta);
  if (isProd) {
    process.stdout.write(JSON.stringify({ ts, level, msg, ...safe }) + '\n');
  } else {
    const tail = safe && Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : '';
    // eslint-disable-next-line no-console
    console.log(`${ts} ${level.toUpperCase()} ${msg}${tail}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, any>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, any>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, any>) => emit('error', msg, meta),
};
