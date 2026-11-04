import { asBufferSource, fromBase64Url, toBase64Url, utf8Encoder } from './encoding';

/** Every secret is 256 bits from `crypto.getRandomValues`. */
export const SECRET_BYTES = 32;
/** base64url length of a secret (no padding). */
export const SECRET_LENGTH = 43;

const HKDF_SALT = 'shared/v1/salt';

/** HKDF `info` labels. One label per purpose; a derived key is never used for two purposes. */
export const KEY_PURPOSE = {
  content: 'shared/v1/content',
  metadata: 'shared/v1/metadata',
  writeToken: 'shared/v1/write-token',
} as const;
export type KeyPurpose = (typeof KEY_PURPOSE)[keyof typeof KEY_PURPOSE];

/**
 * Creates a fresh link secret. Security assumption: the browser CSPRNG is sound. The secret must
 * only ever travel in a URL fragment, never in a path, query string or request body.
 */
export function generateSecret(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
}

/** Parses a secret from a URL fragment value. Returns null for anything that isn't exactly 256 bits. */
export function parseSecret(value: string): Uint8Array | null {
  if (value.length !== SECRET_LENGTH) return null;
  try {
    const bytes = fromBase64Url(value);
    return bytes.byteLength === SECRET_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * HKDF-SHA-256(secret, salt = "shared/v1/salt", info = purpose). A fixed salt is fine because the
 * input keying material is already uniformly random (RFC 5869 §3.1).
 */
export async function deriveBytes(
  secret: Uint8Array,
  purpose: KeyPurpose,
  length: number,
): Promise<Uint8Array> {
  const ikm = await crypto.subtle.importKey('raw', asBufferSource(secret), 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: asBufferSource(utf8Encoder.encode(HKDF_SALT)),
      info: asBufferSource(utf8Encoder.encode(purpose)),
    },
    ikm,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** Derives a non-extractable AES-256-GCM key for one purpose. */
export async function deriveAesKey(secret: Uint8Array, purpose: KeyPurpose): Promise<CryptoKey> {
  const raw = await deriveBytes(secret, purpose, 32);
  return crypto.subtle.importKey('raw', asBufferSource(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Write token for live notes (Phase 3). The server only ever stores its SHA-256. */
export async function deriveWriteToken(secret: string): Promise<string> {
  const bytes = parseSecret(secret);
  if (bytes === null) throw new Error('invalid secret');
  return toBase64Url(await deriveBytes(bytes, KEY_PURPOSE.writeToken, 32));
}
