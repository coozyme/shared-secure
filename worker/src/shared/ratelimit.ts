import type { Context, MiddlewareHandler } from 'hono';
import type { Bindings } from '../env';
import type { AppEnv } from './context';
import { RateLimitedError, ServiceUnavailableError } from './errors';
import { base64UrlEncode } from './ids';
import { log } from './logger';

export type RateLimitBinding = keyof Pick<Bindings, 'RL_READ' | 'RL_CREATE'>;

/** Window used by every rate-limit binding (wrangler.jsonc `simple.period`). */
export const RATE_LIMIT_PERIOD_SECONDS = 60;

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') ?? 'unknown';
}

/**
 * HMAC-SHA-256(secret, utcDay | ip), truncated to 128 bits. The raw IP never leaves this function
 * and the daily salt makes keys unlinkable across days.
 */
export async function hashClientIp(ip: string, secret: string, now: Date): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const day = now.toISOString().slice(0, 10);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${day}|${ip}`));
  return base64UrlEncode(new Uint8Array(mac).slice(0, 16));
}

/**
 * Per-client rate limit backed by a Workers Rate Limiting binding. Counts are approximate and
 * per Cloudflare location (ADR 0006). Fails closed if the binding errors.
 */
export function rateLimit(binding: RateLimitBinding, scope: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ipKey = await hashClientIp(clientIp(c), c.get('config').ipHashSecret, new Date());
    let success: boolean;
    try {
      ({ success } = await c.env[binding].limit({ key: `${scope}:${ipKey}` }));
    } catch (error) {
      log('error', 'rate_limiter_unavailable', { requestId: c.get('requestId'), reasons: [scope] });
      throw new ServiceUnavailableError(error);
    }
    if (!success) {
      log('warn', 'rate_limited', { requestId: c.get('requestId'), reasons: [scope] });
      throw new RateLimitedError(RATE_LIMIT_PERIOD_SECONDS);
    }
    await next();
  };
}
