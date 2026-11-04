import { Hono } from 'hono';
import {
  FILE_CHUNK_SIZE_BYTES,
  fileCreateRequestSchema,
  fileCreateResponseSchema,
  fileDeleteRequestSchema,
  fileReadStartResponseSchema,
} from '@shared/schema';
import type { AppEnv } from '../../shared/context';
import { readJsonBody } from '../../shared/body';
import { BadRequestError, NotFoundError, PayloadTooLargeError } from '../../shared/errors';
import { requireFeature } from '../../shared/features';
import { generateId, generateToken, hashToken } from '../../shared/ids';
import { clientIp, rateLimit } from '../../shared/ratelimit';
import { verifyTurnstile } from '../../shared/turnstile';
import { expiresAt, resolveTtlSeconds } from '../../shared/ttl';

/**
 * Shared Files API, mounted at /api/v1/files.
 */
export const filesRoutes = new Hono<AppEnv>();

filesRoutes.use('*', requireFeature('files'));

filesRoutes.post('/', rateLimit('RL_CREATE', 'files:create'), async (c) => {
  const config = c.get('config');
  const body = await readJsonBody(
    c.req.raw,
    fileCreateRequestSchema,
    config.limits.maxJsonBodyBytes,
  );
  await verifyTurnstile({
    token: body.turnstileToken,
    remoteIp: clientIp(c),
    secretKey: config.turnstile.secretKey,
    expectedHostname: config.turnstile.expectedHostname,
    requestId: c.get('requestId'),
  });
  const ttlSeconds = resolveTtlSeconds(body.ttlSeconds, config.limits.guestFileTtlOptionsSeconds);
  const expiresAtMs = expiresAt(Date.now(), ttlSeconds);
  if (body.chunkSizeBytes !== FILE_CHUNK_SIZE_BYTES)
    throw new BadRequestError('Unsupported chunk size');
  if (body.totalChunks > config.limits.maxFileChunks) throw new PayloadTooLargeError();
  if (body.totalCipherBytes > config.limits.maxFileBytesGuest + body.totalChunks * 32) {
    throw new PayloadTooLargeError();
  }

  const deleteToken = generateToken();
  const deleteTokenHash = await hashToken(deleteToken);
  const requestedId = body.id;
  const maxAttempts = requestedId === undefined ? 3 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = requestedId ?? generateId();
    const stub = c.env.FILES_DO.get(c.env.FILES_DO.idFromName(id));
    const createResponse = await stub.fetch('https://files/create', {
      method: 'POST',
      body: JSON.stringify({
        headerCiphertext: body.headerCiphertext,
        headerIv: body.headerIv,
        noncePrefix: body.noncePrefix,
        expiresAt: expiresAtMs,
        deleteTokenHash,
        maxDownloads: body.maxDownloads,
        totalChunks: body.totalChunks,
        totalCipherBytes: body.totalCipherBytes,
        chunkSizeBytes: body.chunkSizeBytes,
        lastChunkPlainBytes: body.lastChunkPlainBytes,
        objectPrefix: `files/${id}/chunks/`,
      }),
    });
    const result = await createResponse.json<{ created: boolean }>();
    if (!result.created && requestedId !== undefined)
      throw new BadRequestError('Id already exists');
    if (!result.created) continue;
    return c.json(
      fileCreateResponseSchema.parse({
        id,
        deleteToken,
        expiresAt: expiresAtMs,
        chunkSizeBytes: FILE_CHUNK_SIZE_BYTES,
      }),
      201,
    );
  }
  throw new Error('id collision');
});

filesRoutes.put('/:id/chunks/:chunkIndex', async (c) => {
  const id = c.req.param('id');
  const chunkIndex = Number(c.req.param('chunkIndex'));
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new NotFoundError();
  const encryptedChunk = await readBinaryBody(c.req.raw, FILE_CHUNK_SIZE_BYTES + 64);
  if (encryptedChunk.byteLength === 0) throw new BadRequestError('Empty chunk');
  const key = chunkKey(id, chunkIndex);
  await c.env.FILES_BUCKET.put(key, encryptedChunk);

  const stub = c.env.FILES_DO.get(c.env.FILES_DO.idFromName(id));
  const response = await stub.fetch('https://files/upload-chunk', {
    method: 'POST',
    body: JSON.stringify({ chunkIndex }),
  });
  const result = await response.json<{ accepted: boolean }>();
  if (!result.accepted) {
    await c.env.FILES_BUCKET.delete(key);
    throw new NotFoundError();
  }
  return c.body(null, 204);
});

