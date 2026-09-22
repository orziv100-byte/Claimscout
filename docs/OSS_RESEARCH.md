# Stage 0 — Open Source research (license-safe)

© 2026 Lior Elbaz, Israel. All rights reserved.

This note is the Stage 0 deliverable from `docs/POOLINDEX_SPEC.md`. It is research only. No third-party product was copied into PoolIndex.

## Machine split

- This host (`claimscoutserver`, role=linux) is the compute/runtime copy (`~/claimscout`). Production `next start` is on port 43147. Do not run `next build` while it is up.
- Windows is the control PC. No `scripts/dual-machine/config.env` peer SSH is configured, so work cannot be pushed to Windows from here. Heavy jobs stay on Linux, one at a time.

## Project 1 — airdrop-checker-x402

- URL: https://github.com/Br0ski777/airdrop-checker-x402
- License: MIT (confirmed via GitHub API `spdx_id: MIT`).
- What we learned (architecture, not source copy):
  - Expose wallet eligibility as a structured HTTP/MCP tool: address in, list of results out.
  - Each result carries token, estimated value, deadline, official claim URL, status.
  - Agent clients should receive a narrow task, not the whole source graph.
- What we did **not** take: their airdrop list, Etherscan scraping, x402 payment layer, or MCP server code. PoolIndex already has accounts; pay-per-call is out of scope for Stage 1.
- What we build ourselves: the same *shape* of a verified finding (status, official URL, optional deadline/amount) on our adapters.

## Project 2 — Airdrop-Checker (multi-chain)

- URL: https://github.com/lif3time-secr3t-c0de/Airdrop-Checker
- License: GitHub `Other` / `NOASSERTION`. Spec: architecture only, no code.
- What we learned from the public description only:
  - Split by chain, sequential jobs, rate limits, alerts as a later layer, do not believe “10,000 wallets” marketing.
- What we did **not** do: clone, read, or copy that repository’s source.

## Reusable public data (not product code)

- Uniswap merkle chunk layout: https://github.com/Uniswap/mrkl-drop-data-chunks (MIT).
  - `mapping.json` maps the first address of a 101-address cohort to the last address.
  - One small chunk JSON per cohort. We write our own lookup; we do not vendor Uniswap’s splitter.
  - `@uniswap/merkle-distributor` is **GPL-3.0**. Do not copy that contract/JS into PoolIndex. Call `isClaimed(uint256)` with viem against the live distributor.
- Canonical UNI MerkleDistributor: `0x090D4613473dEE047c3f27026eC4D8bd3C4F1aca` (catalog had a mistyped address; Stage 1 fixes it).
- ENS sharded merkle at `claim.ens.domains/airdrops/mainnet/` returned HTTP 500 at research time. Stage 1 does not invent ENS eligibility without that data.

## Competitor pattern we reuse legally

Known official snapshot/API/contract → check this wallet → Verified / Uncertain / Rejected.

That is how working checkers operate. PoolIndex adds profile, saved state, rescan, and later monitoring. We do not scrape random claim sites as the primary engine.

## Build vs skip

| Build in Stage 1 | Skip (license or not needed yet) |
| --- | --- |
| Own Source Manager + 10 adapters | x402 MCP server |
| UNI official chunk lookup + `isClaimed` | GPL merkle-distributor code |
| Native/ERC20 balances as forgotten assets | Second repo source, Solana/Cosmos |
| Save scan + diff | Agent/EXE |
