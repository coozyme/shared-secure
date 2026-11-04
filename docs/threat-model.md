# Threat model

Status: updated for Phase 1 (Shared Notes), 2026-11-04. Update it in the same change as any behavior it describes.

## What we protect

| Asset                                   | Goal                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Note/file plaintext                     | Confidentiality and integrity against everyone without the link        |
| Metadata (title, file name, MIME, size) | Confidentiality: encrypted alongside the content                       |
| Content keys (URL fragment)             | Never reach the server, logs or third parties                          |
| Delete/write tokens                     | Only their holder can delete or edit; the server stores hashes         |
| Service availability and cost           | Abuse can't take it down or cause a bill; free-tier limits fail closed |

What the server legitimately sees: item id, ciphertext size, timestamps, TTL, counters, and
(transiently) the client IP for rate limiting, which is stored only as a daily-salted HMAC inside the rate
limiter.

## Trust boundaries

```
 Browser (trusted for its own user) ──HTTPS──▶ Cloudflare edge ──▶ Worker / Durable Object / R2
   holds key in #fragment                        (untrusted for content: sees ciphertext only)
```

The browser bundle is served by the same origin. That makes **code delivery the main residual
trust point**: a malicious deploy could steal keys. See "Out of scope / residual risk".

## Adversaries and mitigations

| #   | Adversary                                  | Capability                                                  | Mitigations                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Honest-but-curious operator (the owner)    | Reads all storage, logs, dashboards                         | Client-side AES-256-GCM; metadata encrypted; key only in fragment; `worker/` can't import `packages/crypto` (lint + dependency test + bundle test); allowlisted logger; invocation logs (URLs) disabled                                                            |
| 2   | Compromised storage (DO/R2 dump)           | Reads/modifies stored blobs                                 | Ciphertext only; AEAD + AAD binds version/id/chunk index, so swaps and edits are detected; tokens stored as SHA-256 hashes                                                                                                                                         |
| 3   | Network attacker                           | Observes/modifies traffic                                   | HTTPS only; HSTS (2y, preload-ready); `upgrade-insecure-requests`; fragments aren't sent in requests                                                                                                                                                               |
| 4   | Malicious guest (abuse)                    | Floods creation, hosts malware, enumerates ids, DoS         | Rate limits per hashed IP and endpoint; Turnstile on creation; 128-bit random ids; uniform 404; size/TTL caps; executable block for guests; `/report` and admin revoke (Phase 1+); files always downloaded as attachments                                          |
| 5   | XSS on our origin                          | Script runs in our origin and could read fragment keys      | Strict CSP (`default-src 'none'`, `script-src 'self'`, no inline/eval); content rendered as text; Markdown sanitized with no raw HTML or remote images (Phase 1); user files never rendered inline; no third-party scripts except Turnstile on creation pages only |
| 6   | Leaked URLs                                | History, clipboard, referrer, chat apps that prefetch links | `Referrer-Policy: no-referrer`; fragment removed via `history.replaceState`; UI warning; consuming read is `POST /open` behind an explicit click, so link-preview bots and `GET` prefetchers can't burn notes (e2e-tested); `X-Robots-Tag: noindex`                |
| 7   | Malicious/curious recipient                | Holds the link                                              | Out of scope for confidentiality (they can read it by design). Burn-after-read limits re-reads. View-only links can't write (server checks the write token, Phase 3)                                                                                               |
| 8   | Clickjacking / embedding                   | Frames our UI                                               | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, COOP `same-origin`                                                                                                                                                                                              |
| 9   | Parent-domain compromise (`arysetyap.com`) | Sets cookies/scripts on the parent                          | App only on `shared.`; no parent-domain cookies are read or set; host-only cookies; no scripts from the parent; `workers_dev` disabled                                                                                                                             |
| 10  | Cost exhaustion                            | Drives usage past free limits                               | Workers Free fails with errors, not bills; DO free plan fails over limit; R2 _does_ bill past free tier, so app-level storage caps are required (Phase 2, ADR 0008)                                                                                                |

## Phase 1 notes

- **Wrong key burns a one-time note.** The server can't check keys, so a well-formed but wrong key
  still consumes a burn-after-read note, and decryption then fails. The UI rejects malformed or
  truncated keys before any request, so the common case (a link cut short by a chat app) is safe.
- **No sweeper for notes.** Durable Objects can't be enumerated without a central index of ids. An
  expired note is deleted by its alarm (retried by the platform) or the moment anything touches it.
  If an alarm were permanently lost, the ciphertext would stay in storage, unreadable without the
  key and unreachable through the API (ADR 0011).
- **Markdown** is rendered from a closed token model with text interpolation only; there is no
  `{@html}` in the app and a build test enforces it (ADR 0012). Remote images are never loaded.
- **Inline bootstrap scripts** are allowed only by their build-time SHA-256 hashes (ADR 0009). There
  is no `unsafe-inline`, no `unsafe-eval` and no nonce. Every navigation is a full page load, so the
  strict viewer CSP always applies on `/n/*`.
- **Admin revoke** uses a 256-bit bearer token whose SHA-256 is configured as a secret; every
  failure is the same 404 as an unknown path.

## Out of scope / residual risk

- **Compromised endpoint** (malware, malicious extensions) on the sender's or recipient's device.
- **Screenshots, copy/paste or forwarding** by a legitimate recipient.
- **A recipient who leaks the link.** Whoever holds the link holds the key.
- **Malicious code delivery by the operator or a compromised deploy pipeline.** This is inherent to
  web-delivered E2EE. Partial mitigations: pinned and SHA-locked CI actions, manual approval for
  production, lockfile, dependency audit, secret scan. Possible future work: published build hashes
  for reproducible verification.
- **Traffic analysis** (sizes, timing). Ciphertext size reveals approximate plaintext size. Padding
  may be considered in Phase 1.
- **Cloudflare itself** as a platform provider (it terminates TLS and could serve modified code).

## Abuse handling

The operator can't see content. Abuse reports therefore include the link (with key), voluntarily
supplied by the reporter. The operator may then view and revoke the item. The UI and ToS must not
claim that the operator can scan or moderate content proactively.
