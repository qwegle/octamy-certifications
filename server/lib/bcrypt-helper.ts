import bcrypt from 'bcrypt';

const ROUNDS = (() => {
  const n = Number(process.env.BCRYPT_ROUNDS);
  return Number.isFinite(n) && n >= 10 && n <= 14 ? n : 12;
})();

/**
 * Hash a password using the env-configured bcrypt cost (default 12, range 10-14).
 * Centralised so we never drift to weaker rounds again.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Re-export compare for one-stop import. */
export const comparePassword = bcrypt.compare;

/**
 * Lightweight password strength check. Throws an Error with a user-facing
 * message when the password is too weak. Use in registration / reset flows.
 */
export function assertStrongPassword(plain: string): void {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (plain.length > 128) {
    throw new Error('Password must be 128 characters or fewer.');
  }
  const hasLetter = /[A-Za-z]/.test(plain);
  const hasDigitOrSym = /[\d\W_]/.test(plain);
  if (!hasLetter || !hasDigitOrSym) {
    throw new Error('Password must contain letters and at least one number or symbol.');
  }
}
