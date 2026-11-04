import { exports } from 'cloudflare:workers';
import { errorResponseSchema, healthResponseSchema } from '@shared/schema';
import { apiHeaders } from '@shared/security-headers';
import { describe, expect, it } from 'vitest';

const BASE = 'https://shared.arysetyap.com';

const call = (path: string, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(new Request(`${BASE}${path}`, init));

function expectSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(apiHeaders())) {
    expect(response.headers.get(name), name).toBe(value);
  }
  expect(response.headers.get('X-Request-Id')).toMatch(/^[A-Za-z0-9_-]{16}$/);
}

describe('GET /api/v1/health', () => {
  it('returns ok with the full security header set', async () => {
    const response = await call('/api/v1/health');
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({ status: 'ok' });
    expectSecurityHeaders(response);
  });
});

describe('uniform errors', () => {
  it.each(['/api/v1/does-not-exist', '/api/v1/notes/AAAAAAAAAAAAAAAAAAAAAA', '/api/v2/health'])(
    '%s → uniform 404 JSON with headers',
    async (path) => {
      const response = await call(path);
      expect(response.status).toBe(404);
      const body = errorResponseSchema.parse(await response.json());
      expect(body.error).toEqual({ code: 'not_found', message: 'Not found' });
      expect(body.requestId).toBe(response.headers.get('X-Request-Id'));
      expectSecurityHeaders(response);
    },
  );

  it('404 bodies are identical apart from the request id', async () => {
    const strip = async (response: Response) => {
      const body = errorResponseSchema.parse(await response.json());
      return { ...body, requestId: '' };
    };
    const a = await strip(await call('/api/v1/notes/AAAAAAAAAAAAAAAAAAAAAA'));
    const b = await strip(await call('/api/v1/nothing-here'));
    expect(a).toEqual(b);
  });

  it('unknown files routes return uniform 404', async () => {
    const response = await call('/api/v1/files/anything');
    expect(response.status).toBe(404);
    const body = errorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe('not_found');
    expectSecurityHeaders(response);
  });
});
