import type { ErrorCode } from '@shared/schema';

/**
 * Minimal structured logger. The field set is a closed allowlist so request URLs, bodies, tokens
 * and keys cannot be logged by accident. Free-form strings are redacted before output.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogEvent =
  | 'request'
  | 'unhandled_error'
  | 'config_invalid'
  | 'rate_limited'
  | 'rate_limiter_unavailable'
  | 'turnstile_rejected'
  | 'turnstile_unavailable';

export interface LogFields {
  readonly requestId?: string;
  /** Route pattern such as `/api/v1/notes/:id`, never the concrete URL. */
  readonly route?: string;
  readonly method?: string;
  readonly status?: number;
  readonly durationMs?: number;
  readonly code?: ErrorCode;
  readonly errorName?: string;
  /** Short machine-readable reasons (e.g. config keys or Turnstile error codes). */
  readonly reasons?: readonly string[];
}

const MAX_STRING_LENGTH = 120;
// Anything that looks like an id, token, key or ciphertext. `/` is excluded so paths keep their
// shape and each long segment is redacted on its own.
const SECRET_LIKE = /[A-Za-z0-9+_-]{20,}={0,2}/g;

export function redact(value: string): string {
  const scrubbed = stripLocation(value).replace(SECRET_LIKE, '[redacted]');
  return truncate(scrubbed);
}

function stripLocation(value: string): string {
  return value.replace(/[#?].*$/s, '');
}

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
}

/** For code-defined identifiers (error class names): no secret scrubbing, only shape limits. */
function identifier(value: string): string {
  return truncate(stripLocation(value).replace(/[^A-Za-z0-9_.:-]/g, ''));
}

export function formatLogLine(level: LogLevel, event: LogEvent, fields: LogFields = {}): string {
  const record: Record<string, unknown> = { level, event };
  if (fields.requestId !== undefined) record['requestId'] = fields.requestId;
  if (fields.route !== undefined) record['route'] = redact(fields.route);
  if (fields.method !== undefined) record['method'] = redact(fields.method);
  if (fields.status !== undefined) record['status'] = fields.status;
  if (fields.durationMs !== undefined) record['durationMs'] = fields.durationMs;
  if (fields.code !== undefined) record['code'] = fields.code;
  if (fields.errorName !== undefined) record['errorName'] = identifier(fields.errorName);
  if (fields.reasons !== undefined) record['reasons'] = fields.reasons.slice(0, 10).map(redact);
  return JSON.stringify(record);
}

export function log(level: LogLevel, event: LogEvent, fields?: LogFields): void {
  const line = formatLogLine(level, event, fields);
  // eslint-disable-next-line no-console -- the single sanctioned output point for logs
  console[level](line);
}
