# 0006. Rate limiting: Workers Rate Limiting binding, keyed by daily-salted IP HMAC

- Status: Accepted
- Date: 2026-11-03 (verified against Cloudflare docs dated 2026-10-21)

## Context

Spec §6.5 requires per-IP, per-endpoint limits and says IPs, if stored at all, must be hashed with a
rotating salt. Verified facts about the Workers Rate Limiting API:

- `simple.period` must be 10 or 60 seconds. Counts are **approximate** and **per Cloudflare
  location**, and can exceed the limit briefly. For strict global limits, Cloudflare recommends a
  Durable Object.
- Cloudflare advises against IP-only keys (NAT/CGNAT) but offers nothing better for anonymous
  guests.

## Decision

- Bindings: `RL_READ` (120/60 s, all `/api/*`) and `RL_CREATE` (10/60 s, creation endpoints from
  Phase 1). Both use unique `namespace_id`s.
- Key: `<scope>:` + base64url(HMAC-SHA-256(`IP_HASH_SECRET`, `YYYY-MM-DD|ip`)[0..16]). Raw IPs are
  never stored or logged, and keys can't be linked across days.
- If the binding throws, return **503 (fail closed)**.
- Turnstile on guest creation (Phase 1) is the main anti-abuse control. Rate limits are a
  backstop against bursts.

## Consequences

- No strict global quota. If abuse needs one (for example a daily guest upload byte budget), add
  a Durable Object counter in Phase 2. That fits the DO design for files anyway.
- Users behind shared IPs share limits.
