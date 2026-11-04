import { tokenSchema } from '@shared/schema';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './context';
import { NotFoundError } from './errors';
import { hashToken, timingSafeEqual } from './ids';

/**
 * Guards admin-only routes with `Authorization: Bearer <token>`. The server holds only the token's
 * SHA-256 (`ADMIN_TOKEN_HASH`). Every failure, including "admin disabled", answers the same 404
 * so the path isn't discoverable.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = c.get('config').adminTokenHash;
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (expected === '' || !tokenSchema.safeParse(token).success) throw new NotFoundError();
  if (!timingSafeEqual(await hashToken(token), expected)) throw new NotFoundError();
  await next();
};
