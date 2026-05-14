/**
 * In-memory per-identifier login throttle.
 *
 * After MAX_FAILURES in WINDOW_MS, the identifier is locked for LOCK_MS.
 * Successful login clears the counter. Identifier is typically the email
 * (lowercased) so attackers can't cycle IPs to bypass the IP-based limiter.
 *
 * In-memory is acceptable for a single-process deploy (pm2 -i 1). Move to
 * Redis if/when we scale horizontally.
 */
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

interface Entry {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const map = new Map<string, Entry>();

function key(id: string): string {
  return id.trim().toLowerCase();
}

export function isLocked(id: string): { locked: boolean; retryAfterSec?: number } {
  const e = map.get(key(id));
  if (!e) return { locked: false };
  if (e.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSec: Math.ceil((e.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false };
}

export function recordFailure(id: string): { locked: boolean; remaining: number } {
  const k = key(id);
  const now = Date.now();
  const e = map.get(k);
  if (!e || now - e.firstAt > WINDOW_MS) {
    map.set(k, { count: 1, firstAt: now, lockedUntil: 0 });
    return { locked: false, remaining: MAX_FAILURES - 1 };
  }
  e.count += 1;
  if (e.count >= MAX_FAILURES) {
    e.lockedUntil = now + LOCK_MS;
    return { locked: true, remaining: 0 };
  }
  return { locked: false, remaining: MAX_FAILURES - e.count };
}

export function recordSuccess(id: string): void {
  map.delete(key(id));
}

// Periodic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of map.entries()) {
    if (e.lockedUntil < now && now - e.firstAt > WINDOW_MS) {
      map.delete(k);
    }
  }
}, 5 * 60 * 1000).unref();
