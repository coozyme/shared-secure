# 0002. Frontend: Svelte 5 + Vite single-page app (no SvelteKit)

- Status: Superseded by 0009 (owner chose SvelteKit for Phase 1, 2026-11-03)
- Date: 2026-11-03

## Context

The spec suggests SvelteKit or Astro with static output, and also requires a CSP with **no inline
scripts** (§6.4). SvelteKit's static output bootstraps the app with an inline `<script>` in each
page, so a strict CSP would need per-page hashes. The app is fully client-side anyway: all
content is encrypted, so there is nothing useful to pre-render.

## Decision

Use **Svelte 5 + Vite** as a plain single-page app.

- One `index.html`, with only external module scripts and stylesheets.
- `build.assetsInlineLimit: 0` (no `data:` URIs) and `modulePreload.polyfill: false` (no inline
  polyfill).
- Client-side routing comes in Phase 1. Viewer links are always opened with a full page load, so
  the per-path CSP from ADR 0005 applies.
- `apps/web/test/build.test.ts` builds the app and fails if the output has inline
  scripts or styles, inline event handlers, external URLs, `eval` or `data:` images.

## Consequences

- CSP stays `script-src 'self'` with no hashes or nonces.
- No SSR or SSG features; none are needed.
- Routing and data loading are written by hand. They are small enough for a two-feature app.
