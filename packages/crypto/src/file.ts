import { asBufferSource, fromBase64Url, toBase64Url, utf8Encoder } from './encoding';
import { FORMAT_VERSION } from './format';
import { KEY_PURPOSE, deriveAesKey as deriveKey, parseSecret } from './keys';

// Draft file format from before Phase 1. Phase 2 replaces it with the STREAM design in
// docs/crypto-spec.md and its own ADR; until then FEATURE_FILES stays off in production.

const FILE_HEADER_AAD = 'shared/v1/file-header';
const FILE_CHUNK_AAD = 'shared/v1/file-chunk';
export const FILE_CHUNK_SIZE_BYTES = 1024 * 1024;

const GCM_IV_BYTES = 12;
const FILE_NONCE_PREFIX_BYTES = 7;
const FILE_CHUNK_COUNTER_BYTES = 4;
const FILE_NONCE_LAST_FLAG_BYTES = 1;
const FILE_NONCE_BYTES =
  FILE_NONCE_PREFIX_BYTES + FILE_CHUNK_COUNTER_BYTES + FILE_NONCE_LAST_FLAG_BYTES;

const encoder = utf8Encoder;
const decoder = new TextDecoder();

export interface EncryptedFileHeader {
  readonly headerCiphertext: string;
  readonly headerIv: string;
  readonly noncePrefix: string;
}

export interface FileMetadataPlaintext {
  readonly name: string;
  readonly mime: string;
  readonly size: number;
}

/** 128-bit random id. Draft file uploads still choose their id client-side. */
export function randomId(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

function deriveAesKey(
  secret: string,
  purpose: typeof KEY_PURPOSE.content | typeof KEY_PURPOSE.metadata,
): Promise<CryptoKey> {
  const bytes = parseSecret(secret);
  if (bytes === null) throw new Error('invalid secret');
  return deriveKey(bytes, purpose);
}

function buildAad(prefix: string, id: string): Uint8Array {
  return encoder.encode(`${prefix}|v${String(FORMAT_VERSION)}|${id}`);
}

export async function encryptFileHeader(
  metadata: FileMetadataPlaintext,
  id: string,
  secret: string,
): Promise<EncryptedFileHeader> {
  const key = await deriveAesKey(secret, KEY_PURPOSE.metadata);
  const headerIv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const noncePrefix = crypto.getRandomValues(new Uint8Array(FILE_NONCE_PREFIX_BYTES));
  const plaintext = encoder.encode(JSON.stringify(metadata));
  const aad = buildAad(FILE_HEADER_AAD, id);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(headerIv), additionalData: asBufferSource(aad) },
    key,
    asBufferSource(plaintext),
  );
  return {
    headerCiphertext: toBase64Url(new Uint8Array(ciphertext)),
    headerIv: toBase64Url(headerIv),
    noncePrefix: toBase64Url(noncePrefix),
  };
}

export async function decryptFileHeader(
  encrypted: EncryptedFileHeader,
  id: string,
  secret: string,
): Promise<FileMetadataPlaintext> {
  const key = await deriveAesKey(secret, KEY_PURPOSE.metadata);
  const iv = fromBase64Url(encrypted.headerIv);
  if (iv.byteLength !== GCM_IV_BYTES) throw new Error('invalid header iv');
  const ciphertext = fromBase64Url(encrypted.headerCiphertext);
  const aad = buildAad(FILE_HEADER_AAD, id);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv), additionalData: asBufferSource(aad) },
    key,
    asBufferSource(ciphertext),
  );
  const parsed = JSON.parse(decoder.decode(plain)) as Partial<FileMetadataPlaintext>;
  if (
    typeof parsed.name !== 'string' ||
    typeof parsed.mime !== 'string' ||
    typeof parsed.size !== 'number'
  ) {
    throw new Error('invalid file metadata');
  }
  return { name: parsed.name, mime: parsed.mime, size: parsed.size };
}

export async function encryptFileChunk(
  chunkPlaintext: Uint8Array,
  options: {
    readonly id: string;
    readonly secret: string;
    readonly noncePrefix: string;
    readonly chunkIndex: number;
    readonly lastChunk: boolean;
  },
): Promise<Uint8Array> {
  const { id, secret, noncePrefix, chunkIndex, lastChunk } = options;
  const key = await deriveAesKey(secret, KEY_PURPOSE.content);
  const nonce = buildChunkNonce(fromBase64Url(noncePrefix), chunkIndex, lastChunk);
  const aad = buildChunkAad(id, chunkIndex);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(nonce), additionalData: asBufferSource(aad) },
    key,
    asBufferSource(chunkPlaintext),
  );
  return new Uint8Array(encrypted);
}

export async function decryptFileChunk(
  encryptedChunk: Uint8Array,
  options: {
    readonly id: string;
    readonly secret: string;
    readonly noncePrefix: string;
    readonly chunkIndex: number;
    readonly lastChunk: boolean;
  },
): Promise<Uint8Array> {
  const { id, secret, noncePrefix, chunkIndex, lastChunk } = options;
  const key = await deriveAesKey(secret, KEY_PURPOSE.content);
  const nonce = buildChunkNonce(fromBase64Url(noncePrefix), chunkIndex, lastChunk);
  const aad = buildChunkAad(id, chunkIndex);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(nonce), additionalData: asBufferSource(aad) },
    key,
    asBufferSource(encryptedChunk),
  );
  return new Uint8Array(plain);
}

export function splitIntoChunks(
  bytes: Uint8Array,
  chunkSize = FILE_CHUNK_SIZE_BYTES,
): Uint8Array[] {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('invalid chunk size');
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  if (chunks.length === 0) chunks.push(new Uint8Array());
  return chunks;
}

function buildChunkAad(id: string, chunkIndex: number): Uint8Array {
  return encoder.encode(`${FILE_CHUNK_AAD}|v${String(FORMAT_VERSION)}|${id}|${String(chunkIndex)}`);
}

function buildChunkNonce(
  noncePrefix: Uint8Array,
  chunkIndex: number,
  lastChunk: boolean,
): Uint8Array {
  if (noncePrefix.byteLength !== FILE_NONCE_PREFIX_BYTES) throw new Error('invalid nonce prefix');
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xffffffff) {
    throw new Error('invalid chunk index');
  }

  const nonce = new Uint8Array(FILE_NONCE_BYTES);
  nonce.set(noncePrefix, 0);
  const view = new DataView(nonce.buffer);
  view.setUint32(FILE_NONCE_PREFIX_BYTES, chunkIndex);
  nonce[FILE_NONCE_PREFIX_BYTES + FILE_CHUNK_COUNTER_BYTES] = lastChunk ? 1 : 0;
  return nonce;
}
