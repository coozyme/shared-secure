# AGENTS.md

Instructions for AI coding agents working in this repo.

1. **The spec is authoritative:** read [`docs/spec.md`](docs/spec.md) before any change. If you
   disagree with it, stop and propose an ADR. Don't deviate silently.
2. **Recorded decisions:** [`docs/decisions/`](docs/decisions/) holds the ADRs. Platform limits checked
   against official docs are dated in ADR 0008.
3. **Hard rules:**
   - `worker/` must never import `@shared/crypto`. Lint, a dependency test and a bundle test
     enforce this.
   - `worker/src/modules/notes` and `worker/src/modules/files` must not import each other.
   - Never log URLs, bodies, ids, tokens, keys or ciphertext. Log only through
     `worker/src/shared/logger.ts`.
   - No inline scripts or styles (except SvelteKit's bootstrap, allowed by build-time hash), no
     `eval`, no `{@html}`, no third-party scripts except Turnstile on creation pages.
   - TypeScript strict. No `any` without an explanatory comment.
   - Never claim "100% secure". Say "end-to-end encrypted, zero-knowledge by design".
4. **Before you finish:** `pnpm check` must pass (lint, format, typecheck, test, build, header
   smoke test, Playwright e2e). Use Node ≥ 22.17 (`.nvmrc`).
5. **Process:** work phase by phase (spec §11). Use Conventional Commits, one logical change per
   commit. Update docs and ADRs in the same change.
