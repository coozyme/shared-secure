# 0008. Free-tier limits (verified)

- Status: Accepted. Re-verify at the start of each phase.
- Verified: 2026-11-03 against developers.cloudflare.com pages last updated 2026-10-18 to
  2026-10-29. Re-verified for Phase 1 on 2026-11-04: Workers limits (2026-10-29), DO pricing
  (2026-10-18) and DO limits (2026-10-29) unchanged; DO value size row added.

| Product               | Limit (Free)                                                                   | Behavior when exceeded                                   | Source page                                           |
| --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------- |
| Workers requests      | 100,000/day (resets 00:00 UTC)                                                 | Error 1027 (fail closed) or bypass (fail open) per route | workers/platform/limits (2026-10-29)                  |
| Workers CPU           | 10 ms per request                                                              | Error 1102                                               | same                                                  |
| Workers memory        | 128 MB per isolate                                                             | Error 1102                                               | same                                                  |
| Subrequests           | 50 per request                                                                 | Error                                                    | same                                                  |
| Request body size     | 100 MB (set by the **zone** plan: Free/Pro)                                    | 413                                                      | same                                                  |
| Worker size           | 64 MiB                                                                         | Deploy fails                                             | same                                                  |
| Static assets         | 20,000 files, 25 MiB each                                                      | Deploy fails                                             | same                                                  |
| Durable Objects       | SQLite backend only; 100k requests/day; 13,000 GB-s/day                        | "Further operations of that type will fail"              | durable-objects/platform/pricing (2026-10-18)         |
| DO SQLite storage     | 5M rows read/day, 100k rows written/day (deletes count as writes), 5 GB total  | Operations fail                                          | same                                                  |
| DO SQLite value size  | Key + value ≤ 2 MB (the 128 KiB limit applies to KV-backed objects only)       | Write throws                                             | durable-objects/platform/limits (2026-10-29)          |
| DO WebSockets         | Incoming messages billed 20:1 as requests; Hibernation avoids duration charges | n/a                                                      | same                                                  |
| R2                    | 10 GB-month storage, 1M Class A, 10M Class B per month; egress free            | **Billed past the free tier (doesn't fail)**             | r2/pricing                                            |
| Turnstile siteverify  | Tokens single-use, valid 300 s, max 2048 chars                                 | `timeout-or-duplicate`                                   | turnstile/get-started/server-side-validation          |
| Rate Limiting binding | period 10 or 60 s; approximate, per location                                   | `success: false`                                         | workers/runtime-apis/bindings/rate-limit (2026-10-21) |

## Implications

- **10 ms CPU** rules out heavy work in the Worker. That's fine: crypto runs in the browser. JSON
  parsing of large bodies must stay bounded (`MAX_JSON_BODY_BYTES`).
- **Files (Phase 2):** 100 MB per request allows chunked uploads through the Worker, but R2
  bills past the free tier. Enforce a global storage budget and per-guest caps in the app, plus
  lifecycle rules, so the service fails closed. The upload design gets its own ADR in Phase 2.
- **Notes (Phase 1):** a note is one KV value in its Durable Object. `MAX_NOTE_BYTES` (256 KiB
  padded plaintext, about 350 KB as base64) stays well under 2 MB. Each note costs roughly one row
  written on create and one on delete; 100k rows written/day is the first Durable Object ceiling a
  burst of guest notes would reach, after the 100k Workers requests/day.
- **Zod:** Cloudflare recommends Zod ≥ 4.5.0 for memory. We use 4.6.7 with `jitless` mode.
- **Fail-closed routing:** confirm in the dashboard that the custom-domain route is set to fail
  closed (runbook, one-time setup).
