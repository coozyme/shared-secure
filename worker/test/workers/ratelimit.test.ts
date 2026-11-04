import { env } from 'cloudflare:workers';
import { errorResponseSchema } from '@shared/schema';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { getConfig, type Bindings } from '../../src/env';
import type { AppEnv } from '../../src/shared/context';
import { handleError, requestContext } from '../../src/shared/http';
import { hashClientIp, rateLimit } from '../../src/shared/ratelimit';

function appWith(limit: RateLimit['limit']) {
  // `env` is typed from the generated runtime types; our Bindings interface is the source of truth.
  const bindings: Bindings = { ...(env as unknown as Bindings), RL_CREATE: { limit } };
  const app = new Hono<AppEnv>();
  app.use('*', requestContext);
  app.use('*', async (c, next) => {
    c.set('config', getConfig(bindings));
    await next();
  });
  app.post('/create', rateLimit('RL_CREATE', 'create'), (c) => c.text('created'));
  app.onError(handleError);
  return (ip: string) =>
    app.request('/create', { method: 'POST', headers: { 'CF-Connecting-IP': ip } }, bindings);
}

describe('hashClientIp', () => {
  it('is deterministic per day and secret, and hides the IP', async () => {
    const day = new Date('2026-11-03T10:00:00Z');
    const a = await hashClientIp('203.0.113.7', 'secret', day);
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toContain('203');
    expect(await hashClientIp('203.0.113.7', 'secret', new Date('2026-11-03T23:59:59Z'))).toBe(a);
    expect(await hashClientIp('203.0.113.7', 'secret', new Date('2026-11-04T00:00:00Z'))).not.toBe(
      a,
    );
    expect(await hashClientIp('203.0.113.7', 'other', day)).not.toBe(a);
    expect(await hashClientIp('203.0.113.8', 'secret', day)).not.toBe(a);
  });
});

describe('rateLimit middleware', () => {
  it('allows requests under the limit with a scoped, hashed key', async () => {
    const limit = vi.fn<RateLimit['limit']>().mockResolvedValue({ success: true });
    const response = await appWith(limit)('203.0.113.7');
    expect(response.status).toBe(200);
    const key = limit.mock.calls[0]?.[0].key ?? '';
    expect(key).toMatch(/^create:[A-Za-z0-9_-]{22}$/);
    expect(key).not.toContain('203.0.113.7');
  });

  it('returns 429 with Retry-After when the limit is hit', async () => {
    const limit = vi.fn<RateLimit['limit']>().mockResolvedValue({ success: false });
    const response = await appWith(limit)('203.0.113.7');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe('rate_limited');
  });

  it('fails closed when the limiter errors', async () => {
    const limit = vi.fn<RateLimit['limit']>().mockRejectedValue(new Error('boom'));
    const response = await appWith(limit)('203.0.113.7');
    expect(response.status).toBe(503);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe('service_unavailable');
  });
});
