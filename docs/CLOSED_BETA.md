# Closed Beta audit and rollout

© 2026 Poolindex. All rights reserved.

Pre-implementation audit of HEAD `1adec459b9` (snapshot `20260919T193714Z`).

## Classification

| Area | Status | Notes |
| --- | --- | --- |
| Authentication | MISSING → added | No accounts existed. HMAC plan cookie only. |
| Users | MISSING → added | File store `var/beta/`, unique IDs. |
| Database | PARTIAL | No SQL DB. Reused file store pattern from watch. |
| Wallets | EXISTS / NEEDS HARDENING | Public `0x` only; now bound to the user record. |
| Scanning | EXISTS | Frozen. Not expanded. |
| Source management | EXISTS | Catalog + six live sources. |
| Watch | EXISTS | Daily catalog remaining-pool digest. |
| Server-side limits | EXISTS | Free/Poolindex Pro in `lib/plan.ts` + API routes. |
| Logging | PARTIAL → added | Security/telemetry/error jsonl. |
| Telemetry | MISSING → added | Scan/source/resource/app events. |
| Error handling | PARTIAL | Resource 503 existed; app error journal added. |
| Crash protection | EXISTS | `lib/resource-guard.ts` kept. |
| Resource guards | EXISTS | Kept; kill switch added on top. |
| Admin | MISSING → added | `/admin` + `/api/admin/*`. |
| Feedback | MISSING → added | Result ratings + admin workflow. |
| Email | MISSING → partial | Outbox file; operator sends mail. |
| Security | PARTIAL → hardened | Sessions, CSRF, rate limits, env checks. |
| Terms / Privacy | MISSING → added | `/terms`, `/privacy`, acceptance stored. |
| Free / Pro | EXISTS | Still server-side; no billing. |
| Backups | EXISTS | Append-only snapshots. Verified before this work. |

## Architecture decision (reuse, no rebuild)

Did not add Postgres, NextAuth, or Stripe. Closed Beta (10–50 users) extends the existing Node crypto HMAC cookie + `var/` file store. Passwords use scrypt. Sessions use HMAC cookies like the existing entitlement cookie.

## Invite the first 10 users

1. Set production env: `POOLINDEX_SESSION_SECRET`, `POOLINDEX_PLAN_SECRET`, `POOLINDEX_ADMIN_EMAILS`, optional `POOLINDEX_PAID_KEYS`.
2. Register the operator email from `POOLINDEX_ADMIN_EMAILS` with a valid invite (`closed-beta-dev` in non-production, or a bootstrap invite).
3. Verify that email, sign in, open `/admin`.
4. Confirm Stage 1 (cap 10). Create 10 invites (optionally bound to tester emails).
5. Send each invite code plus `/register`, `/terms`, and `/privacy`.
6. Confirm each tester can: register, accept Terms/Privacy, verify email, sign in, bind one public address, complete one catalog/GitHub scan, send feedback.
7. Use Stop new scans / Maintenance if the host is unstable. This does not delete accounts or snapshots.
8. After Stage 1 issues are reviewed, set Stage 2 (20) then Stage 3 (50) in Admin.

## Restore

See `docs/RESTORE.md`. Snapshot taken before this work: `/home/ubuntu/poolindex-backups/snapshots/20260919T193714Z` (git `1adec459b9`).
