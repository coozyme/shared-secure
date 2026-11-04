import { NOTE_BLOB_HARD_MAX_BYTES, NOTE_BLOB_MIN_BYTES } from '@shared/schema';
import { z } from 'zod';
import type { NoteItemDurableObject } from './modules/notes/do';
import { ServiceUnavailableError } from './shared/errors';
import { log } from './shared/logger';

/** Raw bindings as provided by the runtime. Everything except bindings objects is an unparsed string. */
export interface Bindings {
  readonly ASSETS: Fetcher;
  readonly NOTES_DO: DurableObjectNamespace<NoteItemDurableObject>;
  readonly FILES_DO: DurableObjectNamespace;
  readonly FILES_BUCKET: R2Bucket;
  readonly RL_READ: RateLimit;
  readonly RL_CREATE: RateLimit;
  readonly ENVIRONMENT?: string;
  readonly FEATURE_NOTES?: string;
  readonly FEATURE_FILES?: string;
  readonly FEATURE_LIVE_NOTES?: string;
  readonly MAX_JSON_BODY_BYTES?: string;
  readonly MAX_FILE_BYTES_GUEST?: string;
  readonly MAX_FILE_CHUNKS?: string;
  readonly MAX_NOTE_BYTES?: string;
  readonly GUEST_NOTE_TTL_OPTIONS_SECONDS?: string;
  readonly GUEST_FILE_TTL_OPTIONS_SECONDS?: string;
  readonly TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_EXPECTED_HOSTNAME?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly IP_HASH_SECRET?: string;
  /** SHA-256 (base64url) of the admin revoke token. Empty or unset disables the admin path. */
  readonly ADMIN_TOKEN_HASH?: string;
}

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;

const ttlList = z.string().transform((value, ctx) => {
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (
    parts.length === 0 ||
    parts.some((n) => !Number.isInteger(n) || n < 60 || n > MAX_TTL_SECONDS)
  ) {
    ctx.addIssue({ code: 'custom', message: 'expected comma-separated TTLs in seconds' });
    return z.NEVER;
  }
  return [...new Set(parts)].sort((a, b) => a - b);
});

const configSchema = z
  .object({
    ENVIRONMENT: z.enum(['development', 'production']),
    FEATURE_NOTES: flag,
    FEATURE_FILES: flag,
    FEATURE_LIVE_NOTES: flag,
    MAX_JSON_BODY_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(10 * 1024 * 1024),
    MAX_FILE_BYTES_GUEST: z.coerce
      .number()
      .int()
      .min(1)
      .max(100 * 1024 * 1024),
    MAX_FILE_CHUNKS: z.coerce.number().int().min(1).max(10_000),
    // Encrypted note blob cap in bytes: padded plaintext bucket + 29 bytes of format overhead.
    MAX_NOTE_BYTES: z.coerce.number().int().min(NOTE_BLOB_MIN_BYTES).max(NOTE_BLOB_HARD_MAX_BYTES),
    GUEST_NOTE_TTL_OPTIONS_SECONDS: ttlList,
    GUEST_FILE_TTL_OPTIONS_SECONDS: ttlList,
    TURNSTILE_SITE_KEY: z.string().min(1),
    TURNSTILE_EXPECTED_HOSTNAME: z.string().default(''),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    IP_HASH_SECRET: z.string().min(32),
    ADMIN_TOKEN_HASH: z
      .string()
      .regex(/^([A-Za-z0-9_-]{43})?$/)
      .default(''),
  })
  .transform((raw) => ({
    environment: raw.ENVIRONMENT,
    features: {
      notes: raw.FEATURE_NOTES,
      files: raw.FEATURE_FILES,
      liveNotes: raw.FEATURE_LIVE_NOTES,
    },
    limits: {
      maxJsonBodyBytes: raw.MAX_JSON_BODY_BYTES,
      maxFileBytesGuest: raw.MAX_FILE_BYTES_GUEST,
      maxFileChunks: raw.MAX_FILE_CHUNKS,
      maxNoteBytes: raw.MAX_NOTE_BYTES,
      guestNoteTtlOptionsSeconds: raw.GUEST_NOTE_TTL_OPTIONS_SECONDS,
      guestFileTtlOptionsSeconds: raw.GUEST_FILE_TTL_OPTIONS_SECONDS,
    },
    turnstile: {
      siteKey: raw.TURNSTILE_SITE_KEY,
      secretKey: raw.TURNSTILE_SECRET_KEY,
      expectedHostname: raw.TURNSTILE_EXPECTED_HOSTNAME,
    },
    ipHashSecret: raw.IP_HASH_SECRET,
    adminTokenHash: raw.ADMIN_TOKEN_HASH,
  }));

export type Config = z.output<typeof configSchema>;
export type Feature = keyof Config['features'];

export type ConfigResult = { ok: true; config: Config } | { ok: false; invalidKeys: string[] };

/** Parses bindings. Only key names of invalid entries are reported, never their values. */
export function parseConfig(bindings: Partial<Bindings>): ConfigResult {
  const result = configSchema.safeParse(bindings);
  if (result.success) return { ok: true, config: result.data };
  const invalidKeys = [
    ...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '?'))),
  ];
  return { ok: false, invalidKeys };
}

const cache = new WeakMap<object, Config>();

/** Returns the validated config, failing closed (503) if it is invalid. Cached per env object. */
export function getConfig(bindings: Bindings): Config {
  const cached = cache.get(bindings);
  if (cached) return cached;
  const result = parseConfig(bindings);
  if (!result.ok) {
    log('error', 'config_invalid', { reasons: result.invalidKeys });
    throw new ServiceUnavailableError();
  }
  cache.set(bindings, result.config);
  return result.config;
}
