# 0004. pnpm monorepo and enforced boundaries

- Status: Accepted
- Date: 2026-11-03

## Context

Spec §5: a modular monolith. `notes` and `files` must stay independent, and the Worker must never
be able to import browser crypto, so that the server structurally cannot handle keys.

## Decision

pnpm workspaces: `apps/web`, `worker`, `packages/{crypto,schema,security-headers}`. Workspace
packages export TypeScript source, which Vite and Wrangler (esbuild) bundle directly. There is no
separate package build step.

Enforcement is layered so that one tool failing doesn't remove the guarantee:

1. **Dependency graph:** `worker/package.json` doesn't depend on `@shared/crypto`, so pnpm's
   isolated `node_modules` can't resolve it.
2. **ESLint `no-restricted-imports`** on `worker/**`: blocks `@shared/crypto` and any relative path
   into `packages/crypto`.
3. **eslint-plugin-boundaries** in `worker/src`. Elements are `core` (`src/*.ts`), `shared`
   (`src/shared`) and `module` (`src/modules/<name>`). Modules may import `shared` and `core`
   (env/config) and files inside their own module, nothing else. `shared` may not import modules.
4. **Bundle test** (`worker/test/node/bundle.test.ts`): builds the real Worker bundle with
   `wrangler deploy --dry-run --metafile` and asserts that no input file comes from
   `packages/crypto`.

The spec says modules may import "only `shared/` and `packages/schema`". Allowing `env.ts`
(typed config) as well is a small clarification. `env.ts` lives in `core` per the spec's layout.

## Consequences

Violations fail CI. Boundary rules were checked with deliberate violations (notes → files,
worker → crypto, shared → module), and all three were reported.
