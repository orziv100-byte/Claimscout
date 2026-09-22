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

## Topology (S-01) — bind deferred

Observed 2026-09-22 on claimscoutserver:

- App: systemd `claimscout.service` → `next start --hostname 0.0.0.0 --port 43147`
- Listen: `0.0.0.0:43147` and SSH `0.0.0.0:22`
- No nginx, no Caddy
- `cloudflared` **is** active (system service, token file — do not log it)
- Local health: `http://127.0.0.1:43147/api/health` → 200

`127.0.0.1` bind is **compatible in principle** (cloudflared on the same host can still reach loopback) but is **not applied** until:

1. Confirm the tunnel ingress origin is `http://127.0.0.1:43147` or `http://localhost:43147` (not a public NIC).
2. Hit `https://poolindex.app/api/health` from a **real external network** (not this host) and get 200.
3. Then change systemd hostname to `127.0.0.1`, reload, and repeat the external check.
4. Only then set `POOLINDEX_TRUST_PROXY=1` so rate limits see `X-Real-IP` from the tunnel.

Until that proof, forwarding headers are ignored (`clientIp` → `unknown`) so a client hitting `:43147` cannot spoof buckets.

## STOP / rollback

If a change would lock operators out of HTTPS, break login, or corrupt `var/beta`: stop, restore the snapshot above, do not continue SQLite.

Rollback of Slice A (no DB yet): checkout previous files on this branch or restore the snapshot tree. Do not run `restore.sh --replace-live` with an older snapshot than live.
