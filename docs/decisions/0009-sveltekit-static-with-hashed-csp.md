# 0009. Frontend: SvelteKit (static output) with hashed bootstrap scripts in `_headers`

- Status: Accepted (owner decision, 2026-11-03). Supersedes 0002.
- Date: 2026-11-03 (verified against svelte.dev/docs/kit for SvelteKit 3.1 and
  developers.cloudflare.com/workers/static-assets/redirects, last updated 2026-08-25)

## Context

The owner chose SvelteKit for Phase 1. ADR 0002 rejected it because SvelteKit's static output
starts each page with an inline `<script>`. Verified on 2026-11-03:

- SvelteKit 3 is configured in `vite.config.ts` (`sveltekit({...})`). `svelte.config.js` is no
  longer supported.
- With `csp.mode: 'hash'`, prerendered pages get the hashes in a `<meta http-equiv>` CSP. Meta
  policies ignore `frame-ancestors`, `report-uri` and `sandbox`, so on their own they can't
  replace our header policy.
- `adapter-static` prerenders every route. Pages with `ssr = false` and `prerender = true` are saved
  as empty shells that render on the client.
- Workers Static Assets `_redirects` supports same-site proxying (`/a /b 200`). Only the first
  matching rule applies.

## Decision

- `@sveltejs/kit` + `@sveltejs/adapter-static`, output to `apps/web/dist` (the Worker's asset
  directory, unchanged). Every route is prerendered. There is no server-side rendering at request
  time, so no private content can ever be rendered by the server.
- **CSP stays in HTTP headers** (ADR 0005). A small adapter wrapper runs after `adapter-static`.
  It collects the SHA-256 of every inline `<script>` in the output and writes `_headers` with
  `script-src 'self' 'sha256-…'`. Only these build-time hashes are allowed: no `unsafe-inline`, no
  `unsafe-eval`, no nonces. Inline `<style>` and `style=` attributes are still forbidden, and a
  build test checks this.
- **Viewer pages** (`/n/<id>`, `/n/<id>/delete`; `/f/<id>` from Phase 2) are prerendered client-only
  shells at `/n/_` and `/n/_/delete`. `_redirects` proxies real ids to them, so the URL (and the
  `#key`) stays in the address bar, and the strict viewer CSP still matches on `/n/*`.
- **Every navigation is a full page load** (`data-sveltekit-reload` on `<body>`). Each document
  therefore always gets its own path's CSP, Turnstile can't linger in memory when a viewer page
  opens, and keys in memory are dropped on navigation. Pages are static and small, so this costs
  little.
- Unknown paths: `not_found_handling: "404-page"` serves the generated `404.html` with status 404.
- Theme: a blocking external `/theme-init.js` applies a saved dark preference before first paint.
  It isn't inline, so no extra hash is needed.

## Known CSP report

SvelteKit's route announcer is created with a `style` attribute. The CSP blocks it, which is
harmless: `app.css` hides `#svelte-announcer` the same way, and with full-page navigation there is
nothing to announce. The e2e suite allows exactly this one report (`style-src-attr`) and fails on
any other. We don't add `'unsafe-hashes'` for it.

Zod probes `new Function` unless `z.config({ jitless: true })` runs first. `@shared/schema` sets
it, so the browser never attempts `eval` (an e2e test caught this).

## Consequences

- One more build step: the adapter wrapper. It is covered by `apps/web/test/build.test.ts`, which
  recomputes the hashes and compares them with `_headers`.
- Trusted Types is still not adopted, because SvelteKit and Svelte create DOM from template strings
  internally.
- No client-side routing transitions. This is acceptable for a utility app, and safer.
- Local development: `vite dev` proxies `/api` to `wrangler dev`. CSP is only enforced on the built
  output served by `wrangler dev`, which `pnpm test:headers` and the e2e tests use.
