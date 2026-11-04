# 0011. Notes API and note format v1

- Status: Accepted (owner decision, 2026-11-03). Amends spec §6.3 (AAD) and §7.1 (API shape).
- Date: 2026-11-03 (Durable Object RPC, `deleteAll` and alarms verified against
  developers.cloudflare.com/durable-objects on 2026-11-03)

## Context

The pre-Phase-1 draft had four problems:

- Clients chose note ids, so `"Id already exists"` told anyone whether an id existed.
- A plain `GET` consumed burn-after-read notes.
- The blob had no version byte.
- Note length leaked exactly.

The spec binds the item id into the AAD, which requires the id before encryption.

## Decision

**Server-generated ids; AAD without id.** The server picks a 128-bit id. Each note has its own
256-bit secret, and every key is used for exactly one item. A ciphertext moved to another id
therefore fails authentication under the other id's key. Binding the id adds nothing and would
need either client-chosen ids or an extra round trip. AAD = `UTF-8("shared/v1/note") ‖ 0x01`.

**Blob:** `version(0x01) ‖ iv(12) ‖ AES-256-GCM(K_content, iv, padded, aad)`, sent as one base64url
string. `padded` = `u32be(len) ‖ UTF-8(JSON{title?, body, format}) ‖ zeros`, sized up to the next
power of two (at least 1 KiB), so ciphertext size reveals only a size bucket.

**API (`/api/v1/notes`):**

| Method and path                  | Purpose                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `POST /`                         | Create. Turnstile + `RL_CREATE`. Returns `{id, deleteToken, expiresAt}`             |
| `GET /:id/status`                | `{burnAfterRead, expiresAt}`. Never consumes anything                               |
| `POST /:id/open`                 | Returns the blob. Burn-after-read is consumed atomically in the DO                  |
| `DELETE /:id`                    | Delete with the delete token (body). Hash compared in constant time                 |
| `DELETE /api/v1/admin/notes/:id` | Abuse revoke. `Authorization: Bearer <ADMIN_TOKEN>`; only its SHA-256 is configured |

Unknown, expired, burned and deleted notes all answer the same `404 not_found`.

`GET /api/v1/config` publishes the guest limits, TTL options, the Turnstile site key and the
feature flags, so the UI never hardcodes limits.

**Durable Object:** typed RPC methods instead of `fetch`. On burn, delete, revoke, expiry
(alarm) and on a read after expiry, the object calls `deleteAll()`. Verified: on SQLite-backed
objects it atomically removes the whole private database. With our compatibility date
(≥ 2026-02-24) it also removes the pending alarm.

**No periodic sweeper for notes.** Durable Objects can't be enumerated without a separate index.
Alarms are retried by the platform, and an expired note is deleted the moment anyone touches it. A
sweeper index would store every note id in one place for little gain. This is recorded as a
residual risk in the threat model.

**Turnstile:** the `dev-turnstile-pass` bypass is removed. Local and e2e environments use
Cloudflare's published test keys.

## Consequences

- One request to create and one to open. Recipients see a status call first (interstitial), and
  only `POST /open` consumes the note.
- File blobs (Phase 2) keep the draft format until that phase's ADR.
