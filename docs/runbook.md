# Runbook

## Environments

| Env        | Where                             | Config                                       |
| ---------- | --------------------------------- | -------------------------------------------- |
| dev        | `wrangler dev` (local, port 8787) | `worker/wrangler.jsonc` + `worker/.dev.vars` |
| production | `https://shared.arysetyap.com`    | `worker/wrangler.jsonc` + Wrangler secrets   |

There is no staging (ADR 0007). `workers_dev` and preview URLs are disabled, so production is
reachable only on its custom domain.

## One-time setup

1. Make sure `arysetyap.com` is an active zone in the Cloudflare account.
2. Create the Turnstile widget for hostname `shared.arysetyap.com` (Managed mode). Note the site
   key (public, used by the web app in Phase 1) and the secret key.
3. Set the Worker secrets:
   ```sh
   cd worker
   pnpm exec wrangler login
   pnpm exec wrangler secret put TURNSTILE_SITE_KEY      # public, but kept out of git
   pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
   openssl rand -base64 48 | pnpm exec wrangler secret put IP_HASH_SECRET
   ```
   Optional admin revoke token (see "Abuse report" below). Generate it on your machine, keep the
   token in your password manager, and give the Worker only its hash:
   ```sh
   TOKEN=$(openssl rand 32 | basenc --base64url | tr -d '=')
   echo "$TOKEN"                                   # store this privately
   printf '%s' "$TOKEN" | openssl dgst -sha256 -binary | basenc --base64url | tr -d '=' \
     | pnpm exec wrangler secret put ADMIN_TOKEN_HASH
   ```
   (`basenc` is GNU coreutils; on macOS use `base64 | tr '+/' '-_'`.)
4. Create a Cloudflare API token with the **Edit Cloudflare Workers** template. Scope it to the one
   account and the `arysetyap.com` zone.
5. In GitHub (`coozyme/shared-secure`):
   - Settings → Environments → `production`: add yourself as a required reviewer and restrict
     deployments to `main`.
   - Add environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
   - Branch protection on `main`: require the CI checks and PRs.
6. Abuse mailbox: make sure the address in `apps/web/src/lib/contact.ts` is monitored before
   switching `FEATURE_NOTES` on.
7. Daily request limit: in the Cloudflare dashboard, set the Worker's route to **fail closed** if
   that option is available for custom domains. Verify this and record the result in ADR 0008.

## Deploy

Merge to `main`. The `Deploy` workflow re-runs CI, waits for your approval, deploys with
`wrangler deploy --message <sha>`, and then checks `/api/v1/health`.

Manual deploy, emergencies only:

```sh
pnpm install --frozen-lockfile && pnpm build
cd worker && pnpm exec wrangler deploy --message "manual: <reason>"
```

## Rollback

```sh
cd worker
pnpm exec wrangler deployments list          # find the last good version id
pnpm exec wrangler rollback <version-id> --message "rollback: <reason>"
```

Then revert the bad commit on `main` so the next deploy doesn't bring it back.

## Kill switches (no deploy rollback needed)

Set `FEATURE_NOTES`, `FEATURE_FILES` or `FEATURE_LIVE_NOTES` to `"false"`, either in the dashboard
(Worker → Settings → Variables) or in `wrangler.jsonc` followed by a deploy. Disabled features
return `503 feature_disabled`.

## Secret rotation

| Secret                 | Rotation                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `ADMIN_TOKEN_HASH`     | Generate a new token as in setup step 3 and replace the hash. The old token stops working    |
| `IP_HASH_SECRET`       | `openssl rand -base64 48 \| wrangler secret put IP_HASH_SECRET`. Only resets rate-limit keys |
| `TURNSTILE_SECRET_KEY` | Rotate in the Turnstile dashboard, then `wrangler secret put TURNSTILE_SECRET_KEY`           |
| `CLOUDFLARE_API_TOKEN` | Roll in the Cloudflare dashboard, then update the GitHub environment secret                  |

Encryption keys are per-item and live only in links, so there is nothing server-side to rotate.

## Incidents

1. **Contain:** flip the relevant feature flag off, or roll back.
2. **Assess:** Workers Logs (3-day retention on Free) contain only allowlisted fields: request id,
   route pattern, status, error code. Request URLs aren't logged (invocation logs are disabled).
3. **Abuse report:** the reporter sends the full link. Open it only if needed to confirm (a
   one-time note is consumed by opening). Revoke it with the id from the link path:
   ```sh
   curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://shared.arysetyap.com/api/v1/admin/notes/<id>
   ```
   `204` means the note was deleted; `404` means it's already gone (or the token is wrong).
4. **Suspected code-delivery compromise:** roll back, rotate the API token, audit
   `git log` and the GitHub Actions history, and tell users that links created during the window
   should be considered exposed.

## Free-tier ceilings

See ADR 0008 for verified numbers. When a ceiling is hit, the platform returns errors (Workers
1027, DO operation errors). The web app must show a clear "temporarily unavailable" message, never
a silent failure.
