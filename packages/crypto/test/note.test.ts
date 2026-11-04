/// <reference types="node" />
import { createCipheriv, hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CRYPTO_PACKAGE_MARKER,
  DecryptionError,
  FORMAT_VERSION,
  NOTE_BLOB_OVERHEAD_BYTES,
  decryptNote,
  deriveWriteToken,
  encryptNote,
  fromBase64Url,
  generateSecret,
  noteBlobSize,
  paddedSize,
  parseSecret,
  toBase64Url,
  type NotePayload,
} from '../src/index';
import { encryptNoteWithIv } from '../src/note';
import vectorFile from './vectors/note-v1.json';

interface Vector {
  readonly name: string;
  readonly secret: string;
  readonly iv: string;
  readonly payload: NotePayload;
  readonly writeToken: string;
  readonly paddedBytes: number;
  readonly blob: string;
}
const vectors = vectorFile.vectors as Vector[];

const flipBit = (blob: string, byteIndex: number): string => {
  const bytes = fromBase64Url(blob);
  bytes[byteIndex]! ^= 0x01;
  return toBase64Url(bytes);
};

describe('format constants', () => {
  it('pins the version and the package marker', () => {
    expect(FORMAT_VERSION).toBe(1);
    expect(CRYPTO_PACKAGE_MARKER).toContain('@shared/crypto');
  });
});

describe('base64url', () => {
  it('round-trips all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_v, i) => i);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it.each(['abc=', 'a+b/', 'ab cd', 'a'])('rejects non-canonical input %j', (input) => {
    expect(() => fromBase64Url(input)).toThrow();
  });
});

describe('secrets', () => {
  it('generates 256-bit secrets that parse back', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parseSecret(secret)).toHaveLength(32);
  });

  it.each(['', 'short', 'A'.repeat(42), 'A'.repeat(44), '!'.repeat(43)])(
    'rejects malformed secret %#',
    (value) => {
      expect(parseSecret(value)).toBeNull();
    },
  );
});

describe('note format v1 known-answer vectors', () => {
  it.each(vectors)('$name: vector matches an independent node:crypto implementation', (v) => {
    const secret = Buffer.from(fromBase64Url(v.secret));
    const key = Buffer.from(hkdfSync('sha256', secret, 'shared/v1/salt', 'shared/v1/content', 32));
    const json = Buffer.from(JSON.stringify(v.payload));
    const padded = Buffer.alloc(v.paddedBytes);
    padded.writeUInt32BE(json.length, 0);
    json.copy(padded, 4);
    const iv = Buffer.from(fromBase64Url(v.iv));
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.concat([Buffer.from('shared/v1/note'), Buffer.from([1])]));
    const ct = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
    expect(Buffer.concat([Buffer.from([1]), iv, ct]).toString('base64url')).toBe(v.blob);
  });

  it.each(vectors)('$name: encrypts to the vector', async (v) => {
    expect(await encryptNoteWithIv(v.payload, v.secret, fromBase64Url(v.iv))).toBe(v.blob);
  });

  it.each(vectors)('$name: decrypts the vector', async (v) => {
    expect(await decryptNote(v.blob, v.secret)).toEqual(v.payload);
  });

  it.each(vectors)('$name: derives the write token', async (v) => {
    expect(await deriveWriteToken(v.secret)).toBe(v.writeToken);
  });
});

