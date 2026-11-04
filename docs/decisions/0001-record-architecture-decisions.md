# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-11-03

## Context

The spec (`docs/spec.md` §8) requires an ADR for every decision that isn't obvious, and an
approved ADR for any deviation from the spec.

## Decision

Use lightweight ADRs in `docs/decisions/NNNN-title.md` with sections Context, Decision and
Consequences. Number them sequentially and never reuse a number. To supersede an ADR, add a new one
and mark the old one `Superseded by NNNN`. Facts checked against vendor docs carry the date they
were checked.

## Consequences

Decisions are reviewable in PRs next to the code. The overhead is small and paid once per decision.
