# Shared

Share notes and files that are end-to-end encrypted and expire, at
**https://shared.arysetyap.com**.

Encryption happens in your browser. The key lives only in the link's `#fragment`, which browsers
never send to servers. The service is end-to-end encrypted and zero-knowledge by design: the server
stores only ciphertext and the minimum metadata it needs to enforce expiry and limits.

> Status: **Phase 1 (Shared Notes)** built and tested; `FEATURE_NOTES` is still `false` in
> production until it's switched on. Files (Phase 2) and live notes (Phase 3) are not built yet.
> See [`docs/spec.md`](docs/spec.md).

## Layout

| Path                        | What                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `apps/web`                  | SvelteKit (static output) + Tailwind, served as Workers Static Assets |
| `worker`                    | Cloudflare Worker (Hono): `/api/*`, rate limiting, Turnstile          |
| `packages/crypto`           | Browser-only crypto. The Worker must never import it                  |
| `packages/schema`           | Zod schemas shared by the client and the server                       |
| `packages/security-headers` | One source for CSP and security headers (API + `_headers`)            |
| `docs/`                     | Spec, threat model, crypto spec, runbook, ADRs                        |

## Requirements

- Node.js 22.17 or newer (`.nvmrc`). SvelteKit 3, Wrangler 4 and Vitest need it.
- pnpm 10 (`corepack enable`)

## Local development

```sh
pnpm install
cp worker/.dev.vars.example worker/.dev.vars   # Cloudflare's Turnstile test keys
pnpm dev
```

`pnpm dev` builds the web app once, then runs `wrangler dev` on http://localhost:8787 (the
production build with its real headers and CSP, plus the API) and the SvelteKit dev server with hot
reload on http://localhost:5173, which proxies `/api` to the Worker. Rebuild (`pnpm build`) to see
UI changes on port 8787.

The dev server doesn't apply the CSP; `pnpm test:headers` and `pnpm test:e2e` check the real one.

## Checks

```sh
pnpm check   # lint + format + typecheck + test + build + header smoke test + e2e
```

| Command             | What it does                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`         | ESLint, including module boundaries and the Worker/crypto ban                                                          |
| `pnpm typecheck`    | `tsc` / `svelte-check` in strict mode                                                                                  |
| `pnpm build`        | Web build (emits `_headers`) and Worker dry-run bundle                                                                 |
| `pnpm test`         | Unit tests, Worker tests (workerd), bundle-isolation test                                                              |
| `pnpm test:headers` | Starts `wrangler dev` and checks real response headers (run after build)                                               |
| `pnpm test:e2e`     | Playwright journeys (desktop + mobile) against `wrangler dev` (run after build; needs network for Turnstile test keys) |

## Deploying

Production only (ADR 0007): merging to `main` runs CI, then waits for manual approval in the
`production` GitHub environment, then runs `wrangler deploy`. See [`docs/runbook.md`](docs/runbook.md).

## Security

- Read the [threat model](docs/threat-model.md) and the [crypto spec](docs/crypto-spec.md).
- Report vulnerabilities privately to the repository owner. Don't open public issues for them.
