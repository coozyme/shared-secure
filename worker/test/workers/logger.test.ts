import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatLogLine, log, redact } from '../../src/shared/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('redact', () => {
  it('drops fragments and query strings', () => {
    expect(redact('/n/abc#secretkey')).toBe('/n/abc');
    expect(redact('/api/v1/notes?token=x')).toBe('/api/v1/notes');
  });

  it('scrubs id-, token- and key-like strings', () => {
    expect(redact('/api/v1/notes/AAAAAAAAAAAAAAAAAAAAAA')).toBe('/api/v1/notes/[redacted]');
    expect(redact(`key ${'k'.repeat(43)} end`)).toBe('key [redacted] end');
    expect(redact('ZXhhbXBsZSBjaXBoZXJ0ZXh0IGJsb2I=')).toBe('[redacted]');
  });

  it('truncates long values', () => {
    expect(redact('a b '.repeat(100)).length).toBeLessThanOrEqual(121);
  });
});

describe('formatLogLine', () => {
  it('emits only allowlisted fields', () => {
    const fields = {
      requestId: 'r1',
      route: '/api/v1/notes/:id',
      status: 200,
      url: 'https://shared.arysetyap.com/n/x#key',
      body: 'ciphertext',
    };
    const line = JSON.parse(formatLogLine('info', 'request', fields)) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(['event', 'level', 'requestId', 'route', 'status']);
  });

  it('never outputs a fragment, even inside allowed fields', () => {
    const line = formatLogLine('warn', 'turnstile_rejected', {
      route: '/n/abc#k3y',
      reasons: ['x#y'],
      errorName: 'E#1',
    });
    expect(line).not.toContain('#');
  });

  it('keeps error class names readable but strips unexpected characters', () => {
    const line = JSON.parse(
      formatLogLine('error', 'unhandled_error', { errorName: 'FeatureDisabledError <x>' }),
    ) as Record<string, unknown>;
    expect(line['errorName']).toBe('FeatureDisabledErrorx');
  });
});

describe('log', () => {
  it('writes one JSON line through console at the given level', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    log('warn', 'rate_limited', { requestId: 'r' });
    expect(spy).toHaveBeenCalledWith('{"level":"warn","event":"rate_limited","requestId":"r"}');
  });
});
