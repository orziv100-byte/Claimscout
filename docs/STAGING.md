# Staging (fake secrets only)

Staging is a public-runtime check of production config **without** live `.env`.

Do not copy production secrets. Do not use the GitHub-known strings:

- `dev-only-poolindex-plan-secret`
- `dev-only-poolindex-session-secret`
- `poolindex-pro-demo`

Generate long random values, for example:

```bash
export NODE_ENV=production
export POOLINDEX_PUBLIC_DEPLOY=1
export POOLINDEX_SESSION_SECRET="$(openssl rand -base64 48)"
export POOLINDEX_PLAN_SECRET="$(openssl rand -base64 48)"
export POOLINDEX_ADMIN_EMAILS="staging-admin@example.com"
export POOLINDEX_PAID_KEYS="$(openssl rand -hex 24)"
export POOLINDEX_BETA_DIR="$(mktemp -d /tmp/poolindex-staging-XXXX)"
```

`assertSafeToStart()` / `instrumentation.ts` refuse well-known or missing secrets in public runtime and exit 1.

SQLite: JSON `state.json` stays the live read path until Lior cuts over. A verified `var/beta/poolindex.sqlite` is dual-written beside it. Engine scans stay in `var/engine/wallets/`.

Do not set `POOLINDEX_TRUST_PROXY=1` until Node binds loopback and external HTTPS through cloudflared is proven.

Do not run staging on port 43147 while production `claimscout.service` is bound there.
