import { healthResponseSchema } from '@shared/schema';
import { describe, expect, it } from 'vitest';
import { ApiError, apiRequest } from '../src/lib/services/api';

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const respond =
  (body: string, status = 200): typeof fetch =>
  () =>
    Promise.resolve(new Response(body, { status }));

describe('apiRequest', () => {
  it('validates successful responses with the shared schema', async () => {
    const result = await apiRequest('/health', {
      schema: healthResponseSchema,
      fetcher: respond('{"status":"ok"}'),
    });
    expect(result).toEqual({ status: 'ok' });
  });

  it('rejects responses that do not match the schema', async () => {
    await expect(
      apiRequest('/health', { schema: healthResponseSchema, fetcher: respond('{"status":"no"}') }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('surfaces the server error code, never the message', async () => {
    const body = JSON.stringify({
      error: { code: 'not_found', message: 'Not found' },
      requestId: 'r',
    });
    const error = await apiRequest('/notes/x/open', { fetcher: respond(body, 404) }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'not_found' });
  });

  it('maps platform errors without our JSON shape', async () => {
    await expect(apiRequest('/x', { fetcher: respond('<html>', 429) })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    await expect(
      apiRequest('/x', { fetcher: respond('error code: 1027', 503) }),
    ).rejects.toMatchObject({
      code: 'service_unavailable',
    });
  });

  it('reports network failures', async () => {
    await expect(
      apiRequest('/x', { fetcher: () => Promise.reject(new TypeError('offline')) }),
    ).rejects.toMatchObject({ status: 0, code: 'network' });
  });

  it('sends same-origin requests without credentials or referrer', async () => {
    let seen: RequestInit | undefined;
    let url = '';
    await apiRequest('/notes', {
      method: 'POST',
      body: { a: 1 },
      fetcher: (input, init) => {
        url = urlOf(input);
        seen = init;
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    expect(url).toBe('/api/v1/notes');
    expect(seen).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  });
});
