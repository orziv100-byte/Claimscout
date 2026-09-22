# Phase 1 — sequence, topology, rollback

Backup before this work:

- Snapshot: `/home/lior/poolindex-backups/snapshots/20260922T184153Z`
- SHA-256: `614f06de909a6dea453a4f41c47f9c1ef5e584684af11be4a4ec24443d1ae7f9`
- Git at snapshot: `poolindex-beta` `b368fc188961015f1562b0297169e7397c72db6b`
- Extra data copy: `/home/lior/poolindex-backups/prelaunch-foundation-20260922T184202Z`
- SQLite-prep copy: `/home/lior/poolindex-backups/prelaunch-sqlite-20260922T190414Z`
- Snapshot before SQLite: `/home/lior/poolindex-backups/snapshots/20260922T190405Z`
  SHA-256: `68a3b71498543f26c5b219e81f57494cab125ed32c50e753c1e378e79f8d6f64`

Slice B (2026-09-22): JSON counts matched SQLite (1 user, 8 wallets, 25 sessions, 1 invite, 4 tokens). `var/beta/poolindex.sqlite` created; **reads stay JSON**. Dual-write on later `writeBetaState`. Restore drill extracted snapshot to `/home/lior/poolindex-backups/restores/drill-20260922T190928Z` (live untouched). MFA: TOTP for `role=admin` only (`POST /api/admin/mfa-enroll`, `mfa-confirm`, `mfa-verify`). Staging: `docs/STAGING.md`.

## Execution order (do not reorder)

Branch: `cursor/prelaunch-foundation`

## Execution order (do not reorder)

1. Secrets + IP hardening (this slice). Cheap. No data migration.
2. SQLite + migrate users/wallets. After another verified backup. Highest risk.
3. MFA, restore drill, alerting last.

Do not start payments, credits, webhooks, EXE, new chains, or live-scan source expansion.

## Topology (S-01) — loopback bind applied 2026-09-22

- `cloudflared` origin is `http://localhost:43147` (dials `127.0.0.1:43147`).
- Public `https://poolindex.app/api/health` returned 200 before bind.
- systemd now: `next start --hostname 127.0.0.1 --port 43147` plus `POOLINDEX_TRUST_PROXY=1`.
- SSH remains on `:22`. Rollback: restore ExecStart hostname to `0.0.0.0` and drop TRUST_PROXY, `daemon-reload`, restart.

## Dual-write gate (before any real money)

JSON `state.json` stays the authoritative read path. `poolindex.sqlite` is dual-write only.

SQLite becomes a candidate source of truth only after **all** of:

1. 14 consecutive calendar days of production dual-write with zero count mismatches.
2. At least 50 successful `writeBetaState` cycles, each followed by a dry-run `migrateStateToSqlite` on a copy whose user/wallet/session/invite/token counts match JSON.
3. One restore-drill after that window that opens JSON and SQLite with matching counts.

Until that gate, Phase 2 may configure prices and refuse checkout. It must not charge, settle credits, or treat SQLite as the ledger.

## TRUST_PROXY / rate-limit (updated after live bypass)

`clientIp()` with `POOLINDEX_TRUST_PROXY=1` reads **only** `CF-Connecting-IP` (Cloudflare overwrites this at the edge). It does not read `X-Real-IP`, `X-Forwarded-For`, `Forwarded`, or `X-Client-IP`. Login/register/forgot also rate-limit by **email**, so rotating spoofed IPs cannot reset the bucket.

Live finding (2026-09-22, Windows, before this change): 8 failed logins without spoof → 429; 12 failed logins same email with rotating `X-Real-IP` → all 401. Root cause: bucket key was `login:${ip}:${email}` plus trusting `X-Real-IP`.

Pass (after fix): same email, rotating `X-Real-IP`/`X-Forwarded-For`/`Forwarded`/`X-Client-IP` must 429 on attempt 9. Unit: `login email bucket survives rotating spoofed X-Real-IP`.

Admin MFA enroll/confirm/verify: 5 attempts / 5 minutes / admin user id.

`:43147` must be probed against the origin host IP (LAN `10.100.102.71`), not Cloudflare anycast. Refused on `172.67.x` / `104.21.x` only proves Cloudflare does not forward that port.

## TRUST_PROXY check from a real external network (Windows)

Do not run this from claimscoutserver. From the internet:

1. `https://poolindex.app/api/health` → 200.
2. Direct `http://<origin-LAN-or-public-IP>:43147/api/health` → connection refused. Do not use Cloudflare IPs.
3. Failed login, same email, eight times, then ninth → 429 even with spoofed `X-Real-IP` / `X-Forwarded-For` / `Forwarded` / `X-Client-IP`. No IP echo in the body.

## SSRF TOCTOU scenario (unit)

`lib/ssrf.test.ts`: hostname `rebind.example`, resolve #1 `93.184.216.34`, resolve #2 `169.254.169.254`. Pass = `SsrfError`, `fetchImpl` never called.

Residual: Node `fetch` may DNS-resolve a third time at connect. There is no IP pin (`node:undici` is not a builtin on this Node 22). Documented in `lib/ssrf.ts`; not claimed closed.

## STOP / rollback

If a change would lock operators out of HTTPS, break login, or corrupt `var/beta`: stop, restore the snapshot above, do not continue SQLite.

Rollback of Slice A (no DB yet): checkout previous files on this branch or restore the snapshot tree. Do not run `restore.sh --replace-live` with an older snapshot than live.
