import {
  NOTE_BLOB_MIN_BYTES,
  errorResponseSchema,
  noteCreateResponseSchema,
  noteOpenResponseSchema,
  noteStatusResponseSchema,
  publicConfigSchema,
} from '@shared/schema';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../../src/env';
import { mockSiteverify, restoreSiteverify } from './helpers';

const BASE = 'https://shared.arysetyap.com';
const BLOB = 'A'.repeat(Math.ceil((NOTE_BLOB_MIN_BYTES * 4) / 3));
const ADMIN_TOKEN = 'a'.repeat(43);
const UNKNOWN_ID = 'AAAAAAAAAAAAAAAAAAAAAA';

const request = (path: string, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(new Request(`${BASE}${path}`, init));

let ipCounter = 0;
/** A distinct client IP per call, so the real RL_CREATE limit (10/min) doesn't trip mid-suite. */
const freshIp = (): string => `198.51.100.${String(++ipCounter % 250)}`;

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': freshIp() },
  body: JSON.stringify(body),
});

async function createNote(overrides: Record<string, unknown> = {}) {
  const response = await request(
    '/api/v1/notes',
    json('POST', {
      blob: BLOB,
      ttlSeconds: 3600,
      burnAfterRead: false,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      ...overrides,
    }),
  );
  expect(response.status).toBe(201);
  return noteCreateResponseSchema.parse(await response.json());
}

const open = (id: string) => request(`/api/v1/notes/${id}/open`, { method: 'POST' });
const notesDo = (env as unknown as Bindings).NOTES_DO;
const stub = (id: string) => notesDo.get(notesDo.idFromName(id));

/** Proves physical deletion: no stored keys and no pending alarm. */
async function isPhysicallyEmpty(id: string): Promise<boolean> {
  return runInDurableObject(stub(id), async (_instance, state) => {
    const keys = await state.storage.list({ limit: 1 });
    return keys.size === 0 && (await state.storage.getAlarm()) === null;
  });
}

async function expectUniformNotFound(response: Response): Promise<void> {
  expect(response.status).toBe(404);
  const body = errorResponseSchema.parse(await response.json());
  expect(body.error).toEqual({ code: 'not_found', message: 'Not found' });
}

beforeEach(() => {
  mockSiteverify(true);
});
afterEach(() => {
  restoreSiteverify();
  vi.useRealTimers();
});