describe('note encryption', () => {
  const payload: NotePayload = { title: 'Title', body: 'Body ✓', format: 'markdown' };

  it('round-trips with and without a title', async () => {
    const secret = generateSecret();
    expect(await decryptNote(await encryptNote(payload, secret), secret)).toEqual(payload);
    const untitled: NotePayload = { body: '', format: 'text' };
    expect(await decryptNote(await encryptNote(untitled, secret), secret)).toEqual(untitled);
  });

  it('fails with a wrong or malformed key', async () => {
    const blob = await encryptNote(payload, generateSecret());
    await expect(decryptNote(blob, generateSecret())).rejects.toBeInstanceOf(DecryptionError);
    await expect(decryptNote(blob, 'not-a-secret')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('detects a flipped bit in the version, IV, ciphertext and tag', async () => {
    const secret = generateSecret();
    const blob = await encryptNote(payload, secret);
    const length = fromBase64Url(blob).byteLength;
    const positions = [0, 1, 12, 13, 14, Math.floor(length / 2), length - 17, length - 1];
    for (const position of positions) {
      await expect(
        decryptNote(flipBit(blob, position), secret),
        `byte ${position}`,
      ).rejects.toBeInstanceOf(DecryptionError);
    }
  });

  it('detects truncation and extension', async () => {
    const secret = generateSecret();
    const bytes = fromBase64Url(await encryptNote(payload, secret));
    for (const cut of [1, 16, bytes.byteLength - NOTE_BLOB_OVERHEAD_BYTES]) {
      await expect(
        decryptNote(toBase64Url(bytes.subarray(0, bytes.byteLength - cut)), secret),
      ).rejects.toBeInstanceOf(DecryptionError);
    }
    const extended = new Uint8Array(bytes.byteLength + 1);
    extended.set(bytes);
    await expect(decryptNote(toBase64Url(extended), secret)).rejects.toBeInstanceOf(
      DecryptionError,
    );
    await expect(decryptNote('', secret)).rejects.toBeInstanceOf(DecryptionError);
    await expect(decryptNote('***', secret)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects blobs bound to different associated data', async () => {
    const v = vectors[0]!;
    const secret = Buffer.from(fromBase64Url(v.secret));
    const key = Buffer.from(hkdfSync('sha256', secret, 'shared/v1/salt', 'shared/v1/content', 32));
    const iv = Buffer.alloc(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('shared/v1/file\x01'));
    const padded = Buffer.alloc(1024);
    const ct = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
    const blob = Buffer.concat([Buffer.from([1]), iv, ct]).toString('base64url');
    await expect(decryptNote(blob, v.secret)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('never repeats an IV across many encryptions', async () => {
    const secret = generateSecret();
    const ivs = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const bytes = fromBase64Url(await encryptNote({ body: 'x', format: 'text' }, secret));
      ivs.add(toBase64Url(bytes.subarray(1, 13)));
    }
    expect(ivs.size).toBe(2000);
  });

  it('hides exact length behind power-of-two buckets', async () => {
    expect(paddedSize(0)).toBe(1024);
    expect(paddedSize(1024)).toBe(1024);
    expect(paddedSize(1025)).toBe(2048);
    expect(paddedSize(70_000)).toBe(131_072);
    const secret = generateSecret();
    const short = await encryptNote({ body: 'a', format: 'text' }, secret);
    const longer = await encryptNote({ body: 'a'.repeat(900), format: 'text' }, secret);
    expect(fromBase64Url(short).byteLength).toBe(fromBase64Url(longer).byteLength);
    expect(fromBase64Url(short).byteLength).toBe(noteBlobSize({ body: 'a', format: 'text' }));
  });

  it('rejects authenticated plaintext that is not a valid note', async () => {
    const v = vectors[0]!;
    const secret = Buffer.from(fromBase64Url(v.secret));
    const key = Buffer.from(hkdfSync('sha256', secret, 'shared/v1/salt', 'shared/v1/content', 32));
    const seal = (content: Buffer, declaredLength = content.length): string => {
      const padded = Buffer.alloc(1024);
      padded.writeUInt32BE(declaredLength, 0);
      content.copy(padded, 4);
      const iv = Buffer.alloc(12, 7);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from('shared/v1/note\x01'));
      const ct = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
      return Buffer.concat([Buffer.from([1]), iv, ct]).toString('base64url');
    };
    const invalid = [
      seal(Buffer.from('{"body":1,"format":"text"}')),
      seal(Buffer.from('{"body":"x","format":"html"}')),
      seal(Buffer.from('{"body":"x","format":"text","title":5}')),
      seal(Buffer.from('null')),
      seal(Buffer.from('not json')),
      seal(Buffer.from([0xff, 0xfe])),
      seal(Buffer.from('{}'), 5000),
    ];
    for (const blob of invalid) {
      await expect(decryptNote(blob, v.secret)).rejects.toBeInstanceOf(DecryptionError);
    }
  });
});
