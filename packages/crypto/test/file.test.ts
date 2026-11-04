import { describe, expect, it } from 'vitest';
import {
  FILE_CHUNK_SIZE_BYTES,
  decryptFileChunk,
  decryptFileHeader,
  encryptFileChunk,
  encryptFileHeader,
  fromBase64Url,
  generateSecret as randomSecret,
  splitIntoChunks,
} from '../src/index';

// Draft file format (pre-Phase 2). Phase 2 replaces these with the STREAM-format suite.
const NOTE_ID = 'AAAAAAAAAAAAAAAAAAAAAA';

describe('file header', () => {
  it('roundtrips metadata', async () => {
    const secret = randomSecret();
    const metadata = { name: 'x.txt', mime: 'text/plain', size: 3 };
    const encrypted = await encryptFileHeader(metadata, NOTE_ID, secret);
    expect(fromBase64Url(encrypted.noncePrefix)).toHaveLength(7);
    expect(await decryptFileHeader(encrypted, NOTE_ID, secret)).toEqual(metadata);
  });
});

describe('file chunks', () => {
  it('roundtrips chunk encryption and rejects reorder/truncation/tampering', async () => {
    const secret = randomSecret();
    const { noncePrefix } = await encryptFileHeader(
      { name: 'x.bin', mime: 'application/octet-stream', size: 6 },
      NOTE_ID,
      secret,
    );
    const c0 = await encryptFileChunk(new Uint8Array([1, 2, 3]), {
      id: NOTE_ID,
      secret,
      noncePrefix,
      chunkIndex: 0,
      lastChunk: false,
    });
    const c1 = await encryptFileChunk(new Uint8Array([4, 5, 6]), {
      id: NOTE_ID,
      secret,
      noncePrefix,
      chunkIndex: 1,
      lastChunk: true,
    });
    expect(
      await decryptFileChunk(c0, {
        id: NOTE_ID,
        secret,
        noncePrefix,
        chunkIndex: 0,
        lastChunk: false,
      }),
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect(
      await decryptFileChunk(c1, {
        id: NOTE_ID,
        secret,
        noncePrefix,
        chunkIndex: 1,
        lastChunk: true,
      }),
    ).toEqual(new Uint8Array([4, 5, 6]));

    await expect(
      decryptFileChunk(c0, { id: NOTE_ID, secret, noncePrefix, chunkIndex: 1, lastChunk: false }),
    ).rejects.toThrow(); // reorder
    await expect(
      decryptFileChunk(c1.subarray(0, c1.byteLength - 1), {
        id: NOTE_ID,
        secret,
        noncePrefix,
        chunkIndex: 1,
        lastChunk: true,
      }),
    ).rejects.toThrow(); // truncation
    const tampered = c1.slice();
    tampered[0]! ^= 1;
    await expect(
      decryptFileChunk(tampered, {
        id: NOTE_ID,
        secret,
        noncePrefix,
        chunkIndex: 1,
        lastChunk: true,
      }),
    ).rejects.toThrow(); // bit flip
  });

  it('splits files at expected boundaries', () => {
    const empty = splitIntoChunks(new Uint8Array());
    expect(empty).toHaveLength(1);
    expect(empty[0]).toEqual(new Uint8Array());

    const one = splitIntoChunks(new Uint8Array([1]));
    expect(one).toHaveLength(1);

    const exact = splitIntoChunks(new Uint8Array(FILE_CHUNK_SIZE_BYTES));
    expect(exact).toHaveLength(1);

    const plusOne = splitIntoChunks(new Uint8Array(FILE_CHUNK_SIZE_BYTES + 1));
    expect(plusOne).toHaveLength(2);
    expect(plusOne[0]).toHaveLength(FILE_CHUNK_SIZE_BYTES);
    expect(plusOne[1]!).toHaveLength(1);
  });
});
