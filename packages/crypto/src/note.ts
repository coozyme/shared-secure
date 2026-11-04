import {
  asBufferSource,
  concatBytes,
  fromBase64Url,
  toBase64Url,
  utf8Decoder,
  utf8Encoder,
} from './encoding';
import { FORMAT_VERSION } from './format';
import { KEY_PURPOSE, deriveAesKey, parseSecret } from './keys';

export interface NotePayload {
  readonly title?: string;
  readonly body: string;
  readonly format: 'text' | 'markdown';
}

/** Thrown for every decryption or parsing failure. Deliberately carries no detail. */
export class DecryptionError extends Error {
  constructor() {
    super('decryption failed');
    this.name = 'DecryptionError';
  }
}

const IV_BYTES = 12;
const TAG_BYTES = 16;
const LENGTH_PREFIX_BYTES = 4;
const MIN_PADDED_BYTES = 1024;
/** version(1) + iv(12) + GCM tag(16) */
export const NOTE_BLOB_OVERHEAD_BYTES = 1 + IV_BYTES + TAG_BYTES;

const NOTE_AAD = concatBytes(utf8Encoder.encode('shared/v1/note'), Uint8Array.of(FORMAT_VERSION));

/** Smallest power of two ≥ max(1 KiB, n). Ciphertext size then only reveals a size bucket. */
export function paddedSize(n: number): number {
  let size = MIN_PADDED_BYTES;
  while (size < n) size *= 2;
  return size;
}

function encodePayload(payload: NotePayload): Uint8Array {
  const json = JSON.stringify({
    ...(payload.title === undefined ? {} : { title: payload.title }),
    body: payload.body,
    format: payload.format,
  });
  return utf8Encoder.encode(json);
}

/** Size in bytes of the encrypted blob for this payload, before base64url. */
export function noteBlobSize(payload: NotePayload): number {
  return (
    paddedSize(LENGTH_PREFIX_BYTES + encodePayload(payload).byteLength) + NOTE_BLOB_OVERHEAD_BYTES
  );
}

function pad(content: Uint8Array): Uint8Array {
  const out = new Uint8Array(paddedSize(LENGTH_PREFIX_BYTES + content.byteLength));
  new DataView(out.buffer).setUint32(0, content.byteLength);
  out.set(content, LENGTH_PREFIX_BYTES);
  return out;
}

function unpad(padded: Uint8Array): Uint8Array {
  if (padded.byteLength < LENGTH_PREFIX_BYTES) throw new DecryptionError();
  const length = new DataView(padded.buffer, padded.byteOffset).getUint32(0);
  if (length > padded.byteLength - LENGTH_PREFIX_BYTES) throw new DecryptionError();
  return padded.subarray(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + length);
}

function parsePayload(bytes: Uint8Array): NotePayload {
  let value: unknown;
  try {
    value = JSON.parse(utf8Decoder.decode(bytes));
  } catch {
    throw new DecryptionError();
  }
  if (typeof value !== 'object' || value === null) throw new DecryptionError();
  const { title, body, format } = value as Record<string, unknown>;
  if (typeof body !== 'string' || (format !== 'text' && format !== 'markdown')) {
    throw new DecryptionError();
  }
  if (title !== undefined && typeof title !== 'string') throw new DecryptionError();
  return { body, format, ...(title === undefined ? {} : { title }) };
}

/**
 * Encrypts with an explicit IV. Only for known-answer tests: callers must use `encryptNote`, which
 * draws a fresh random IV. Reusing an IV under the same key breaks AES-GCM.
 */
export async function encryptNoteWithIv(
  payload: NotePayload,
  secret: string,
  iv: Uint8Array,
): Promise<string> {
  const secretBytes = parseSecret(secret);
  if (secretBytes === null) throw new Error('invalid secret');
  if (iv.byteLength !== IV_BYTES) throw new Error('invalid iv');
  const key = await deriveAesKey(secretBytes, KEY_PURPOSE.content);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv), additionalData: asBufferSource(NOTE_AAD) },
    key,
    asBufferSource(pad(encodePayload(payload))),
  );
  return toBase64Url(concatBytes(Uint8Array.of(FORMAT_VERSION), iv, new Uint8Array(ciphertext)));
}

/**
 * Encrypts a note under K_content derived from `secret`, with a fresh 96-bit random IV.
 * Returns `base64url(version ‖ iv ‖ ciphertext+tag)`. Title and format are inside the ciphertext.
 * Security assumption: each secret encrypts exactly one note (see ADR 0011).
 */
export function encryptNote(payload: NotePayload, secret: string): Promise<string> {
  return encryptNoteWithIv(payload, secret, crypto.getRandomValues(new Uint8Array(IV_BYTES)));
}

/**
 * Decrypts a note blob. Throws `DecryptionError` for a wrong key, an unknown version, any
 * tampering or a malformed plaintext. Callers must show a generic error and nothing else.
 */
export async function decryptNote(blob: string, secret: string): Promise<NotePayload> {
  const secretBytes = parseSecret(secret);
  if (secretBytes === null) throw new DecryptionError();
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(blob);
  } catch {
    throw new DecryptionError();
  }
  if (bytes.byteLength < NOTE_BLOB_OVERHEAD_BYTES || bytes[0] !== FORMAT_VERSION) {
    throw new DecryptionError();
  }
  const iv = bytes.subarray(1, 1 + IV_BYTES);
  const ciphertext = bytes.subarray(1 + IV_BYTES);
  const key = await deriveAesKey(secretBytes, KEY_PURPOSE.content);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv), additionalData: asBufferSource(NOTE_AAD) },
      key,
      asBufferSource(ciphertext),
    );
  } catch {
    throw new DecryptionError();
  }
  return parsePayload(unpad(new Uint8Array(plaintext)));
}
