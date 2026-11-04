# 0003. Host the frontend as Workers Static Assets in the same Worker

- Status: Accepted
- Date: 2026-11-03 (verified against Cloudflare docs dated 2026-10-12 and 2026-09-22)

## Context

The spec needs a single deployable service. Cloudflare now steers new full-stack projects to
Workers with Static Assets rather than Pages. Verified:

- `assets.run_worker_first` accepts route patterns, so the Worker runs only for those paths. Other
  requests are served as assets without invoking the Worker.
- `not_found_handling: "single-page-application"` serves `index.html` for unknown paths.
- Static-asset requests aren't billed as Worker invocations, but `_headers` rules **don't apply to
  responses the Worker generates**.

## Decision

One Worker (`worker/wrangler.jsonc`):

- `assets.directory = ../apps/web/dist`, SPA not-found handling, `run_worker_first: ["/api/*"]`.
- Security headers for assets come from a generated `_headers` file. Headers for API responses
  are set by Hono middleware. Both come from `packages/security-headers` (ADR 0005).
- `workers_dev: false` and `preview_urls: false`, so the app is reachable only at
  `shared.arysetyap.com` (origin isolation).

## Consequences

- Page loads don't count against the free plan's 100k Worker requests per day. Only `/api/*` does.
- Headers come from two mechanisms, so `pnpm test:headers` checks real responses from
  `wrangler dev` for both.
