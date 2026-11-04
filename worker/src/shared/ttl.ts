import { BadRequestError } from './errors';

/** Accepts only TTLs from the configured allowlist so clients cannot pick arbitrary lifetimes. */
export function resolveTtlSeconds(requested: unknown, allowed: readonly number[]): number {
  if (typeof requested !== 'number' || !allowed.includes(requested)) {
    throw new BadRequestError('Unsupported expiry');
  }
  return requested;
}

export function expiresAt(nowMs: number, ttlSeconds: number): number {
  return nowMs + ttlSeconds * 1000;
}

export function isExpired(expiresAtMs: number, nowMs: number): boolean {
  return nowMs >= expiresAtMs;
}
