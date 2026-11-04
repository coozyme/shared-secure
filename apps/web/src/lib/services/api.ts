import { errorResponseSchema, type ErrorCode } from '@shared/schema';

/** Codes the UI can act on: server error codes plus client-side transport failures. */
export type ApiErrorCode = ErrorCode | 'network' | 'invalid_response';

/** A failed API call. Carries no request or response bodies, so it is safe to show or log. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

interface Parser<T> {
  readonly parse: (value: unknown) => T;
}

export interface RequestOptions<T> {
  readonly method?: 'GET' | 'POST' | 'DELETE';
  readonly body?: unknown;
  readonly schema?: Parser<T>;
  readonly fetcher?: typeof fetch;
}

/**
 * Same-origin JSON request to `/api/v1/*`. Responses are validated with the shared Zod schemas.
 * Never sends credentials or anything from the URL fragment.
 */
export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { method = 'GET', body, schema, fetcher = fetch } = options;
  let response: Response;
  try {
    response = await fetcher(`/api/v1${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiError(0, 'network');
  }

  if (!response.ok) throw new ApiError(response.status, await errorCode(response));
  if (schema === undefined) return undefined as T;
  try {
    return schema.parse(await response.json());
  } catch {
    throw new ApiError(response.status, 'invalid_response');
  }
}

async function errorCode(response: Response): Promise<ApiErrorCode> {
  try {
    return errorResponseSchema.parse(await response.json()).error.code;
  } catch {
    // Platform errors (e.g. the daily request limit) don't use our JSON shape.
    return response.status === 429 ? 'rate_limited' : 'service_unavailable';
  }
}
