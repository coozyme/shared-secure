# 0007. Production-only environment (no staging), secrets via Wrangler

- Status: Accepted (approved by owner 2026-11-03; deviates from spec §8 and §10)
- Date: 2026-11-03

## Context

The spec asks for dev, staging and production, with automatic deploys to staging. The owner chose
**not to run staging**. Two Workers can't share the `shared.arysetyap.com` route, and the owner
prefers not to expose a second origin.

## Decision

- Two environments: **dev** (`wrangler dev`, `.dev.vars`, Cloudflare Turnstile test keys) and
  **production** (top-level `wrangler.jsonc`, custom domain only).
- CI runs on every PR. On merge to `main`, the Deploy workflow re-runs CI, then **waits for manual
  approval** in the `production` GitHub environment, then deploys.
- Secrets (`TURNSTILE_SECRET_KEY`, `IP_HASH_SECRET`) only via `wrangler secret put`. CI secrets
  (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) only in the GitHub `production` environment.
- `env.ts` validates every binding at startup and fails closed (503) if any is invalid, reporting
  only key names, never values.
- Risky features sit behind `FEATURE_*` flags (all `false` in production until each phase ships).

## Consequences

- Less safety net: production is the first deployed environment. This is partly offset by
  `wrangler dev` header smoke tests, workerd-based Worker tests, manual approval and
  `wrangler rollback`.
- Adding staging later is cheap: add an `env.staging` block in `wrangler.jsonc` with its own route
  (for example `shared-staging.arysetyap.com`) and separate resources.
