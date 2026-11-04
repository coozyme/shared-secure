import { decryptNote } from '@shared/crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createNote,
  draftBlobBytes,
  isValidDeleteToken,
  isValidKey,
  openNote,
} from '../src/lib/services/notes';

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const ID = 'q8XbN2rT0vYw4LmA6sJd1Q';
const DELETE_TOKEN = 'd'.repeat(43);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createNote', () => {
  it('sends only ciphertext; the key exists only in the returned link fragment', async () => {
    const requests: { url: string; body: string }[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: urlOf(input), body: init?.body as string });
      return Promise.resolve(
        Response.json(
          { id: ID, deleteToken: DELETE_TOKEN, expiresAt: 1_900_000_000_000 },
          { status: 201 },
        ),
      );
    });

    const draft = { title: 'Secret title', body: 'Secret body text', format: 'markdown' } as const;
    const created = await createNote(
      draft,
      { ttlSeconds: 3600, burnAfterRead: true },
      'turnstile',
      'https://shared.example',
    );

    expect(requests).toHaveLength(1);
    const sent = requests[0]!;
    expect(sent.url).toBe('/api/v1/notes');
    const shareUrl = new URL(created.shareUrl);
    const key = shareUrl.hash.slice(1);
    expect(shareUrl.pathname).toBe(`/n/${ID}`);
    expect(isValidKey(key)).toBe(true);

    // Nothing sensitive in the request: no plaintext, no title, no key.
    expect(sent.body).not.toContain('Secret');
    expect(sent.body).not.toContain(key);
    const body = JSON.parse(sent.body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'blob',
      'burnAfterRead',
      'ttlSeconds',
      'turnstileToken',
    ]);

    // The uploaded blob decrypts with the key from the link.
    expect(await decryptNote(body['blob'] as string, key)).toEqual(draft);
    expect(created.deleteUrl).toBe(`https://shared.example/n/${ID}/delete#${DELETE_TOKEN}`);
  });

  it('omits a blank title', () => {
    const withBlank = draftBlobBytes({ title: '   ', body: 'x', format: 'text' });
    const without = draftBlobBytes({ title: '', body: 'x', format: 'text' });
    expect(withBlank).toBe(without);
  });
});

describe('openNote', () => {
  it('POSTs to /open and decrypts locally', async () => {
    let created: { blob: string; key: string } | undefined;
    vi.stubGlobal('fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as { blob: string };
      created = { blob: body.blob, key: '' };
      return Promise.resolve(
        Response.json({ id: ID, deleteToken: DELETE_TOKEN, expiresAt: 1 }, { status: 201 }),
      );
    });
    const note = await createNote(
      { title: '', body: 'hi', format: 'text' },
      { ttlSeconds: 300, burnAfterRead: true },
      't',
      'https://x',
    );
    const key = new URL(note.shareUrl).hash.slice(1);

    const calls: { url: string; method: string | undefined }[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: urlOf(input), method: init?.method });
      return Promise.resolve(
        Response.json({ blob: created?.blob, burnAfterRead: true, expiresAt: 5 }),
      );
    });
    const opened = await openNote(ID, key);
    expect(calls).toEqual([{ url: `/api/v1/notes/${ID}/open`, method: 'POST' }]);
    expect(opened).toEqual({
      note: { body: 'hi', format: 'text' },
      burnAfterRead: true,
      expiresAt: 5,
    });
  });
});

describe('link validation', () => {
  it('accepts only well-formed keys and delete tokens', () => {
    expect(isValidKey('A'.repeat(43))).toBe(true);
    expect(isValidKey('A'.repeat(42))).toBe(false);
    expect(isValidKey('')).toBe(false);
    expect(isValidDeleteToken(DELETE_TOKEN)).toBe(true);
    expect(isValidDeleteToken('short')).toBe(false);
  });
});
