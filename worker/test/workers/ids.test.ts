import { idSchema, tokenSchema } from '@shared/schema';
import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  generateId,
  generateRequestId,
  generateToken,
  hashToken,
  timingSafeEqual,
} from '../../src/shared/ids';

describe('ids', () => {
  it('generates 128-bit base64url ids that match the shared schema', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(idSchema.safeParse(id).success).toBe(true);
  });

  it('generates 256-bit tokens', () => {
    expect(tokenSchema.safeParse(generateToken()).success).toBe(true);
    expect(generateToken()).not.toBe(generateToken());
  });

  it('generates request ids', () => {
    expect(generateRequestId()).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it('base64url-encodes without padding', () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
    expect(base64UrlEncode(new Uint8Array([]))).toBe('');
  });

  it('hashes tokens with SHA-256 (known answer)', async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await hashToken('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });

  it('compares strings in constant time', () => {
    expect(timingSafeEqual('same', 'same')).toBe(true);
    expect(timingSafeEqual('same', 'samf')).toBe(false);
    expect(timingSafeEqual('same', 'longer')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
