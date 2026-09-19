# Poolindex

© 2026 Poolindex. All rights reserved.

Web tool for discovering and verifying **publicly claimable** cryptocurrency rewards — airdrops, historical faucets, giveaways, redemption links, community testnet drips, and documented public puzzles.

Closed Beta is invite-only. Poolindex is a research and source-scanning tool. It does not guarantee discovery, eligibility, payment, or profit. It will not brute-force keys, hunt seed phrases, open other people’s wallets, or sign a transaction unless you explicitly approve a legitimate claim.

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
| `POOLINDEX_PLAN_SECRET` | Signs the Poolindex Pro entitlement cookie |
| `POOLINDEX_PAID_KEYS` | Poolindex Pro license keys (no billing yet) |

No API keys are required for the catalog, Wayback CDX, archive.org, or read-only RPC checks.

Closed Beta: register at `/register` with an invite, accept Terms and Privacy, verify email, then sign in. Admin control center is `/admin`. Kill switch stops new scans without deleting data. Restore: `docs/RESTORE.md`.

## Using it

1. **Index** — search the catalog and jump into a live scan.
2. **Live scan** — query GitHub, Wayback Machine, archive.org, Reddit, and Bitcointalk. Secret-looking hits, claim bots, and airdrop hunters are dropped.
3. **Catalog** — filter curated public offers by type and status.
4. **Claim page** — sources, archive links, URL inspector, eligibility.
5. **Wallet check** — paste a `0x` address or connect a browser wallet; scan remaining on-chain pools. Catalog watch snapshots remaining pools daily and shows what changed.

## Plans

- **Free** — catalog + GitHub, eligibility for **one** wallet.
- **Poolindex Pro ($40)** — 4 of 6 scan sources (~70%): catalog, GitHub, Wayback, Archive.org, and **up to five** wallets.
- Reddit and Bitcointalk stay reserved.

Activate Poolindex Pro at `/upgrade` with a license key (`POOLINDEX_PAID_KEYS`). In `next dev` the demo key is `poolindex-pro-demo`.

Merkle airdrops open the **official** claim UI. This app does not reconstruct merkle proofs.

Daily catalog watch (Linux, once a day, no retry loop):

```bash
npm run watch:digest
bash scripts/dual-machine/install-linux-watch-timer.sh
```

## Stack

Next.js, TypeScript, Tailwind CSS, shadcn/ui, viem.

## License notice

© 2026 Poolindex. All rights reserved. Third-party packages: `THIRD_PARTY_NOTICES.md`.
