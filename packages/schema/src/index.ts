import { z } from 'zod';

// Our CSP forbids eval/new Function in browsers and Workers. Without this, Zod probes for its JIT
// fast path with `new Function`, which the browser reports as a CSP violation.
z.config({ jitless: true });

/** 128-bit random value, base64url without padding (22 chars). */
export const ID_BYTES = 16;
export const ID_LENGTH = 22;
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/, 'invalid id');
export type Id = z.infer<typeof idSchema>;

/** 256-bit random token, base64url without padding (43 chars). */
export const TOKEN_BYTES = 32;
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'invalid token');

export const ERROR_CODES = [
  'bad_request',
  'not_found',
  'method_not_allowed',
  'payload_too_large',
  'unsupported_media_type',
  'rate_limited',
  'challenge_failed',
  'feature_disabled',
  'service_unavailable',
  'internal_error',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: errorCodeSchema,
    message: z.string(),
  }),
  requestId: z.string(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

const base64UrlSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, 'invalid base64url')
  .min(1);

/** Bearer token on the admin revoke path. Only its SHA-256 is configured on the server. */
export const adminTokenSchema = tokenSchema;

/**
 * Note blob v1: base64url(version ‖ iv ‖ ciphertext+tag), at least 1 KiB of padded plaintext
 * (docs/crypto-spec.md). The server applies the configured `MAX_NOTE_BYTES` cap on top of this.
 */
export const NOTE_BLOB_MIN_BYTES = 1 + 12 + 1024 + 16;
export const NOTE_BLOB_HARD_MAX_BYTES = 4 * 1024 * 1024;
export const noteBlobSchema = base64UrlSchema
  .min(Math.ceil((NOTE_BLOB_MIN_BYTES * 4) / 3))
  .max(Math.ceil((NOTE_BLOB_HARD_MAX_BYTES * 4) / 3));

/** Decoded byte length of an unpadded base64url string. */
export function base64UrlByteLength(value: string): number {
  return Math.floor((value.length * 3) / 4);
}

const timestampSchema = z.number().int().positive();

export const noteCreateRequestSchema = z.strictObject({
  blob: noteBlobSchema,
  ttlSeconds: z.number().int().positive(),
  burnAfterRead: z.boolean(),
  turnstileToken: z.string().min(1).max(2048),
});
export type NoteCreateRequest = z.infer<typeof noteCreateRequestSchema>;

export const noteCreateResponseSchema = z.strictObject({
  id: idSchema,
  deleteToken: tokenSchema,
  expiresAt: timestampSchema,
});
export type NoteCreateResponse = z.infer<typeof noteCreateResponseSchema>;

/** Non-consuming. Lets the recipient page show an interstitial before anything is burned. */
export const noteStatusResponseSchema = z.strictObject({
  burnAfterRead: z.boolean(),
  expiresAt: timestampSchema,
});
export type NoteStatusResponse = z.infer<typeof noteStatusResponseSchema>;

export const noteOpenResponseSchema = z.strictObject({
  blob: noteBlobSchema,
  burnAfterRead: z.boolean(),
  expiresAt: timestampSchema,
});
export type NoteOpenResponse = z.infer<typeof noteOpenResponseSchema>;

export const noteDeleteRequestSchema = z.strictObject({
  deleteToken: tokenSchema,
});
export type NoteDeleteRequest = z.infer<typeof noteDeleteRequestSchema>;

/** Public, non-secret configuration so the UI never hardcodes limits. */
export const publicConfigSchema = z.strictObject({
  features: z.strictObject({
    notes: z.boolean(),
    files: z.boolean(),
    liveNotes: z.boolean(),
  }),
  notes: z.strictObject({
    ttlOptionsSeconds: z.array(z.number().int().positive()).min(1),
    maxBlobBytes: z.number().int().positive(),
  }),
  files: z.strictObject({
    ttlOptionsSeconds: z.array(z.number().int().positive()).min(1),
    maxBytes: z.number().int().positive(),
  }),
  turnstileSiteKey: z.string(),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const FILE_CHUNK_SIZE_BYTES = 1024 * 1024;

export const fileCreateRequestSchema = z.strictObject({
  id: idSchema.optional(),
  headerCiphertext: base64UrlSchema,
  headerIv: base64UrlSchema,
  noncePrefix: base64UrlSchema,
  ttlSeconds: z.number().int().positive(),
  maxDownloads: z.number().int().min(1).max(100),
  totalChunks: z.number().int().min(1).max(10_000),
  totalCipherBytes: z.number().int().min(1),
  lastChunkPlainBytes: z.number().int().min(0).max(FILE_CHUNK_SIZE_BYTES),
  chunkSizeBytes: z.literal(FILE_CHUNK_SIZE_BYTES),
  turnstileToken: z.string().min(1).max(2048),
});
export type FileCreateRequest = z.infer<typeof fileCreateRequestSchema>;

export const fileCreateResponseSchema = z.strictObject({
  id: idSchema,
  deleteToken: tokenSchema,
  expiresAt: z.number().int().positive(),
  chunkSizeBytes: z.literal(FILE_CHUNK_SIZE_BYTES),
});
export type FileCreateResponse = z.infer<typeof fileCreateResponseSchema>;

export const fileDeleteRequestSchema = z.strictObject({
  deleteToken: tokenSchema,
});
export type FileDeleteRequest = z.infer<typeof fileDeleteRequestSchema>;

export const fileReadStartResponseSchema = z.strictObject({
  headerCiphertext: base64UrlSchema,
  headerIv: base64UrlSchema,
  noncePrefix: base64UrlSchema,
  totalChunks: z.number().int().min(1),
  chunkSizeBytes: z.literal(FILE_CHUNK_SIZE_BYTES),
  lastChunkPlainBytes: z.number().int().min(0).max(FILE_CHUNK_SIZE_BYTES),
  downloadToken: tokenSchema,
});
export type FileReadStartResponse = z.infer<typeof fileReadStartResponseSchema>;
