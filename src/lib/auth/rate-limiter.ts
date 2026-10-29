/**
 * KitchFlow OS — PIN Brute Force Rate Limiter
 * Guards against brute-force guessing of 4-digit terminal PINs.
 */

interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
}

// In-memory window cache (keyed by IP or client identifier)
const rateLimitMap = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkPinRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if locked
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Lock expired, reset window
  if (record.lockedUntil !== 0 && record.lockedUntil <= now) {
    rateLimitMap.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return {
    allowed: remaining > 0,
    remainingAttempts: remaining,
  };
}

export function recordFailedPinAttempt(identifier: string): {
  remainingAttempts: number;
  isLocked: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  let record = rateLimitMap.get(identifier);

  if (!record) {
    record = { attempts: 1, lockedUntil: 0 };
    rateLimitMap.set(identifier, record);
    return { remainingAttempts: MAX_ATTEMPTS - 1, isLocked: false };
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitMap.set(identifier, record);
    return {
      remainingAttempts: 0,
      isLocked: true,
      retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  rateLimitMap.set(identifier, record);
  return {
    remainingAttempts: MAX_ATTEMPTS - record.attempts,
    isLocked: false,
  };
}

export function resetPinRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

