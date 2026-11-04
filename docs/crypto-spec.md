# Crypto specification

Status: **Note format v1 is final** (Phase 1, ADR 0011), with known-answer vectors in
`packages/crypto/test/vectors/note-v1.json`. The file stream format is still a **draft** for
Phase 2. Any change to a wire format needs a new version byte and an ADR.

## Principles

- Web Crypto API only (`crypto.getRandomValues`, `crypto.subtle`). No custom primitives.
- Runs only in the browser (`packages/crypto`). The Worker never imports it.
- Every blob carries a format version byte. Current value: `0x01` (`FORMAT_VERSION`).

## Key hierarchy

```
secret S   = 32 random bytes (getRandomValues); lives only in the URL fragment, base64url
salt       = UTF-8("shared/v1/salt")    (fixed; S is uniformly random so a fixed salt is fine)

K_content  = HKDF-SHA-256(S, salt, info = "shared/v1/content",     L = 32) → AES-256-GCM key
K_metadata = HKDF-SHA-256(S, salt, info = "shared/v1/metadata",    L = 32) → AES-256-GCM key
T_write    = HKDF-SHA-256(S, salt, info = "shared/v1/write-token", L = 32) → bearer token (live notes)
```

- Each key has one purpose. Keys are imported as non-extractable `CryptoKey`s.
- **Optional password (Phase 4):** `P = KDF(password, random salt)` (Argon2id via a vetted WASM
  library if one exists; otherwise PBKDF2-SHA-256 with ≥ 600,000 iterations, to be confirmed in an
  ADR). Then `IKM = S ‖ P` replaces `S` as the HKDF input. A wrong password fails AEAD
  verification. The server never checks it.
- **View-only links (Phase 3):** carry `K_content`/`K_metadata` instead of `S`, so `T_write` can't
  be derived. The server stores `SHA-256(T_write)` and only relays updates that present
  `T_write`. Limit: a viewer can still forge ciphertext locally, but the server won't accept or
  relay it.

URL shape: `https://shared.arysetyap.com/n/<id>#<base64url(S)>`. The client removes the fragment
from the address bar with `history.replaceState` after reading it.

## Note blob v1 (Phase 1, implemented)

```
blob    = version(0x01) ‖ iv(12) ‖ AES-256-GCM(K_content, iv, padded, aad)     → base64url, no padding
padded  = u32be(len) ‖ content(len) ‖ 0x00…                                   (zero fill)
content = UTF-8(JSON{title?, body, format: "text" | "markdown"})
size    = smallest power of two ≥ max(1024, 4 + len)
aad     = UTF-8("shared/v1/note") ‖ 0x01
```

- **IV:** 96-bit random per encryption (`crypto.getRandomValues`). Each secret encrypts exactly one
  note, so IV reuse under one key would need a 2^-96 collision within a single message.
- **No id in the AAD** (ADR 0011). The server picks the id after encryption. Moving a blob to
  another id doesn't help an attacker: that id's link carries a different secret, so the
  authentication tag fails.
- **Padding:** the server sees only the size bucket (1 KiB, 2 KiB, 4 KiB, …), not the exact length.
  The server caps the blob with `MAX_NOTE_BYTES`. Default: 256 KiB of padded plaintext plus 29 bytes
  of overhead.
- **Decryption** rejects, with a single `DecryptionError` and no detail: a wrong or malformed key, an
  unknown version, a short blob, any authentication failure, a length prefix past the end, invalid
  UTF-8 (fatal decoder), or JSON that isn't `{title?: string, body: string, format}`.
- **Vectors** are generated with `node:crypto` (HKDF + AES-GCM), independently of the Web Crypto
  code. The test suite checks both directions against them.

### Links

```
share:  https://shared.arysetyap.com/n/<id>#<base64url(S)>              (43-char key)
delete: https://shared.arysetyap.com/n/<id>/delete#<deleteToken>        (43-char token)
```

The delete token is random, issued by the server, and stored only as SHA-256. It sits in a fragment
for the same reason as the key: it never reaches server logs or the `Referer` header.

## File stream (Phase 2 draft), STREAM-style chunked AEAD

```
header     = version(1) ‖ noncePrefix(7) ‖ chunkSize(u32 BE) ‖ AES-GCM(K_metadata, iv, {name, mime, size}, aad_meta)
chunk_i    = AES-256-GCM(K_content, nonce_i, plaintext_i, aad_i)
nonce_i    = noncePrefix(7) ‖ counter_i(u32 BE) ‖ lastFlag(1)        // 12 bytes
aad_i      = UTF-8("shared/v1/file") ‖ version(1) ‖ id(22) ‖ counter_i(u32 BE)
chunkSize  = 1 MiB plaintext (each ciphertext chunk is +16-byte tag)
```

- `lastFlag = 0x01` only on the final chunk, so **truncation** is detected. A missing final chunk
  means no chunk verifies with flag 1.
- `counter` is in both the nonce and the AAD, so **reordering and chunk swaps** fail verification.
- `id` in the AAD stops blobs from being swapped between items.
- An empty file is one final chunk with empty plaintext.
- The client streams chunks and never holds the whole file in memory.

## Tests

Implemented for notes (`packages/crypto/test/note.test.ts`): known-answer vectors, round trip,
single-bit flips in version, IV, ciphertext and tag, truncation and extension, foreign AAD, IV
uniqueness over 2,000 encryptions, wrong and malformed keys, padding buckets, and authenticated but
malformed plaintext.

Still required for files (Phase 2): known-answer vectors, round-trip, single-bit flips in ciphertext/IV/AAD/header, chunk
reorder/duplicate/drop/truncate, IV uniqueness over many encryptions, wrong key/password, and
file sizes of 0 B, 1 B, `chunkSize - 1`, `chunkSize`, `chunkSize + 1`, and the configured
maximum.
