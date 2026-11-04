import {
  base64UrlByteLength,
  idSchema,
  noteCreateRequestSchema,
  noteCreateResponseSchema,
  noteDeleteRequestSchema,
  noteOpenResponseSchema,
  noteStatusResponseSchema,
} from '@shared/schema';
import { Hono, type Context } from 'hono';
import { requireAdmin } from '../../shared/admin';
import { readJsonBody } from '../../shared/body';
import type { AppEnv } from '../../shared/context';
import { InternalError, NotFoundError, PayloadTooLargeError } from '../../shared/errors';
import { requireFeature } from '../../shared/features';
import { generateId, generateToken, hashToken } from '../../shared/ids';
import { clientIp, rateLimit } from '../../shared/ratelimit';
import { expiresAt, resolveTtlSeconds } from '../../shared/ttl';
import { verifyTurnstile } from '../../shared/turnstile';

/** Retries only matter for a 128-bit id collision, which is practically impossible. */
const CREATE_ATTEMPTS = 3;

function noteStub(c: Context<AppEnv>, id: string) {
  return c.env.NOTES_DO.get(c.env.NOTES_DO.idFromName(id));
}

/** Malformed ids get the same 404 as unknown ones, before any Durable Object is touched. */
function noteId(c: Context<AppEnv>): string {
  const parsed = idSchema.safeParse(c.req.param('id'));
  if (!parsed.success) throw new NotFoundError();
  return parsed.data;
}

/** Shared Notes API, mounted at /api/v1/notes (ADR 0011). */
export const notesRoutes = new Hono<AppEnv>();

notesRoutes.use('*', requireFeature('notes'));

notesRoutes.post('/', rateLimit('RL_CREATE', 'notes:create'), async (c) => {
  const config = c.get('config');
  const body = await readJsonBody(
    c.req.raw,
    noteCreateRequestSchema,
    config.limits.maxJsonBodyBytes,
  );
  if (base64UrlByteLength(body.blob) > config.limits.maxNoteBytes) throw new PayloadTooLargeError();
  const ttlSeconds = resolveTtlSeconds(body.ttlSeconds, config.limits.guestNoteTtlOptionsSeconds);
  await verifyTurnstile({
    token: body.turnstileToken,
    remoteIp: clientIp(c),
    secretKey: config.turnstile.secretKey,
    expectedHostname: config.turnstile.expectedHostname,
    requestId: c.get('requestId'),
  });

  const deleteToken = generateToken();
  const input = {
    blob: body.blob,
    burnAfterRead: body.burnAfterRead,
    expiresAt: expiresAt(Date.now(), ttlSeconds),
    deleteTokenHash: await hashToken(deleteToken),
  };
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const id = generateId();
    if (await noteStub(c, id).create(input)) {
      return c.json(
        noteCreateResponseSchema.parse({ id, deleteToken, expiresAt: input.expiresAt }),
        201,
      );
    }
  }
  throw new InternalError();
});

notesRoutes.get('/:id/status', async (c) => {
  const status = await noteStub(c, noteId(c)).status(Date.now());
  if (status === null) throw new NotFoundError();
  return c.json(noteStatusResponseSchema.parse(status), 200);
});

/** Consuming read. POST so that prefetchers, crawlers and link previews never trigger it. */
notesRoutes.post('/:id/open', async (c) => {
  const opened = await noteStub(c, noteId(c)).open(Date.now());
  if (opened === null) throw new NotFoundError();
  return c.json(noteOpenResponseSchema.parse(opened), 200);
});

notesRoutes.delete('/:id', async (c) => {
  const id = noteId(c);
  const body = await readJsonBody(
    c.req.raw,
    noteDeleteRequestSchema,
    c.get('config').limits.maxJsonBodyBytes,
  );
  const removed = await noteStub(c, id).remove(await hashToken(body.deleteToken), Date.now());
  if (!removed) throw new NotFoundError();
  return c.body(null, 204);
});

/** Abuse revoke, mounted at /api/v1/admin/notes. */
export const notesAdminRoutes = new Hono<AppEnv>();

notesAdminRoutes.delete('/:id', rateLimit('RL_CREATE', 'admin'), requireAdmin, async (c) => {
  const revoked = await noteStub(c, noteId(c)).revoke(Date.now());
  if (!revoked) throw new NotFoundError();
  return c.body(null, 204);
});
