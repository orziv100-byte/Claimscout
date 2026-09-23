# Claude Code — Phase 1 Slice B/C (run AFTER Cursor Slice A)

Copy everything below the line into Claude Code on `/home/lior/claimscout`, branch `cursor/prelaunch-foundation`.

---

You are implementing **PoolIndex Phase 1 Slice B then C** on the existing branch `cursor/prelaunch-foundation`. Cursor already shipped Slice A on this branch. Do not redo Slice A. Do not merge to `poolindex-beta` or `main`. Do not commit unless Lior asks.

## Already done — do not revert

- Production secrets fail-closed: `assertSafeToStart` / `ProductionEnvError` in `lib/env.ts`, `instrumentation.ts` `process.exit(1)`. Well-known `dev-only-poolindex-*` and `poolindex-pro-demo` are invalid in public runtime.
- `/api/auth/me` no longer returns `inspectEnv()`. `requireUser` 500 no longer lists missing secret names.
- `clientIp`: ignore `X-Real-IP` and `X-Forwarded-For` unless `POOLINDEX_TRUST_PROXY=1`. Do not set TRUST_PROXY in live `.env` until loopback bind is proven.
- **Daily monitor: Free is not full-scanned.** `dailyMonitorAllowed` in `lib/engine/monitor.ts` — paid always; Free only if `user.monitorEnabled === true`. Skip reason `free_plan_no_daily_monitor`. This was S-04 High — keep the behavior, do not turn it back into “prepare rules later”.
- Scan jobs keyed by `userId:address` (`lib/engine/scan-job.ts`). Poll/start pass `authed.user.id`.
- Plan policy file: `config/plans.json`, `lib/plan-config.ts`. Credit principle: server is the only authority. No credit ledger yet.
- Topology documented in `docs/PRELAUNCH_PHASE1.md`. **Do not bind systemd to 127.0.0.1.** That is blocked until Lior verifies `https://poolindex.app/api/health` from a real external network after confirming cloudflared ingress is localhost.
- Backup already taken: snapshot `20260922T184153Z` sha256 `614f06de909a6dea453a4f41c47f9c1ef5e584684af11be4a4ec24443d1ae7f9`. Take a **new** snapshot immediately before SQLite migrate.

## Frozen — never in this work

No Stripe/PayPal/Lemon/Paddle, no webhooks, no real money, no credit purchase/deduct/refund, no EXE, no new chains/adapters/airdrops/Solana/Reddit/Bitcointalk, no auto-claim/signing/custody, no rewrite of wallet engine / auth / SSRF blocklists / VERIFIED-UNCERTAIN-REJECTED. Do not expand Closed Beta live-scan sources. Do not log Pro keys, `POOLINDEX_PLAN_SECRET`, `POOLINDEX_SESSION_SECRET`, or MCP tokens. Do not mint MCP tokens. Do not run `next build` and `next dev` together. Check `free`/load before heavy jobs. 4-core host; skip extra agents if RAM available < ~3 GiB.

Crash/resource: `lib/resource-guard.ts`. Monitor stays sequential. No unbounded `Promise.all`.

## Order

1. New snapshot + copy of `var/beta` and `var/engine` (exclude `.env`). Record timestamp/hash in the completion notes.
2. **SQLite foundation** (highest risk — after backup).
3. Staging docs with **fake** secrets only.
4. Backup/restore drill (non-destructive).
5. Admin TOTP MFA last.
6. `npm audit --omit=dev` (or production) and note actionable vs noise. Do not mass-upgrade Next.

## SQLite

- Add `better-sqlite3` (or `node:sqlite` if Node on this host supports it — check first). WAL mode. Single host. Not Postgres/Redis.
- Schema: users, wallets, sessions, invites, ops, tokens as needed. Keep `user.plan` as source of truth (not entitlement cookie).
- Migrate from `var/beta/state.json` + keep JSON as fallback/read-through until migration is verified.
- Engine scans stay files under `var/engine/wallets/{address}.json` for this slice unless a tiny index table is clearly safer — do not rewrite the scan engine.
- Dual-write or migrate-once with a counted dry-run: user count, wallet count, session count must match JSON.
- If counts mismatch: STOP, do not cut over, leave JSON authoritative.
- Tests: round-trip create user / bind wallet / read plan; migrate fixture JSON → SQLite; crash-safe reopen WAL.

## Staging

- `docs/STAGING.md`: how to run with `NODE_ENV=production` + **fake** long secrets (not the GitHub-known `dev-only-*` strings, not live `.env`). No copy of production secrets.
- Document that public runtime refuses well-known secrets (Slice A already enforces this).

## Restore drill

- Script or documented command: restore snapshot files to a **temp dir**, not live `~/claimscout`. Prove `state.json` (or SQLite) opens and user count matches. Never `restore.sh --replace-live` with an older snapshot.

## Admin MFA

- TOTP (RFC 6238) for `role=admin` only. Enrollment + login challenge. Recovery codes hashed at rest in `var/beta` or SQLite, never logged.
- Do not require MFA for normal Closed Beta users in this slice.
- Tests: valid code accepts, reused/old code rejects, missing MFA blocks admin routes.

## SSRF (optional small)

`fetchSafe` still fetches by hostname after DNS check (TOCTOU). Smallest pin: undici Agent `connect.lookup` returning only the already-allowed IPs + `servername` for TLS. Add a test with a lookup that changes between check and connect if you can fake it. If it risks breaking HTTPS adapters, document and skip — do not rewrite `lib/ssrf.ts` blocklists.

## Tests

Run the existing `npm test` plus new files. Do not start a live wallet scan. Do not rebuild production unless Lior asks.

## Completion report (fill in)

1. Files changed  
2. Behavior that changed vs did not  
3. Backup timestamp + hash used before SQLite  
4. User/wallet counts before vs after migrate  
5. MFA enrollment path  
6. What you did **not** do (bind, payments, credits)  
7. Risks / follow-ups  
8. Commands to verify  

If anything unexpected (lockout, data mismatch, OOM): STOP and report. Do not retry in a loop.
