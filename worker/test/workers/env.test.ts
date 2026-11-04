import { describe, expect, it } from 'vitest';
import { getConfig, parseConfig, type Bindings } from '../../src/env';
import { ServiceUnavailableError } from '../../src/shared/errors';

const valid: Partial<Bindings> = {
  ENVIRONMENT: 'production',
  FEATURE_NOTES: 'true',
  FEATURE_FILES: 'false',
  FEATURE_LIVE_NOTES: 'false',
  MAX_JSON_BODY_BYTES: '1048576',
  MAX_FILE_BYTES_GUEST: '52428800',
  MAX_FILE_CHUNKS: '200',
  MAX_NOTE_BYTES: '262173',
  GUEST_NOTE_TTL_OPTIONS_SECONDS: '3600, 300,86400,300,604800',
  GUEST_FILE_TTL_OPTIONS_SECONDS: '300,3600',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_EXPECTED_HOSTNAME: 'shared.arysetyap.com',
  TURNSTILE_SECRET_KEY: 'secret-value',
  IP_HASH_SECRET: 'x'.repeat(32),
};

describe('parseConfig', () => {
  it('parses and normalizes valid bindings', () => {
    const result = parseConfig(valid);
    expect(result).toEqual({
      ok: true,
      config: {
        environment: 'production',
        features: { notes: true, files: false, liveNotes: false },
        limits: {
          maxJsonBodyBytes: 1048576,
          maxFileBytesGuest: 52428800,
          maxFileChunks: 200,
          maxNoteBytes: 262173,
          guestNoteTtlOptionsSeconds: [300, 3600, 86400, 604800],
          guestFileTtlOptionsSeconds: [300, 3600],
        },
        turnstile: {
          siteKey: '1x00000000000000000000AA',
          secretKey: 'secret-value',
          expectedHostname: 'shared.arysetyap.com',
        },
        ipHashSecret: 'x'.repeat(32),
        adminTokenHash: '',
      },
    });
  });

  it.each<[string, Partial<Bindings>]>([
    ['ENVIRONMENT', { ENVIRONMENT: 'staging' }],
    ['FEATURE_NOTES', { FEATURE_NOTES: 'yes' }],
    ['MAX_JSON_BODY_BYTES', { MAX_JSON_BODY_BYTES: '1' }],
    ['MAX_FILE_BYTES_GUEST', { MAX_FILE_BYTES_GUEST: '0' }],
    ['MAX_FILE_CHUNKS', { MAX_FILE_CHUNKS: '0' }],
    ['GUEST_NOTE_TTL_OPTIONS_SECONDS', { GUEST_NOTE_TTL_OPTIONS_SECONDS: '10' }],
    ['GUEST_FILE_TTL_OPTIONS_SECONDS', { GUEST_FILE_TTL_OPTIONS_SECONDS: '300,abc' }],
    ['MAX_NOTE_BYTES', { MAX_NOTE_BYTES: '100' }],
    ['TURNSTILE_SITE_KEY', { TURNSTILE_SITE_KEY: '' }],
    ['ADMIN_TOKEN_HASH', { ADMIN_TOKEN_HASH: 'not-a-hash' }],
    ['TURNSTILE_SECRET_KEY', { TURNSTILE_SECRET_KEY: '' }],
    ['IP_HASH_SECRET', { IP_HASH_SECRET: 'short' }],
  ])('reports %s as invalid without leaking its value', (key, override) => {
    const result = parseConfig({ ...valid, ...override });
    expect(result).toEqual({ ok: false, invalidKeys: [key] });
  });

  it('reports missing secrets', () => {
    const { TURNSTILE_SECRET_KEY: _t, IP_HASH_SECRET: _i, ...rest } = valid;
    const result = parseConfig(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidKeys.sort()).toEqual(['IP_HASH_SECRET', 'TURNSTILE_SECRET_KEY']);
    }
  });
});

describe('getConfig', () => {
  it('fails closed with 503 when bindings are invalid', () => {
    const broken = { ...valid, IP_HASH_SECRET: 'short' } as Bindings;
    expect(() => getConfig(broken)).toThrow(ServiceUnavailableError);
  });

  it('caches the parsed config per bindings object', () => {
    const bindings = { ...valid } as Bindings;
    expect(getConfig(bindings)).toBe(getConfig(bindings));
  });
});
