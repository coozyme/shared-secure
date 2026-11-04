# Code Agent Prompt: `shared.arysetyap.com`

### Secure & temporary sharing: Shared Notes and Shared Files

> Usage: paste this whole document as the first message to your code agent (Claude Code, etc.),
> or save it as `CLAUDE.md` / `AGENTS.md` in the repo root so every session follows it.

---

## 1. Role and working style

You are a senior full-stack engineer with a security focus. You build a small, secure, maintainable
product alone for one owner. Optimize for **correctness, security, simplicity, maintainability, and
zero or near-zero running cost**, in that order.

Working agreements:

1. **Plan before coding.** For every phase, first output a short plan (files to create, decisions,
risks) and wait for my confirmation before large changes.
2. **Small, reviewable steps.** One logical change per commit. Conventional Commits
(`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
3. **Never invent facts about platform limits or APIs.** Cloudflare free-tier limits, Workers/Durable
Objects/R2 APIs, and library APIs change often. Check the current official documentation before
relying on them, and record what you verified (with date) in `docs/decisions/`.
4. **Do not silently deviate from this spec.** If you think something here is wrong or outdated,
stop, explain, propose an alternative, and ask.
5. **Do not add dependencies casually.** Every new dependency needs a one-line justification in the
PR/commit message. Prefer platform built-ins (Web Crypto, Fetch, Streams).
6. **Never claim "100% secure".** The honest claim is "end-to-end encrypted, zero-knowledge by
design". Reflect that in all UI copy and docs.
7. Ask at most one focused question at a time when blocked; otherwise make a reasonable assumption,
state it, and continue.

---

## 2. Product summary

A small web tool at **`https://shared.arysetyap.com`** with two features:

Feature
Description

**Shared Notes**
Create an encrypted text note, share a link. Modes: (a) one-time/expiring paste, (b) live multi-user realtime note.

**Shared Files**
Upload an encrypted file, share a link. Temporary, with expiry and optional burn-after-download.

Users:

Guest
Personal (later phase)

Login
none
OAuth/email

Limits
small size, short TTL, strict rate limit
larger size, longer TTL

Extras
none
dashboard, revoke links, extend expiry

### Non-goals (do NOT build)

- Server-side scanning/indexing of user content (impossible by design and out of scope).
- Third-party analytics, ads, or tracking scripts on any page that handles keys.
- Public search, public listing, or discoverability of any note or file.
- Rich-text/WYSIWYG editor in the first versions (plain text and Markdown only).

---

## 3. Hard constraints

- **Cost:** must run on free tiers (Cloudflare) at launch. Design so the free-tier ceiling fails
*closed and gracefully* (clear error), never silently or by billing surprise.
- **Origin isolation:** the app lives only on the `shared.` subdomain. It must not read or set
cookies on the parent domain, and must not load any script from `arysetyap.com` or any third party
(except Cloudflare Turnstile, loaded only on pages that need it).
- **Zero-knowledge:** the server must never receive, log, or be able to derive encryption keys or
plaintext (content, filename, or MIME type).
- **Single deployable service, single repo** (modular monolith), with strict internal module
boundaries so it can be split later without rewrites.
- **TypeScript strict mode** everywhere. No `any` without an explanatory comment.

---

## 4. Recommended stack (verify current docs before committing)

Concern
Choice

Package manager
pnpm workspaces

Language
TypeScript (`strict`, `noUncheckedIndexedAccess`)

Backend
Cloudflare Workers + Hono

Realtime/atomic state
Durable Objects (SQLite-backed, the only kind on the free plan)

File storage
Cloudflare R2

Frontend
SvelteKit or Astro (static output preferred) served as Workers Static Assets or Pages. Check which Cloudflare currently recommends for new projects and write an ADR.

Realtime sync (live notes)
Yjs + CodeMirror 6

Validation
Zod, shared schemas between client and server

Crypto
Web Crypto API only (no home-made primitives)

Password KDF (optional feature)
Argon2id via WASM if a vetted small library exists; otherwise PBKDF2-SHA-256 with a high iteration count, documented

Anti-bot
Cloudflare Turnstile

Tests
Vitest (+ `@cloudflare/vitest-pool-workers` for Worker/DO tests), Playwright for e2e

Lint/format
ESLint (+ `eslint-plugin-boundaries`), Prettier

CI/CD
GitHub Actions

---

## 5. Repository layout

```
shared/
├── apps/
│   └── web/                      # frontend (UI + browser-side crypto usage)
├── worker/
│   ├── src/
│   │   ├── index.ts              # Hono app, global middleware, route mounting
│   │   ├── modules/
│   │   │   ├── notes/            # routes, handlers, NoteRoom DO, tests
│   │   │   └── files/            # routes, handlers, R2 access, tests
│   │   ├── shared/               # ratelimit, turnstile, ttl, errors, logger, ids
│   │   └── env.ts                # typed bindings + config parsing
│   ├── test/
│   └── wrangler.jsonc            # (or .toml) with dev/staging/prod environments
├── packages/
│   ├── crypto/                   # BROWSER-ONLY crypto library (see rules below)
│   └── schema/                   # Zod schemas and shared types
├── docs/
│   ├── threat-model.md
│   ├── decisions/                # ADRs: 0001-xxx.md ...
│   ├── crypto-spec.md            # wire formats, key hierarchy, test vectors
│   └── runbook.md                # deploy, rollback, incident, key/secret rotation
├── .github/workflows/
├── AGENTS.md                     # short pointer to this spec and the rules
└── README.md
```

Boundary rules (enforce with lint, fail CI on violation):

- `modules/notes` and `modules/files` **must not import each other**. They may import only
`shared/` and `packages/schema`.
- `packages/crypto` is used by `apps/web` only. **`worker/` must never import `packages/crypto`.**
This makes it structurally impossible for the server to handle keys.
- `apps/web` talks to the server only through `/api/*` on the same origin (no CORS needed).

---

## 6. Security architecture (the core of the project)

### 6.1 Threat model (write `docs/threat-model.md` first)

Cover at least: honest-but-curious server operator (me), compromised storage, network attacker,
malicious guest (abuse, malware hosting, enumeration, DoS), XSS on our origin, leaked URLs
(history, referrer, clipboard, chat apps that prefetch links), and malicious/curious recipients.
List explicitly what is **out of scope** (compromised endpoint device, screenshots, a recipient who
leaks the link).

### 6.2 Key handling

- Client generates a **256-bit random secret** with `crypto.getRandomValues`.
- The secret lives **only in the URL fragment**: `https://shared.arysetyap.com/n/<id>#<secret>`.
Fragments are never sent to servers.
- Derive purpose-specific keys with **HKDF-SHA-256** from the secret with distinct `info` labels
(e.g. `"shared/v1/content"`, `"shared/v1/metadata"`, `"shared/v1/write-token"`). Never reuse one
key for two purposes.
- Strip or replace the fragment from the address bar after load where possible
(`history.replaceState`), and warn users that browser history/clipboard may store the full link.
- Optional password: derive an additional key via KDF and combine with the secret. A wrong password
must fail at decrypt time (authentication tag), never be checked by the server.

### 6.3 Cipher and formats (document in `docs/crypto-spec.md` with test vectors)

- **AES-256-GCM**, 96-bit IV, unique per encryption. Never reuse an IV with the same key.
- Include a **format version byte** in every blob (`v1`) for future migrations.
- Bind context with **AAD** (e.g. version, item id, chunk index) so blobs cannot be swapped between
items.
- **Metadata is encrypted too**: note title, file name, MIME type, original size live inside an
encrypted header. The server sees only: id, ciphertext size, timestamps, TTL, counters.
- **Files: chunked streaming encryption** (e.g. 1 MiB chunks) using a STREAM-style construction:
per-chunk nonce = random prefix + counter + "last chunk" flag, so **reordering, truncation, and
chunk-swap are detected**. Never load a whole file into memory.
- Decrypt-then-display only after the authentication tag verifies. On failure show a generic error.

### 6.4 Web hardening (apply on day one, test in CI)

- `Content-Security-Policy`: `default-src 'none'` baseline, allow only `'self'` scripts/styles/connect;
**no inline scripts, no `unsafe-eval`**; Turnstile origin allowed only where needed.
`frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`.
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
`Strict-Transport-Security` (preload-ready), `Cross-Origin-Opener-Policy: same-origin`,
`Permissions-Policy` minimal, `Cache-Control: no-store` on all API and note/file pages.
- **Render note content as text by default.** If Markdown is supported, sanitize with a strict
allowlist (DOMPurify or equivalent), no raw HTML, no remote images (they leak the viewer's IP).
- Serve downloaded files with `Content-Disposition: attachment` and a generic content type. Never
render user files inline on our origin.
- Cookies: host-only, `Secure`, `HttpOnly`, `SameSite=Strict`, and no `Domain` attribute.
- Subresource integrity / pinned versions for anything not self-hosted. Prefer self-hosting.

### 6.5 Server-side controls

- IDs: **>= 128-bit random**, base64url, unguessable. Never sequential.
- Ownership/deletion: server returns a **delete token** at creation; store only its **hash**.
Compare in constant time.
- **Burn-after-read / download-count limits must be atomic.** Use a Durable Object per item (or an
equivalent strongly-consistent primitive) so two simultaneous reads cannot both succeed. Do not
use eventually-consistent KV for this.
- **Real deletion:** expiry removes ciphertext from storage (DO storage, R2 object), not just a DB
flag. Use the Durable Object Alarm API and/or R2 lifecycle rules, and add a periodic sweeper as a
safety net. Test that expired items return 404/410 and are physically gone.
- Rate limiting per IP and per endpoint (creation and upload are strict), plus Turnstile on
creation for guests. Hash IPs with a rotating salt if stored at all; keep logs minimal with a
short retention. **Never log URLs with fragments, ciphertext, keys, or tokens.**
- Strict input validation (Zod) with hard caps on body size, TTL, note length, chunk size, and
number of chunks. Reject early.
- Uniform error responses that do not reveal whether an id ever existed.
- Abuse handling: `/report` endpoint (reporter provides the link; no plaintext access is
claimed), an admin-only revoke-by-id path, ToS and Abuse policy pages, and a configurable block
on executable file extensions for guests.

---

## 7. Features and API design

Keep the API small, versioned (`/api/v1/...`), JSON for control plane and binary for data plane.

### 7.1 Shared Notes: Mode A (one-time / expiring paste), Phase 1

- Client encrypts `{title?, body, format: "text"|"markdown"}` and `POST /api/v1/notes` with
`{ciphertext, iv, ttlSeconds, burnAfterRead, turnstileToken}`.
- Response: `{id, deleteToken, expiresAt}`.
- `GET /api/v1/notes/:id` returns ciphertext; if `burnAfterRead`, the consume operation is atomic
and the note is deleted immediately after.
- `DELETE /api/v1/notes/:id` with the delete token.
- TTL options: 5 min, 1 h, 24 h, 7 days (configurable via env; guests capped lower than personal).
- UI shows a **confirmation interstitial** ("This note will self-destruct after viewing. Open?") so
link-preview bots and chat-app prefetchers do not burn the note.

### 7.2 Shared Files, Phase 2

- Flow: client creates a random secret, encrypts metadata, then uploads **encrypted chunks**.
Choose between streaming through the Worker in multiple requests or R2 multipart/presigned
uploads; **verify current request-body size limits and pick the design that fits the free plan**,
document the decision in an ADR.
- Guest limits are env-configurable (start at ~50 MB, 24 h max). Reject over-limit before upload
starts (declared size) and also while streaming (actual bytes).
- Download: stream encrypted chunks to the browser, decrypt chunk-by-chunk, and save with the
File System Access API or a streaming Blob fallback.
- Options: expiry, max downloads (default 1 for guests), manual delete via delete token.
- Orphan cleanup: abandoned/incomplete uploads are purged automatically.

### 7.3 Shared Notes: Mode B (live multi-user), Phase 3

- Yjs document per room, synced through a Durable Object WebSocket relay. Prefer the **WebSocket
Hibernation API** to keep duration costs low.
- **All Yjs updates are encrypted in the client** before being sent. The DO stores and relays only
opaque blobs plus minimal metadata.
- **Edit vs view-only links:** derive a `writeToken` from the secret (HKDF label above). The server
stores only its hash and rejects updates without a valid token. A view-only link carries the
content key but not the write token. Document this in `crypto-spec.md` and state its limits
honestly (a viewer who holds the content key could forge ciphertext locally, but the server will
not accept or relay it).
- Presence (name/color/cursor) is also encrypted or contains no sensitive data.
- Compaction: periodically merge stored updates into a snapshot (encrypted by the client or
re-encrypted by an editing client) to bound storage growth.
- Room TTL and "delete room now". Add a purely ephemeral mode (memory only, no persistence).
- Enforce per-room caps: connection count, message size and rate, total stored bytes.

### 7.4 Later phases

Phase 4: password option and polish. Phase 5: personal accounts and dashboard
(OAuth, host-only cookies, CSRF protection). Do not start phases 4 to 5 until I ask.

---

## 8. Maintainability standards

- **Small functions, explicit types, no hidden global state.** Pure functions for crypto and
validation, with side effects isolated at the edges (route handlers, DO methods).
- **Config in one place:** `env.ts` parses and validates all bindings/vars with Zod at startup;
limits (TTL caps, size caps, rate limits) are config, not magic numbers.
- **Errors:** a typed error hierarchy mapped to HTTP responses in one place. No stack traces or
internals in responses.
- **Structured, minimal logging** with request ids and redaction. No sensitive data, ever.
- **Documentation as code:** update `docs/` in the same PR as the behavior change. Every
non-obvious decision gets an ADR (context, decision, consequences). Public functions in
`packages/crypto` have TSDoc explaining security assumptions.
- **Dependency hygiene:** commit lockfile, enable Dependabot/Renovate, run `pnpm audit` in CI,
keep the dependency list short.
- **Reproducibility:** `pnpm install && pnpm dev` must start everything locally (Wrangler local
mode); document in README. Provide `.dev.vars.example`.
- **Environments:** `dev` (local), `staging`, `production` as separate Wrangler environments with
separate R2 buckets/DO namespaces and secrets. Secrets only via `wrangler secret`; never in git.
- **Feature flags via env** for risky features (live notes, file uploads) so they can be disabled
instantly without a deploy rollback.
- **Observability on the free tier:** health endpoint, basic counters (creations, errors, rate-limit
hits) with no content or identifiers, and an alert path if feasible.

---

## 9. Testing requirements

Layer
Required tests

`packages/crypto`
Known-answer test vectors, round-trip, tamper detection (flip any bit in ciphertext, IV, AAD, chunk order), truncation detection, IV uniqueness, wrong key/password failure, large-file chunking (including empty file and exact chunk-boundary sizes)

Worker modules
Validation failures, size/TTL caps, rate limit, Turnstile failure, delete-token auth, **atomic burn-after-read under concurrent requests**, expiry and physical deletion, uniform 404 behavior

Durable Objects
Alarm-based expiry, concurrent access, WebSocket auth (write token), message-size and rate caps, compaction

Web (Playwright)
Create then open then decrypt for notes and files, burn-after-read interstitial, expired link UX, wrong password, view-only cannot edit, two-browser live editing

Security checks (CI)
Assert response headers (CSP etc.) on key routes, a test that the Worker bundle does not include `packages/crypto`, a test/grep that no log line can include a fragment or key

Coverage is a means, not a goal; **crypto and access-control code needs near-complete branch
coverage.**

---

## 10. CI/CD and quality gates

On every PR (all must pass to merge):

1. `pnpm install --frozen-lockfile`
2. Lint + format check + boundary rules
3. Typecheck (strict)
4. Unit and integration tests (including Worker/DO tests)
5. Build
6. Dependency audit and secret scan
7. Header/CSP assertion tests

On merge to `main`: deploy to **staging** automatically; promote to **production** by manual
approval. Keep a documented rollback (redeploy previous version) in `docs/runbook.md`.

---

## 11. Delivery plan and acceptance criteria

Work strictly phase by phase. After each phase: summarize what was built, what was verified
against docs, open risks, and wait for my go-ahead.

**Phase 0: Foundations**

- Monorepo, tooling, CI, environments, boundary lint rules, security headers, config module,
rate-limit and Turnstile middleware, ID generation, error model.
- Docs: `threat-model.md`, `crypto-spec.md` (draft), ADRs for framework and static-asset hosting.
- Acceptance: CI green; `pnpm dev` works; headers test passes; hello-world deployed to staging at
the subdomain.

**Phase 1: `packages/crypto` + Shared Notes (one-time/expiring)**

- Full crypto library with the test suite above; notes module; UI with TTL, burn-after-read,
interstitial, delete.
- Acceptance: all crypto and note tests pass; manual proof that the server/DB/logs contain no
plaintext, title, or key; expiry physically deletes data.

**Phase 2: Shared Files**

- Chunked encrypted upload/download, limits, expiry, max downloads, orphan cleanup.
- Acceptance: files at 0 B, 1 B, exact-chunk, and limit size round-trip correctly; tampering and
truncation are detected; free-tier request-size constraints verified and documented.

**Phase 3: Live Notes**

- Yjs + DO relay with encrypted updates, write-token edit/view links, presence, compaction, caps.
- Acceptance: two browsers edit concurrently and converge; view-only client's writes are rejected;
server storage contains only opaque data; room expires and is deleted.

---

## 12. Definition of done (every change)

- [ ] Behavior matches this spec, or a deviation is recorded in an ADR I approved
- [ ] Tests added or updated and passing; CI green
- [ ] No new `any`, no `console.log` of sensitive data, no secrets in git
- [ ] Docs and ADRs updated in the same change
- [ ] Security headers and boundary rules still pass
- [ ] Free-tier impact considered (requests, CPU/duration, storage) and noted if it changed

---

## 13. First message to me

Begin by (1) restating your understanding of the goal in five lines or fewer, (2) listing the
assumptions or questions you need resolved (keep it short), (3) proposing the Phase 0 plan with the
exact file tree and the ADRs you intend to write, and (4) stating which Cloudflare documentation
pages you will verify first. **Do not write code until I confirm the Phase 0 plan.**