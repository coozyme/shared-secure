import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readJsonBody } from '../../src/shared/body';
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../../src/shared/errors';
import { expiresAt, isExpired, resolveTtlSeconds } from '../../src/shared/ttl';

const schema = z.strictObject({ value: z.string().max(10) });

const jsonRequest = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('https://x/', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('readJsonBody', () => {
  it('parses valid bodies', async () => {
    await expect(readJsonBody(jsonRequest('{"value":"hi"}'), schema, 100)).resolves.toEqual({
      value: 'hi',
    });
  });

  it('requires application/json', async () => {
    const request = jsonRequest('{}', { 'Content-Type': 'text/plain' });
    await expect(readJsonBody(request, schema, 100)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeError,
    );
  });

  it('rejects early on a large Content-Length', async () => {
    const request = jsonRequest('{"value":"hi"}', { 'Content-Length': '1000' });
    await expect(readJsonBody(request, schema, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('enforces the cap while streaming when Content-Length is absent', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(20)));
        controller.close();
      },
    });
    await expect(readJsonBody(jsonRequest(stream), schema, 100)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it.each([
    ['malformed JSON', '{"value":'],
    ['schema violation', '{"value":"far too long here"}'],
    ['unknown field', '{"value":"ok","extra":1}'],
    ['empty body', ''],
  ])('rejects %s with 400', async (_name, body) => {
    await expect(readJsonBody(jsonRequest(body), schema, 100)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('rejects invalid UTF-8', async () => {
    const request = jsonRequest(new Uint8Array([0x22, 0xff, 0x22]));
    await expect(readJsonBody(request, schema, 100)).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('ttl', () => {
  const allowed = [300, 3600, 86400];

  it('accepts only allowlisted TTLs', () => {
    expect(resolveTtlSeconds(3600, allowed)).toBe(3600);
    for (const value of [0, 301, 604800, '3600', null]) {
      expect(() => resolveTtlSeconds(value, allowed)).toThrow(BadRequestError);
    }
  });

  it('computes and checks expiry', () => {
    expect(expiresAt(1000, 300)).toBe(301_000);
    expect(isExpired(301_000, 300_999)).toBe(false);
    expect(isExpired(301_000, 301_000)).toBe(true);
  });
});
