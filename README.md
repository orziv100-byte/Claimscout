# Claimscout

Web tool for discovering and verifying **publicly claimable** cryptocurrency rewards — airdrops, historical faucets, giveaways, redemption links, community testnet drips, and documented public puzzles.

It searches live sources and archives, then lets you inspect a URL and run **read-only** eligibility checks. It will not brute-force keys, hunt seed phrases, open other people’s wallets, or sign a transaction unless you explicitly approve a legitimate claim.

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

No API keys are required for the catalog, Wayback CDX, archive.org, or read-only RPC checks.

## Using it

1. **Scout** — search the catalog and jump into a live scan.
2. **Live scan** — query GitHub, Wayback Machine, archive.org, Reddit, and Bitcointalk. Secret-looking hits, claim bots, and airdrop hunters are dropped.
3. **Catalog** — filter curated public offers by type and status.
4. **Claim page** — sources, archive links, URL inspector, eligibility.
5. **Wallet check** — paste a `0x` address or connect a browser wallet; scan remaining on-chain pools.

Merkle airdrops open the **official** claim UI. This app does not reconstruct merkle proofs.

## Stack

Next.js, TypeScript, Tailwind CSS, shadcn/ui, viem.