describe('POST /api/v1/notes', () => {
  it('creates a note with a server-generated id and a delete token', async () => {
    const a = await createNote();
    const b = await createNote();
    expect(a.id).not.toBe(b.id);
    expect(a.deleteToken).not.toBe(b.deleteToken);
    expect(a.expiresAt).toBeGreaterThan(Date.now());
  });

  it('stores only the opaque blob, flags, expiry and the delete-token hash', async () => {
    const note = await createNote();
    const stored = await runInDurableObject(stub(note.id), (_i, state) =>
      state.storage.get('note'),
    );
    expect(Object.keys(stored as object).sort()).toEqual([
      'blob',
      'burnAfterRead',
      'deleteTokenHash',
      'expiresAt',
    ]);
    expect(JSON.stringify(stored)).not.toContain(note.deleteToken);
  });

  it.each([
    ['a client-chosen id', { id: UNKNOWN_ID }],
    ['an expiry outside the allowlist', { ttlSeconds: 1234 }],
    ['a blob below the padded minimum', { blob: 'AAAA' }],
    ['a missing Turnstile token', { turnstileToken: '' }],
  ])('rejects %s with 400 before calling Turnstile', async (_name, override) => {
    const siteverify = mockSiteverify(true);
    const response = await request(
      '/api/v1/notes',
      json('POST', {
        blob: BLOB,
        ttlSeconds: 3600,
        burnAfterRead: false,
        turnstileToken: 'token',
        ...override,
      }),
    );
    expect(response.status).toBe(400);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('rejects blobs above MAX_NOTE_BYTES with 413', async () => {
    const response = await request(
      '/api/v1/notes',
      json('POST', {
        blob: 'A'.repeat(Math.ceil((262_174 * 4) / 3) + 4),
        ttlSeconds: 3600,
        burnAfterRead: false,
        turnstileToken: 'token',
      }),
    );
    expect(response.status).toBe(413);
  });

  it('rejects a failed Turnstile challenge with 403', async () => {
    mockSiteverify(false);
    const response = await request(
      '/api/v1/notes',
      json('POST', { blob: BLOB, ttlSeconds: 3600, burnAfterRead: true, turnstileToken: 'bad' }),
    );
    expect(response.status).toBe(403);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe('challenge_failed');
  });

  it('accepts every configured guest expiry, including 7 days', async () => {
    for (const ttlSeconds of [300, 3600, 86400, 604800]) {
      const note = await createNote({ ttlSeconds });
      expect(note.expiresAt - Date.now()).toBeLessThanOrEqual(ttlSeconds * 1000);
      expect(note.expiresAt - Date.now()).toBeGreaterThan(ttlSeconds * 1000 - 60_000);
    }
  });
});

describe('status and open', () => {
  it('status never consumes a burn-after-read note', async () => {
    const note = await createNote({ burnAfterRead: true });
    for (let i = 0; i < 3; i++) {
      const status = await request(`/api/v1/notes/${note.id}/status`);
      expect(status.status).toBe(200);
      expect(noteStatusResponseSchema.parse(await status.json())).toEqual({
        burnAfterRead: true,
        expiresAt: note.expiresAt,
      });
    }
    expect((await open(note.id)).status).toBe(200);
  });

  it('burn-after-read: the first open returns the blob, then the note is physically gone', async () => {
    const note = await createNote({ burnAfterRead: true });
    const first = await open(note.id);
    expect(first.status).toBe(200);
    expect(noteOpenResponseSchema.parse(await first.json())).toEqual({
      blob: BLOB,
      burnAfterRead: true,
      expiresAt: note.expiresAt,
    });
    await expectUniformNotFound(await open(note.id));
    await expectUniformNotFound(await request(`/api/v1/notes/${note.id}/status`));
    expect(await isPhysicallyEmpty(note.id)).toBe(true);
  });

  it('burn-after-read is atomic under 20 concurrent opens', async () => {
    const note = await createNote({ burnAfterRead: true });
    const responses = await Promise.all(Array.from({ length: 20 }, () => open(note.id)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 404)).toHaveLength(19);
    await Promise.all(responses.map((r) => r.body?.cancel() ?? Promise.resolve()));
  });

  it('a regular note can be opened repeatedly until it expires', async () => {
    const note = await createNote({ burnAfterRead: false });
    expect((await open(note.id)).status).toBe(200);
    expect((await open(note.id)).status).toBe(200);
  });

  it('does not expose a consuming GET', async () => {
    const note = await createNote({ burnAfterRead: true });
    expect((await request(`/api/v1/notes/${note.id}`)).status).toBe(404);
    expect((await request(`/api/v1/notes/${note.id}/open`)).status).toBe(404);
    expect((await open(note.id)).status).toBe(200);
  });

  it('answers unknown and malformed ids with the same 404', async () => {
    await expectUniformNotFound(await open(UNKNOWN_ID));
    await expectUniformNotFound(await open('not-an-id'));
    await expectUniformNotFound(await request(`/api/v1/notes/${UNKNOWN_ID}/status`));
  });
});

describe('expiry', () => {
  it('the alarm physically deletes the note', async () => {
    const note = await createNote({ ttlSeconds: 300 });
    expect(await runDurableObjectAlarm(stub(note.id))).toBe(true);
    expect(await isPhysicallyEmpty(note.id)).toBe(true);
    await expectUniformNotFound(await open(note.id));
  });

  it('an expired note is deleted on contact even before the alarm runs', async () => {
    const note = await createNote({ ttlSeconds: 300 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(note.expiresAt);
    await expectUniformNotFound(await request(`/api/v1/notes/${note.id}/status`));
    vi.useRealTimers();
    expect(await isPhysicallyEmpty(note.id)).toBe(true);
  });
});

describe('DELETE /api/v1/notes/:id', () => {
  it('requires the matching delete token and then deletes physically', async () => {
    const note = await createNote();
    await expectUniformNotFound(
      await request(`/api/v1/notes/${note.id}`, json('DELETE', { deleteToken: 'b'.repeat(43) })),
    );
    expect((await open(note.id)).status).toBe(200);

    const deleted = await request(
      `/api/v1/notes/${note.id}`,
      json('DELETE', { deleteToken: note.deleteToken }),
    );
    expect(deleted.status).toBe(204);
    expect(await isPhysicallyEmpty(note.id)).toBe(true);
    await expectUniformNotFound(await open(note.id));
  });

  it('rejects malformed delete tokens', async () => {
    const note = await createNote();
    const response = await request(
      `/api/v1/notes/${note.id}`,
      json('DELETE', { deleteToken: 'short' }),
    );
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/v1/admin/notes/:id', () => {
  const revoke = (id: string, token?: string) =>
    request(`/api/v1/admin/notes/${id}`, {
      method: 'DELETE',
      headers: {
        'CF-Connecting-IP': freshIp(),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
    });

  it('hides the admin path behind a uniform 404 without a valid token', async () => {
    const note = await createNote();
    await expectUniformNotFound(await revoke(note.id));
    await expectUniformNotFound(await revoke(note.id, 'b'.repeat(43)));
    await expectUniformNotFound(await revoke(note.id, 'short'));
    expect((await open(note.id)).status).toBe(200);
  });

  it('revokes with the admin token', async () => {
    const note = await createNote();
    expect((await revoke(note.id, ADMIN_TOKEN)).status).toBe(204);
    expect(await isPhysicallyEmpty(note.id)).toBe(true);
    await expectUniformNotFound(await revoke(note.id, ADMIN_TOKEN));
  });
});

describe('GET /api/v1/config', () => {
  it('publishes limits and the site key, and nothing secret', async () => {
    const response = await request('/api/v1/config');
    expect(response.status).toBe(200);
    const text = await response.text();
    const config = publicConfigSchema.parse(JSON.parse(text));
    expect(config.notes).toEqual({
      ttlOptionsSeconds: [300, 3600, 86400, 604800],
      maxBlobBytes: 262_173,
    });
    expect(config.turnstileSiteKey).toBe('1x00000000000000000000AA');
    expect(text).not.toContain('test-turnstile-secret');
    expect(text).not.toContain('test-ip-hash-secret');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
