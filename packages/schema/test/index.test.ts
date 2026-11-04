import { describe, expect, it } from 'vitest';
import {
  FILE_CHUNK_SIZE_BYTES,
  errorResponseSchema,
  fileCreateRequestSchema,
  fileReadStartResponseSchema,
  idSchema,
  NOTE_BLOB_MIN_BYTES,
  base64UrlByteLength,
  noteCreateRequestSchema,
  noteOpenResponseSchema,
  noteStatusResponseSchema,
  publicConfigSchema,
  tokenSchema,
} from '../src/index';

describe('idSchema', () => {
  it('accepts 22-char base64url', () => {
    expect(idSchema.safeParse('AAAAAAAAAAAAAAAAAAAA-_').success).toBe(true);
  });

  it.each([
    '',
    'short',
    'AAAAAAAAAAAAAAAAAAAAA+/',
    'AAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAA=',
  ])('rejects %j', (value) => {
    expect(idSchema.safeParse(value).success).toBe(false);
  });
});

describe('tokenSchema', () => {
  it('requires 43 base64url chars', () => {
    expect(tokenSchema.safeParse('a'.repeat(43)).success).toBe(true);
    expect(tokenSchema.safeParse('a'.repeat(42)).success).toBe(false);
  });
});

describe('errorResponseSchema', () => {
  it('rejects unknown fields so internals cannot leak through', () => {
    const result = errorResponseSchema.safeParse({
      error: { code: 'not_found', message: 'Not found', stack: 'x' },
      requestId: 'r',
    });
    expect(result.success).toBe(false);
  });
});

describe('note schemas', () => {
  const blob = 'A'.repeat(Math.ceil((NOTE_BLOB_MIN_BYTES * 4) / 3));
  const valid = { blob, ttlSeconds: 3600, burnAfterRead: true, turnstileToken: 'x'.repeat(2048) };

  it('accepts a valid create request', () => {
    expect(noteCreateRequestSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['oversized Turnstile token', { turnstileToken: 'x'.repeat(2049) }],
    ['blob below the padded minimum', { blob: 'A'.repeat(100) }],
    ['blob with non-base64url characters', { blob: `${blob.slice(1)}+` }],
    ['client-chosen id', { id: 'A'.repeat(22) }],
    ['legacy iv field', { iv: 'abc' }],
  ])('rejects %s', (_name, override) => {
    expect(noteCreateRequestSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('computes decoded base64url length', () => {
    expect(base64UrlByteLength('AAAA')).toBe(3);
    expect(base64UrlByteLength('AAAAAA')).toBe(4);
    expect(base64UrlByteLength(blob)).toBeGreaterThanOrEqual(NOTE_BLOB_MIN_BYTES);
  });

  it('keeps status and open responses minimal', () => {
    expect(noteStatusResponseSchema.safeParse({ burnAfterRead: true, expiresAt: 1 }).success).toBe(
      true,
    );
    expect(
      noteOpenResponseSchema.safeParse({ blob, burnAfterRead: false, expiresAt: 1, extra: 1 })
        .success,
    ).toBe(false);
  });
});

describe('publicConfigSchema', () => {
  it('rejects unknown keys so secrets cannot be published by accident', () => {
    const config = {
      features: { notes: true, files: false, liveNotes: false },
      notes: { ttlOptionsSeconds: [300], maxBlobBytes: 262_173 },
      files: { ttlOptionsSeconds: [300], maxBytes: 1 },
      turnstileSiteKey: '1x00000000000000000000AA',
    };
    expect(publicConfigSchema.safeParse(config).success).toBe(true);
    expect(publicConfigSchema.safeParse({ ...config, turnstileSecretKey: 'x' }).success).toBe(
      false,
    );
  });
});

describe('file schemas', () => {
  it('enforces chunk-size invariants', () => {
    expect(
      fileCreateRequestSchema.safeParse({
        headerCiphertext: 'a',
        headerIv: 'b',
        noncePrefix: 'c',
        ttlSeconds: 3600,
        maxDownloads: 1,
        totalChunks: 2,
        totalCipherBytes: 42,
        lastChunkPlainBytes: 1,
        chunkSizeBytes: FILE_CHUNK_SIZE_BYTES,
        turnstileToken: 'x',
      }).success,
    ).toBe(true);
    expect(
      fileCreateRequestSchema.safeParse({
        headerCiphertext: 'a',
        headerIv: 'b',
        noncePrefix: 'c',
        ttlSeconds: 3600,
        maxDownloads: 1,
        totalChunks: 2,
        totalCipherBytes: 42,
        lastChunkPlainBytes: 1,
        chunkSizeBytes: 1024,
        turnstileToken: 'x',
      }).success,
    ).toBe(false);
  });

  it('validates download-start payload shape', () => {
    expect(
      fileReadStartResponseSchema.safeParse({
        headerCiphertext: 'a',
        headerIv: 'b',
        noncePrefix: 'c',
        totalChunks: 2,
        chunkSizeBytes: FILE_CHUNK_SIZE_BYTES,
        lastChunkPlainBytes: 1,
        downloadToken: 'a'.repeat(43),
      }).success,
    ).toBe(true);
  });
});
