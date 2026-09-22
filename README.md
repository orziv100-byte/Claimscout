# PoolIndex

© 2026 Lior Elbaz, Israel. All rights reserved.

Web tool for discovering and verifying **publicly claimable** cryptocurrency rewards — airdrops, historical faucets, giveaways, redemption links, community testnet drips, and documented public puzzles.

Closed Beta is invite-only. PoolIndex is a research and source-scanning tool. It does not guarantee discovery, eligibility, payment, or profit. It will not brute-force keys, hunt seed phrases, open other people’s wallets, or sign a transaction unless you explicitly approve a legitimate claim.

See `docs/PRODUCT.md`, `docs/CLOSED_BETA.md`, `/terms`, and `/privacy`.


## What it covers

- Official and well-documented airdrops (including merkle distributors that may still hold unclaimed tokens)
- Historical faucets preserved by the Wayback Machine
- Public giveaways and Bitcointalk / Reddit claim threads
- Testnet and developer faucets
- Redemption programs (for example Unisocks)
- Public puzzles, documented only — no solvers, no range scanning

## What it refuses

- Private-key brute force or wallet cracking
- Seed phrase / mnemonic search or recovery
- Accessing wallets you do not control
- Exploit / bypass tooling
- Auto-signing blockchain transactions
- Storing wallet private keys

Wallet connect is read-only (`eth_requestAccounts` + `eth_call`) until you confirm a claim that this app already marked eligible.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Raises GitHub search rate limits |
| `ETH_RPC_URL` | Ethereum JSON-RPC (defaults to a public node) |
| `ARB_RPC_URL` | Arbitrum JSON-RPC |

| `POOLINDEX_SESSION_SECRET` | Required in production. Signs login sessions |
| `POOLINDEX_ADMIN_EMAILS` | Operator emails that receive admin role on register |
| `POOLINDEX_BOOTSTRAP_INVITE` | One-time operator invite code in production |
| `POOLINDEX_PLAN_SECRET` | Signs the PoolIndex Pro entitlement cookie |
| `POOLINDEX_PAID_KEYS` | PoolIndex Pro license keys (no billing yet) |
| `POOLINDEX_PUBLIC_URL` | Public origin for verify/reset links (`https://poolindex.app`) |
| `POOLINDEX_MAIL_PROVIDER` | `resend` in production; defaults to local outbox |
| `POOLINDEX_MAIL_FROM` | From address, e.g. `PoolIndex <noreply@poolindex.app>` |
| `RESEND_API_KEY` | Resend API key (gitignored `.env` only; never commit) |

No API keys are required for the catalog, Wayback CDX, archive.org, or read-only RPC checks.

Closed Beta: register at `/register` with an invite, accept Terms and Privacy, verify email, then sign in. Admin control center is `/admin`. Kill switch stops new scans without deleting data. Restore: `docs/RESTORE.md`.

## Using it

1. **Index** — paste a public `0x` address, then see named offers. Catalog is secondary.
2. **Live scan** — query GitHub, Wayback Machine, archive.org, Reddit, and Bitcointalk. Secret-looking hits, claim bots, and airdrop hunters are dropped.
3. **Catalog** — filter curated public offers by type and status.
4. **Claim page** — official source, archive, URL inspector, eligibility.
5. **Wallet check** — paste a `0x` address (connect is optional); offers vs holdings stay separate. Catalog watch snapshots remaining pools daily.

## Plans

- **Free** — one wallet, catalog, honest named statuses, URL inspect. Names are never paywalled.
- **PoolIndex Pro (planned $20/month or $99/year)** — up to five wallets, claim-window email alerts, Wayback/Archive.org scanning. Payment processing is unavailable.
- Reddit and Bitcointalk stay reserved.

Activate PoolIndex Pro at `/upgrade` with a license key (`POOLINDEX_PAID_KEYS`). In `next dev` the demo key is `poolindex-pro-demo`.

Merkle airdrops open the **official** claim UI. This app does not reconstruct merkle proofs.

Daily catalog watch (Linux, once a day, no retry loop):

```bash
npm run watch:digest
bash scripts/dual-machine/install-linux-watch-timer.sh
```

## Stack

Next.js, TypeScript, Tailwind CSS, shadcn/ui, viem.

## License notice

© 2026 Lior Elbaz, Israel. All rights reserved. Copying, sale, or commercial use without prior written permission from Lior Elbaz is prohibited. Third-party packages: `THIRD_PARTY_NOTICES.md`. See `COPYRIGHT.md` and `LICENSE`.
