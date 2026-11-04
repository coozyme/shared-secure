import { apiHeaders } from '@shared/security-headers';
import type { Context, ErrorHandler, MiddlewareHandler, NotFoundHandler } from 'hono';
import { routePath } from 'hono/route';
import { getConfig } from '../env';
import type { AppEnv } from './context';
import { NotFoundError, errorBody, toAppError, type AppError } from './errors';
import { generateRequestId } from './ids';
import { log } from './logger';

const API_HEADERS = Object.entries(apiHeaders());

function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of API_HEADERS) headers.set(name, value);
}

function errorResponse(c: Context<AppEnv>, error: AppError): Response {
  const response = c.json(errorBody(error, c.get('requestId')), error.status);
  for (const [name, value] of Object.entries(error.headers)) response.headers.set(name, value);
  return response;
}

/**
 * Outermost middleware: assigns a request id, applies security headers to every response
 * (including errors) and writes one minimal access-log line using the route pattern only.
 */
export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const startedAt = Date.now();
  c.set('requestId', generateRequestId());
  await next();
  applySecurityHeaders(c.res.headers);
  c.res.headers.set('X-Request-Id', c.get('requestId'));
  log('info', 'request', {
    requestId: c.get('requestId'),
    route: routePath(c, -1),
    method: c.req.method,
    status: c.res.status,
    durationMs: Date.now() - startedAt,
  });
};

export const loadConfig: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('config', getConfig(c.env));
  await next();
};

export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  const error = toAppError(err);
  if (error.code === 'internal_error' || error.code === 'service_unavailable') {
    const cause = error.cause instanceof Error ? error.cause.name : typeof error.cause;
    log('error', 'unhandled_error', {
      requestId: c.get('requestId'),
      route: routePath(c, -1),
      code: error.code,
      errorName: error.cause === undefined ? error.name : cause,
    });
  }
  return errorResponse(c, error);
};

export const handleNotFound: NotFoundHandler<AppEnv> = (c) => errorResponse(c, new NotFoundError());
