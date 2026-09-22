# PoolIndex Closed Beta readiness report

© 2026 Lior Elbaz, Israel. All rights reserved.

Date: 2026-09-19. App version: 0.1.0. Branch: `cursor/closed-beta-release-415b`.

Pre-implementation snapshot: `20260919T193714Z` (git `1adec459b9`, tree SHA-256 `ca1f2020bf19709870083003916cf9b1913b4284ea2dd12647368f7ed58b66cb`). Verified with `scripts/dual-machine/verify.sh --all`.

## 1. What existed before this project

Next.js PoolIndex with catalog, live sources, safety filters, resource guard, dual-machine snapshots, PoolIndex Pro server-side caps, HMAC entitlement cookie, and daily catalog watch. No user accounts, admin, Terms/Privacy, telemetry, or human feedback.

## 2. What was added

Invite-only accounts (scrypt passwords, HMAC sessions, email verification via operator outbox, password reset), CSRF and login/register rate limits, env validation, `/admin` control center, kill switch, scan telemetry, result feedback workflow, Beta stage caps 10/20/50, Terms and Privacy pages with stored acceptance, copyright/IP docs. Discovery source list was not expanded. No billing. No private-key collection.

## 3. Authentication status

Implemented and tested: register with invite, Terms/Privacy checkboxes, email verify, login, logout, password reset, 7-day signed HTTP-only cookies, expired cookie rejection, invalid credentials, disabled/suspended lockout. Unique user IDs. Dev invite `closed-beta-dev` is non-production only. Production bootstrap: `POOLINDEX_BOOTSTRAP_INVITE`.

## 4. Security status

- Public addresses only. Seed phrases and private-key-shaped input are rejected (unit + API).
- CSRF Origin check on mutating auth/admin/feedback routes.
- Rate limits on register/login/forgot.
- Secrets expected in environment variables. Production refuses missing `POOLINDEX_SESSION_SECRET`, `POOLINDEX_PLAN_SECRET`, `POOLINDEX_ADMIN_EMAILS`.
- Security event log in `var/beta/security.jsonl`.
- Admin role is env-gated, not a UI flag.
- HTTPS: `Secure` cookies when `NODE_ENV=production` or `POOLINDEX_SECURE_COOKIES=1`. Put TLS on the reverse proxy.
- No seed/private-key forms exist in the product.

## 5. Admin/control status

`/admin` + `/api/admin/*`. Counts, health, scan stats, invites, per-user activate/suspend/disable/plan, feedback queue. Kill switch stops new scans and can enable maintenance. Accounts, logs, and snapshots are left intact. Resume restores operation.

## 6. Feedback status

Users can mark Useful / Not Relevant / Broken Link / Potential Scam / Report Problem plus a short note. Admin statuses: NEW / INVESTIGATING / FIXED / CLOSED. Filters: type, user, source, date, version, status. Notes cannot carry seed material.

## 7. Beta management status

Stage 1/2/3 caps 10/20/50. Metrics: invites, registrations, verified, first scan, completed/failed scans, returning users, useful vs broken feedback, errors.

## 8. IP/Copyright status

Footer, README, package description, LICENSE, COPYRIGHT.md, and docs use `© 2026 Lior Elbaz, Israel. All rights reserved.` Rights holder: Lior Elbaz, Israel. Copying, sale, or commercial use without written permission from Lior Elbaz is prohibited. Product architecture: `docs/PRODUCT.md`. Third-party packages: `THIRD_PARTY_NOTICES.md`. Git history kept. No copyright headers added to vendor code. No national identity numbers in source.

## 9. Terms/Privacy status

`/terms` and `/privacy`. Registration stores user ID, Terms version `beta-2026-09-20`, Privacy version `beta-2026-09-20`, timestamp. Terms include ownership by Lior Elbaz (Israel) and state PoolIndex is a research tool and does not guarantee discovery, eligibility, payment, or profit. Privacy states seed phrases and private keys are not collected.

## 10. Free/Pro enforcement status

Still `lib/plan.ts` + API. Logged-in user record is source of truth for plan and wallets. Free: one wallet, catalog, honest named statuses. PoolIndex Pro: 5 wallets, email alerts, Wayback/archive, $20/month or $99/year planned, no payment processor.

## 11. Resource/crash protection status

`lib/resource-guard.ts` unchanged in policy: one heavy job, 503 + Retry-After, no retry loops. Kill switch is an extra operational pause on top. Catalog watch remains light/sequential.

## 12. Tests completed

- `npm test`: 30 unit tests + backup script tests, all passed.
- Live API checks (`closed_beta_api_tests.log`): unauthenticated 401, discover→login, CSRF, invalid invite, seed password rejected, admin vs user, wallet isolation, feedback isolation, wallet limit 402, kill switch 503, free source cap, suspend revokes access, Terms/Privacy copy.
- Browser: tester login, Useful feedback on Uniswap catalog entry, admin Stop new scans and Resume.

## 13. Known issues

- Email uses a mail-provider interface. Default fallback is the on-disk outbox (`var/beta/outbox.jsonl`). Production can select Resend via env (`POOLINDEX_MAIL_PROVIDER=resend`, `RESEND_API_KEY` in gitignored `.env`). No vendor credentials are hard-coded.
- Rate limits and sessions are single-process (this host). Restart clears in-memory rate buckets; sessions persist in `var/beta/state.json`.
- No payment processing (intentional).
- `Content-Security-Policy` uses `frame-ancestors *` only in development (Cursor preview). Production sets `frame-ancestors 'none'`.

## 14. Remaining risks

- File store is not multi-node.
- Operator must keep `var/beta/` inside snapshot restores or testers re-register.
- TLS is the proxy’s job.
- First 10 testers should stay on Stage 1 until scan failures and feedback are reviewed.

## 15. Exact steps to invite the first 10 users

1. On poolindexserver, set `POOLINDEX_SESSION_SECRET`, `POOLINDEX_PLAN_SECRET`, `POOLINDEX_ADMIN_EMAILS`, `POOLINDEX_BOOTSTRAP_INVITE`. Optional: `POOLINDEX_PAID_KEYS`.
2. Take a fresh snapshot: `npm run backup:snapshot -- --with-git`.
3. Register the operator email with the bootstrap invite, verify via outbox, sign in, open `/admin`.
4. Confirm Stage 1 (cap 10). Create 10 invites (bind email when you can).
5. Send each person: invite code, `/register`, `/terms`, `/privacy`. Tell them PoolIndex never wants a seed phrase.
6. Confirm each person: register, accept both documents, verify email, sign in, bind one public `0x` address, finish one catalog/GitHub scan, send feedback.
7. Use Stop new scans if the host is unstable. That does not delete data.
8. After review, Admin → Stage 2 (20), later Stage 3 (50).
