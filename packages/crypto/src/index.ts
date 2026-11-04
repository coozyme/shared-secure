/**
 * Browser-only end-to-end encryption. The Worker must never import this package (ADR 0004).
 * Wire formats and key hierarchy: docs/crypto-spec.md.
 */

/** Marker string the Worker bundle test uses to detect this package leaking into server code. */
export const CRYPTO_PACKAGE_MARKER = '@shared/crypto:browser-only';

export { FORMAT_VERSION } from './format';
export { fromBase64Url, toBase64Url } from './encoding';
export { SECRET_LENGTH, deriveWriteToken, generateSecret, parseSecret } from './keys';
export {
  DecryptionError,
  NOTE_BLOB_OVERHEAD_BYTES,
  decryptNote,
  encryptNote,
  noteBlobSize,
  paddedSize,
  type NotePayload,
} from './note';
export {
  FILE_CHUNK_SIZE_BYTES,
  decryptFileChunk,
  decryptFileHeader,
  encryptFileChunk,
  encryptFileHeader,
  randomId,
  splitIntoChunks,
  type EncryptedFileHeader,
  type FileMetadataPlaintext,
} from './file';