filesRoutes.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  const stub = c.env.FILES_DO.get(c.env.FILES_DO.idFromName(id));
  const response = await stub.fetch('https://files/complete', { method: 'POST' });
  const result = await response.json<{ completed: boolean }>();
  if (!result.completed) throw new BadRequestError('Upload incomplete');
  return c.body(null, 204);
});

filesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const downloadToken = generateToken();
  const stub = c.env.FILES_DO.get(c.env.FILES_DO.idFromName(id));
  const response = await stub.fetch('https://files/start-read', {
    method: 'POST',
    body: JSON.stringify({ downloadTokenHash: await hashToken(downloadToken), now: Date.now() }),
  });
  const result = await response.json<
    | { found: false }
    | {
        found: true;
        headerCiphertext: string;
        headerIv: string;
        noncePrefix: string;
        totalChunks: number;
        chunkSizeBytes: number;
        lastChunkPlainBytes: number;
      }
  >();
  if (!result.found) throw new NotFoundError();
  return c.json(
    fileReadStartResponseSchema.parse({
      headerCiphertext: result.headerCiphertext,
      headerIv: result.headerIv,
      noncePrefix: result.noncePrefix,
      totalChunks: result.totalChunks,
      chunkSizeBytes: result.chunkSizeBytes,
      lastChunkPlainBytes: result.lastChunkPlainBytes,
      downloadToken,
    }),
    200,
  );
});

filesRoutes.get('/:id/chunks/:chunkIndex', async (c) => {
  const id = c.req.param('id');
  const chunkIndex = Number(c.req.param('chunkIndex'));
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new NotFoundError();
  const downloadToken = c.req.query('downloadToken');
  if (downloadToken === undefined || downloadToken.length === 0) throw new NotFoundError();
  const stub = c.env.FILES_DO.get(c.env.FILES_DO.idFromName(id));
  const authResponse = await stub.fetch('https://files/authorize-chunk', {
    method: 'POST',
    body: JSON.stringify({ downloadTokenHash: await hashToken(downloadToken), now: Date.now() }),
  });
  const auth = await authResponse.json<{ authorized: boolean }>();
  if (!auth.authorized) throw new NotFoundError();
  const object = await c.env.FILES_BUCKET.get(chunkKey(id, chunkIndex));
  if (object === null) throw new NotFoundError();
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="encrypted.bin"',
      'Cache-Control': 'no-store',
    },
  });
});

filesRoutes.delete('/:id', async (c) => {
  const config = c.get('config');
  const body = await readJsonBody(
    c.req.raw,
    fileDeleteRequestSchema,
    config.limits.maxJsonBodyBytes,
  );
  const id = c.req.param('id');
  const stub = c.env.FILES_DO.get(c.env.FILES_DO.idFromName(id));
  const response = await stub.fetch('https://files/delete', {
    method: 'POST',
    body: JSON.stringify({ deleteTokenHash: await hashToken(body.deleteToken) }),
  });
  const result = await response.json<{ deleted: boolean; totalChunks?: number }>();
  if (!result.deleted || result.totalChunks === undefined) throw new NotFoundError();
  await deleteFileChunks(c.env.FILES_BUCKET, id, result.totalChunks);
  return c.body(null, 204);
});

async function readBinaryBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null && Number(contentLength) > maxBytes) throw new PayloadTooLargeError();
  if (request.body === null) return new Uint8Array();
  const reader = (request.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function chunkKey(id: string, chunkIndex: number): string {
  return `files/${id}/chunks/${String(chunkIndex).padStart(8, '0')}`;
}

async function deleteFileChunks(bucket: R2Bucket, id: string, totalChunks: number): Promise<void> {
  const keys = Array.from({ length: totalChunks }, (_v, index) => chunkKey(id, index));
  await bucket.delete(keys);
}
