import {
  FILE_CHUNK_SIZE_BYTES,
  fileCreateResponseSchema,
  fileReadStartResponseSchema,
} from '@shared/schema';
import { exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockSiteverify, restoreSiteverify } from './helpers';

// Draft files module (Phase 2 will replace this suite).
const BASE = 'https://shared.arysetyap.com';
const TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

const request = (path: string, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(new Request(`${BASE}${path}`, init));

beforeEach(() => {
  mockSiteverify(true);
});
afterEach(() => {
  restoreSiteverify();
});

describe('files flow', () => {
  it('uploads one chunk, completes, and enforces download-count limits', async () => {
    const created = await request('/api/v1/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headerCiphertext: 'abc',
        headerIv: 'def',
        noncePrefix: 'abcdefghi',
        ttlSeconds: 300,
        maxDownloads: 1,
        totalChunks: 1,
        totalCipherBytes: 3,
        lastChunkPlainBytes: 3,
        chunkSizeBytes: FILE_CHUNK_SIZE_BYTES,
        turnstileToken: TURNSTILE_TOKEN,
      }),
    });
    expect(created.status).toBe(201);
    const file = fileCreateResponseSchema.parse(await created.json());

    const chunkUploaded = await request(`/api/v1/files/${file.id}/chunks/0`, {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3]),
    });
    expect(chunkUploaded.status).toBe(204);

    const completed = await request(`/api/v1/files/${file.id}/complete`, { method: 'POST' });
    expect(completed.status).toBe(204);

    const started = await request(`/api/v1/files/${file.id}`);
    expect(started.status).toBe(200);
    const start = fileReadStartResponseSchema.parse(await started.json());

    const chunkRead = await request(
      `/api/v1/files/${file.id}/chunks/0?downloadToken=${encodeURIComponent(start.downloadToken)}`,
    );
    expect(chunkRead.status).toBe(200);
    expect(new Uint8Array(await chunkRead.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    const secondStart = await request(`/api/v1/files/${file.id}`);
    expect(secondStart.status).toBe(404);
  });
});
