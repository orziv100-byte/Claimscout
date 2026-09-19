# Poolindex product

© 2026 Poolindex. All rights reserved.

## Concept

Poolindex is a research and source-scanning tool. It helps people search, organize, and review public information about airdrops, faucets, giveaways, archived offers, and similar claims. It is not a wallet, exchange, broker, recovery service, or payment processor.

## Purpose

Help a user answer: “Was something publicly offered, is the source still there, and does this public address appear eligible — without handing Poolindex a seed phrase?”

## Architecture

- Next.js App Router UI on port 43147.
- Server-side scan, verify, eligibility, plan, watch, auth, admin, and feedback APIs.
- File stores under `var/` (catalog watch, Closed Beta accounts). No payment processor.
- Resource guard serializes heavy jobs and returns HTTP 503 instead of retrying.
- Dual-machine snapshots (`scripts/dual-machine/`) are append-only backups. Git is not the backup.

## Discovery workflow

1. Search the curated catalog.
2. Optionally run a live scan of plan-allowed sources (GitHub, Wayback, archive.org, Reddit, Bitcointalk — gated by Free/Poolindex Pro).
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
- Poolindex never requests, stores, or transmits seed phrases or private keys.

## Free / Poolindex Pro model

Configurable in `lib/plan.ts` and enforced in API routes:

- Free: catalog + GitHub, 1 wallet, $0.
- Poolindex Pro (planned $40, no billing yet): catalog + GitHub + Wayback + archive.org (~70% of sources), 5 wallets.
- Reddit and Bitcointalk stay reserved.

Closed Beta binds plan and wallets to the signed-in user record.

## Beta architecture

Invite-only accounts (`lib/auth.ts`) with scrypt password hashes, HMAC session cookies, email verification via operator outbox, Terms/Privacy acceptance versions, admin control center, kill switch (`lib/ops.ts`), technical telemetry, and human result feedback. User data is isolated by user ID under `var/beta/`.

## Major proprietary components

Catalog curation, live-source adapters, safety classifier, resource guard, plan entitlements, Closed Beta control plane.

## Development milestones

1. Public-claim catalog + read-only eligibility.
2. Live sources + safety blocking.
3. Resource/crash guards and dual-machine backup.
4. Poolindex Pro server-side caps + catalog watch.
5. Closed Beta accounts, admin, legal, feedback (this phase).
