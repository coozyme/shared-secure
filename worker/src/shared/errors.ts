import type { ErrorCode, ErrorResponse } from '@shared/schema';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Base class for every error that may reach a client. Only `code` and `publicMessage` are ever
 * serialized; `message` and `cause` stay server-side and are not logged verbatim either.
 */
export class AppError extends Error {
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    readonly publicMessage: string,
    options?: { cause?: unknown; headers?: Readonly<Record<string, string>> },
  ) {
    super(publicMessage, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.headers = options?.headers ?? {};
  }
}

export class BadRequestError extends AppError {
  constructor(publicMessage = 'Invalid request', cause?: unknown) {
    super(400, 'bad_request', publicMessage, { cause });
  }
}

/** Also used for "exists but you may not see it" so responses never reveal whether an id existed. */
export class NotFoundError extends AppError {
  constructor() {
    super(404, 'not_found', 'Not found');
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super(413, 'payload_too_large', 'Request body too large');
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super(415, 'unsupported_media_type', 'Unsupported content type');
  }
}

export class RateLimitedError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(429, 'rate_limited', 'Too many requests, try again later', {
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }
}

export class ChallengeFailedError extends AppError {
  constructor() {
    super(403, 'challenge_failed', 'Human verification failed, please retry');
  }
}

export class FeatureDisabledError extends AppError {
  constructor() {
    super(503, 'feature_disabled', 'This feature is temporarily unavailable');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super(503, 'service_unavailable', 'Service temporarily unavailable', { cause });
  }
}

export class InternalError extends AppError {
  constructor(cause?: unknown) {
    super(500, 'internal_error', 'Internal error', { cause });
  }
}

/** Normalizes anything thrown into an AppError. Unknown errors never expose their message. */
export function toAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new InternalError(error);
}

export function errorBody(error: AppError, requestId: string): ErrorResponse {
  return { error: { code: error.code, message: error.publicMessage }, requestId };
}
