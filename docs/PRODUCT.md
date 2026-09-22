# PoolIndex product

© 2026 Lior Elbaz, Israel. All rights reserved.

## Concept

PoolIndex is a research and source-scanning tool. It helps people search, organize, and review public information about airdrops, faucets, giveaways, archived offers, and similar claims. It is not a wallet, exchange, broker, recovery service, or payment processor.

## Purpose

Help a user answer: “Was something publicly offered, is the source still there, and does this public address appear eligible — without handing PoolIndex a seed phrase?”

## Architecture

- Next.js App Router UI on port 43147.
- Server-side scan, verify, eligibility, plan, watch, auth, admin, and feedback APIs.
- File stores under `var/` (catalog watch, Closed Beta accounts). No payment processor.
- Resource guard serializes heavy jobs and returns HTTP 503 instead of retrying.
- Dual-machine snapshots (`scripts/dual-machine/`) are append-only backups. Git is not the backup.

## Discovery workflow

1. Search the curated catalog.
2. Optionally run a live scan of plan-allowed sources (GitHub, Wayback, archive.org, Reddit, Bitcointalk — gated by Free/PoolIndex Pro).
3. Inspect a URL (live fetch + archive hints).
4. Optionally bind a public `0x` address and run read-only eligibility / remaining-pool checks.

Discovery source scope is frozen for Closed Beta. Do not add new live sources during this phase.

## Source verification workflow

`lib/verify.ts` fetches a URL, flags phishing/seed-form patterns, and checks Wayback availability. Hits that look like secrets, drainers, or claim-bot automation are dropped by `lib/safety.ts` before they reach the UI.

## Watch / watchlist

Daily catalog remaining-pool snapshot (`lib/watch.ts`, `scripts/watch-digest.sh`). Light, sequential, no retry loop. It does not store extra wallet addresses.

## Filtering / safety logic

Server-side. Blocks seed/private-key language, dump hosts, drainers, and automation/claimer tooling. Wallet input must be a 20-byte `0x` address.

## Wallet read-only model

- Public addresses only.
- Injected connect uses `eth_requestAccounts` to read an address.
- Signing a claim transaction happens only after the user explicitly approves a catalog-marked eligible claim in their own wallet.
- PoolIndex never requests, stores, or transmits seed phrases or private keys.

## Free / PoolIndex Pro model

Configurable in `lib/plan.ts` and enforced in API routes:

- Free: catalog + GitHub, 1 wallet, $0. Offer names and honest statuses are never paywalled.
- PoolIndex Pro (planned $20/month or $99/year, no billing yet): up to five wallets, claim-window email alerts, Wayback + archive.org scanning.
- Reddit and Bitcointalk stay reserved.

Closed Beta binds plan and wallets to the signed-in user record.

## Request Coverage vs broken sources

Two different problems. Do not sell them as one SKU.

- **Broken source:** an adapter that already exists and then fails (RPC, upgraded contract, timeout). Product maintenance / Pro SLA. Never a paid “fix so it works” add-on — that would look like pay-to-play and would wreck honest statuses.
- **Never built:** catalog programs such as 1inch, Blur, LayerZero, Gitcoin, Safe, dYdX. There is no hosted merkle/API lookup, so the wallet result is Unable to verify until someone writes an adapter. Public name: **Request Coverage**. Future payment buys adapter work, not Eligible. Shared bounties and JSON-config adapters (airdrop-finder style) are later; they are not Closed Beta live-scan expansion.

Public roadmap: `/coverage`. Operator learning queues catalog gaps. Repair queue stays for failed adapters only.

## Beta architecture

Invite-only accounts (`lib/auth.ts`) with scrypt password hashes, HMAC session cookies, email verification via operator outbox, Terms/Privacy acceptance versions, admin control center, kill switch (`lib/ops.ts`), technical telemetry, and human result feedback. User data is isolated by user ID under `var/beta/`.

## Major proprietary components

Catalog curation, live-source adapters, safety classifier, resource guard, plan entitlements, Closed Beta control plane.

## Development milestones

1. Public-claim catalog + read-only eligibility.
2. Live sources + safety blocking.
3. Resource/crash guards and dual-machine backup.
4. PoolIndex Pro server-side caps + catalog watch.
5. Closed Beta accounts, admin, legal, feedback (this phase).
