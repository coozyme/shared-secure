# 0005. Security headers and CSP

- Status: Accepted
- Date: 2026-11-03 (Turnstile CSP requirements verified 2026-11-03)

## Context

Spec §6.4 requires a strict CSP with no inline scripts and no eval, plus the usual hardening
headers. Turnstile must be allowed **only where it's needed**. Turnstile needs
`https://challenges.cloudflare.com` in `script-src` and `frame-src`.

## Decision

`packages/security-headers` is the only definition. The Worker applies `apiHeaders()` to every
`/api/*` response, errors included. The web build emits `_headers` via `renderHeadersFile()`.

**Documents:** `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self';
font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`

- `script-src` also lists the SHA-256 hashes of SvelteKit's inline bootstrap scripts, computed at
  build time (ADR 0009). Never `unsafe-inline`.
- `/*` (creation pages) also allows the Turnstile origin in `script-src` and `frame-src`.
- Viewer paths `/n/*`, `/f/*` and `/l/*` get a **second, strict** CSP. Browsers enforce every CSP
  delivered, so the effective policy there blocks Turnstile and all third parties. (Verified in
  `wrangler dev`: two `Content-Security-Policy` headers are sent.) Viewer pages must always be
  loaded with a full navigation, never a client-side route change from a creation page, so the
  strict policy actually applies.

**API:** `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox`

**All responses:** HSTS `max-age=63072000; includeSubDomains; preload`, `nosniff`,
`Referrer-Policy: no-referrer`, COOP and CORP `same-origin`, `X-Frame-Options: DENY`, a
restrictive `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow, noarchive`,
`Cache-Control: no-store`.

Not adopted yet:

- **COEP:** may break the Turnstile iframe. To revisit.
- **Trusted Types:** needs checking against Svelte 5's DOM APIs. To revisit in Phase 1.
- **Long-lived caching of hashed assets:** `no-store` applies to every path for now because
  `_headers` joins duplicate headers. Small bundle, acceptable cost.

## Consequences

Tests: unit tests in `packages/security-headers`, Worker integration tests for API headers, a
build-output test for inline code, and `pnpm test:headers` against `wrangler dev` for real
static and API responses.
