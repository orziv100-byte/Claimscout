import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { COMPOUND_COMPTROLLER, COW_VCOW, ENGINE_SOURCES, ENGINE_WALLET_LEVEL_CATALOG_IDS, LIDO_WITHDRAWAL_QUEUE, selectEngineSources, UNI_V3_NPM } from "./sources.ts";
import { buildScanProgress, SCAN_STAGE_LABELS, SOURCE_TIMEOUT_MS } from "./progress.ts";
import { claimFromChunk, pickUniChunk } from "./uni-merkle.ts";
import { diffScans, loadScanHistory, saveScan } from "./state.ts";
import { describeDeadline, estimateRoi } from "./deadline.ts";
import { applyFindingSafety } from "./finding-safety.ts";
import { isImportantSource, listSourceRecords } from "./source-manager.ts";
import { nextWalletMonitorAt } from "./schedule.ts";
import { interpretEnsClaimBody } from "./ens-claim.ts";
import { publicEngineScan } from "./scan.ts";
import { scanHeadline, userCheckLabel } from "./result-summary.ts";
import {
  buildWalletProfile,
  interestingVerificationCounts,
  isAddressHoldingFinding,
  isAddressOfferFinding,
  isInterestingFinding,
  isWalletSpecificAirdrop,
  liveReadUnavailable,
  normalizeStoredFinding,
  relatedProgramHints,
} from "./profile.ts";
import { catalogIsRelevantToWallet, findingIsRelevantToWallet, walletActivity } from "./relevance.ts";
import { getAddress } from "viem";
import type { EngineFinding, EngineScan } from "./types.ts";

test("engine ships 50 real wallet-level sources", () => {
  assert.ok(ENGINE_SOURCES.length >= 50);
  assert.ok(ENGINE_SOURCES.every((source) => source.category !== "forgotten_token" || source.tokenAddress));
  assert.ok(
    ENGINE_SOURCES.every(
      (source) => source.category !== "forgotten_token" || (source.tokenSymbol && source.tokenDecimals != null),
    ),
  );
  assert.equal(COW_VCOW, "0xD057B63f5E69CF1B929b356b579Cba08D7688048");
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("uniswap-uni-airdrop"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("cow-protocol-airdrop"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("arbitrum-airdrop"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("ens-airdrop"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("hop-protocol-airdrop"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("optimism-airdrop-1"));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "airdrop-ens-merkle" && !source.windowClosed));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "airdrop-hop-hop" && source.windowClosed));
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-compound-comp")?.distributorAddress,
    COMPOUND_COMPTROLLER,
  );
  assert.equal(ENGINE_SOURCES.find((source) => source.id === "protocol-uniswap-v3-lp")?.distributorAddress, UNI_V3_NPM);
  assert.ok(ENGINE_SOURCES.some((source) => source.category === "protocol_claim"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("blur-airdrop"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("layerzero-airdrop"));
  assert.equal(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("jito-solana-airdrop"), false);
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "protocol-aave-stkaave"));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "protocol-maker-dsr"));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "protocol-curve-vecrv"));
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-maker-dsr")?.distributorAddress,
    "0x197E90f9FAD81970BA7976f22Cb5d243c738eC19",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-curve-vecrv")?.distributorAddress,
    "0x5f3b5DfEb7B28CDbD4CADCA380AEF238a288C7db",
  );
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "token-eth-wsteth"));
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "token-eth-wsteth")?.tokenAddress,
    "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  );
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "protocol-curve-3pool-lp"));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "protocol-lido-withdrawals"));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "protocol-aave-v3-account"));
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-curve-3pool-lp")?.tokenAddress,
    "0x6c3F90f043a72FA612cbac8115AE7e577E6B5d7b",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-lido-withdrawals")?.distributorAddress,
    LIDO_WITHDRAWAL_QUEUE,
  );
  assert.equal(LIDO_WITHDRAWAL_QUEUE, getAddress("0x889edc2edab5f40e902b864ad4d7ade8e412f9b1"));
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-aave-v3-account")?.distributorAddress,
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "token-eth-cusdc")?.tokenAddress,
    "0x39AA39c021dfbaE8faC545936693aC917d5E7563",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-uniswap-v2-usdc-eth")?.tokenAddress,
    "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "token-eth-cdai")?.tokenAddress,
    "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "token-eth-ausdc-v2")?.tokenAddress,
    "0xBcca60bB61934080951369a648Fb03DF4F96263C",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "token-eth-yvusdc")?.tokenAddress,
    "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "protocol-curve-steth-lp")?.tokenAddress,
    "0x06325440D014e39736583c165C2963BA99fAf14C",
  );
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "airdrop-blur-blur"));
  assert.ok(ENGINE_SOURCES.some((source) => source.id === "airdrop-layerzero-zro"));
  assert.ok(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("uniswap-socks"));
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "token-eth-socks")?.tokenAddress,
    "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5",
  );
  assert.equal(
    ENGINE_SOURCES.find((source) => source.id === "airdrop-ens-merkle")?.scanMethod,
    "official_claim_json+isClaimed",
  );
});

test("UNI chunk mapping picks the cohort that contains the address", () => {
  const mapping = {
    "0x0000000000000000000000000000000000000001": "0x00000000000000000000000000000000000000aa",
    "0x00000000000000000000000000000000000000bb": "0x00000000000000000000000000000000000000ff",
  };
  const hit = pickUniChunk(mapping, "0x00000000000000000000000000000000000000cc");
  assert.deepEqual(hit, {
    first: "0x00000000000000000000000000000000000000bb",
    last: "0x00000000000000000000000000000000000000ff",
  });
  assert.equal(pickUniChunk(mapping, "0x0000000000000000000000000000000000000000"), null);
});

test("UNI chunk lookup is case-insensitive", () => {
  const chunk = {
    "0xAbc0000000000000000000000000000000000001": { index: 7, amount: "1000" },
  };
  const claim = claimFromChunk(chunk, "0xabc0000000000000000000000000000000000001");
  assert.equal(claim?.index, 7);
});

test("rescan diff reports baseline then status change", () => {
  const first: EngineScan = {
    address: "0x0000000000000000000000000000000000000001",
    scannedAt: "2026-01-01T00:00:00.000Z",
    profile: {
      address: "0x0000000000000000000000000000000000000001",
      chains: [],
      tokens: [],
      protocols: [],
      contracts: [],
      relevantSourceIds: [],
    },
    findings: [
      {
        id: "airdrop-uni-merkle:x",
        sourceId: "airdrop-uni-merkle",
        catalogId: "uniswap-uni-airdrop",
        category: "airdrop",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        eligibility: "eligible",
        title: "Uniswap UNI airdrop",
        detail: "in tree",
        sourceStatus: "ok",
      },
    ],
    counters: {
      sourcesChecked: 1,
      sourcesFailed: 0,
      chainsChecked: 1,
      relevantSources: 1,
      potentialFindings: 1,
      verifiedFindings: 1,
    },
    summary: {
      adaptersChecked: 1,
      adaptersSucceeded: 1,
      adaptersFailed: 0,
      failures: [],
      verified: 1,
      uncertain: 0,
      rejected: 0,
    },
    changes: [],
  };
  const second: EngineScan = {
    ...first,
    scannedAt: "2026-01-02T00:00:00.000Z",
    findings: [
      {
        ...first.findings[0],
        eligibility: "already_claimed",
        detail: "now claimed",
      },
    ],
  };
  const baseline = diffScans(null, first);
  assert.equal(baseline[0]?.kind, "baseline");
  const changed = diffScans(first, second);
  assert.equal(changed[0]?.kind, "status_changed");
});

test("deadlines stay honest: missing, closing, expired", () => {
  const now = Date.parse("2026-09-21T00:00:00.000Z");
  assert.equal(describeDeadline(undefined, now).deadlineStatus, "none");
  assert.equal(describeDeadline("2023-09-24", now).deadlineStatus, "expired");
  const closing = describeDeadline(new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(), now);
  assert.equal(closing.deadlineStatus, "closing");
});

test("ROI is omitted without a price and labeled estimate when priced", () => {
  assert.equal(estimateRoi({ amount: "10", includeFees: false }).roiConfidence, "none");
  const mid = estimateRoi({ amount: "10", priceUsd: 2, includeFees: false });
  assert.equal(mid.estimatedValueUsd, 20);
  assert.equal(mid.roiConfidence, "medium");
  const high = estimateRoi({ amount: "10", priceUsd: 2, feeUsd: 3, includeFees: true });
  assert.equal(high.estimatedNetUsd, 17);
  assert.equal(high.roiConfidence, "high");
});

test("every engine source has frequency and sequential rate limit", () => {
  for (const source of ENGINE_SOURCES) {
    assert.equal(source.frequency, "daily");
    assert.equal(source.rateLimit, "sequential");
    assert.equal(source.adapterVersion, "1");
  }
});

test("source selection keeps merkle airdrops on unused wallets and skips documented catalog airdrops", () => {
  const none = selectEngineSources([]);
  assert.ok(none.some((source) => source.id === "token-eth-uni"));
  assert.ok(none.some((source) => source.id === "airdrop-uni-merkle"));
  assert.ok(none.some((source) => source.id === "airdrop-cow-vcow"));
  assert.ok(none.some((source) => source.id === "protocol-compound-comp"));
  assert.equal(none.some((source) => source.id === "airdrop-1inch-merkle"), false);
  assert.equal(none.some((source) => source.id === "airdrop-optimism-1"), false);
  assert.equal(none.some((source) => source.id === "token-pol-usdc"), false);
  const withEth = selectEngineSources([1]);
  assert.ok(withEth.some((source) => source.id === "airdrop-1inch-merkle"));
  const withPolygon = selectEngineSources([137]);
  assert.ok(withPolygon.some((source) => source.id === "token-pol-usdc"));
  const withOp = selectEngineSources([10]);
  assert.ok(withOp.some((source) => source.id === "airdrop-optimism-1"));
});

test("zero protocol claims are not interesting; leftover LP and accrued COMP are", () => {
  const zero: EngineFinding = {
    id: "protocol-compound-comp:x",
    sourceId: "protocol-compound-comp",
    category: "protocol_claim",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    title: "Compound v2 unclaimed COMP",
    detail: "0",
    amount: "0",
    symbol: "COMP",
    sourceStatus: "ok",
  };
  assert.equal(isInterestingFinding(zero), false);
  assert.equal(isInterestingFinding({ ...zero, amount: "1.2" }), true);
  assert.equal(isInterestingFinding({ ...zero, sourceStatus: "failed", amount: "0" }), true);
});

test("bytecode-only catalog airdrops are not offers for this wallet; merkle lookups are", () => {
  const documented: EngineFinding = {
    id: "airdrop-1inch-merkle:x",
    sourceId: "airdrop-1inch-merkle",
    category: "airdrop",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    eligibility: "window_closed",
    title: "1inch",
    detail: "bytecode only",
    sourceStatus: "ok",
  };
  const unusedUni: EngineFinding = {
    ...documented,
    id: "airdrop-uni-merkle:x",
    sourceId: "airdrop-uni-merkle",
    eligibility: "ineligible",
    title: "Uniswap UNI airdrop",
    detail: "not in merkle",
  };
  const arb: EngineFinding = {
    ...documented,
    id: "airdrop-arbitrum-arb:x",
    sourceId: "airdrop-arbitrum-arb",
    title: "Arbitrum ARB airdrop",
  };
  assert.equal(isWalletSpecificAirdrop(documented), false);
  assert.equal(isInterestingFinding(documented), false);
  assert.equal(isAddressOfferFinding(documented), false);
  assert.equal(isInterestingFinding(unusedUni), true);
  assert.equal(isAddressOfferFinding(unusedUni), true);
  assert.equal(isAddressOfferFinding(arb), false);
  assert.equal(isAddressHoldingFinding({ category: "forgotten_token", amount: "0", sourceStatus: "ok" }), false);
  assert.equal(isAddressHoldingFinding({ category: "forgotten_token", amount: "2", sourceStatus: "ok" }), true);
  assert.equal(isAddressHoldingFinding({ category: "protocol_claim", amount: "0.5", sourceStatus: "ok" }), true);
  const hints = relatedProgramHints({
    tokens: [{ chainId: 1, symbol: "UNI", amount: "2", contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984" }],
  });
  assert.equal(hints[0]?.protocol, "uniswap");
  assert.equal(hints[0]?.hasAddressLookup, true);
});

test("relevance uses holdings and claims, not chain ETH alone", () => {
  const unused = walletActivity({ chains: [{ chainId: 1, chainLabel: "Ethereum", native: "0", symbol: "ETH", txCount: 0 }], tokens: [], protocols: [] });
  const uniIneligible = { sourceId: "airdrop-uni-merkle", eligibility: "ineligible" as const, amount: undefined };
  const uniEligible = { sourceId: "airdrop-uni-merkle", eligibility: "eligible" as const, amount: "400" };
  const inchClosed = { sourceId: "airdrop-1inch-merkle", eligibility: "window_closed" as const, amount: undefined };
  assert.equal(findingIsRelevantToWallet(uniIneligible, unused), false);
  assert.equal(findingIsRelevantToWallet(uniEligible, unused), true);
  assert.equal(findingIsRelevantToWallet(inchClosed, unused), false);
  const holdsUni = walletActivity({
    chains: [{ chainId: 1, chainLabel: "Ethereum", native: "6.7", symbol: "ETH", txCount: 40 }],
    tokens: [{ chainId: 1, symbol: "UNI", amount: "12", contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984" }],
    protocols: ["uniswap"],
  });
  assert.equal(findingIsRelevantToWallet(uniIneligible, holdsUni), true);
  assert.equal(catalogIsRelevantToWallet({ id: "uniswap-uni-airdrop", asset: "UNI" }, holdsUni), true);
  assert.equal(catalogIsRelevantToWallet({ id: "hop-protocol-airdrop", asset: "HOP" }, unused), false);
  assert.equal(catalogIsRelevantToWallet({ id: "hop-protocol-airdrop", asset: "HOP" }, holdsUni), false);
});

test("Lido WithdrawalQueue address is a valid EIP-55 checksum", () => {
  assert.equal(getAddress(LIDO_WITHDRAWAL_QUEUE), LIDO_WITHDRAWAL_QUEUE);
  assert.equal(LIDO_WITHDRAWAL_QUEUE, getAddress("0x889edc2edab5f40e902b864ad4d7ade8e412f9b1"));
  for (const source of ENGINE_SOURCES) {
    for (const value of [source.tokenAddress, source.distributorAddress]) {
      if (!value) continue;
      getAddress(value.toLowerCase() as `0x${string}`);
    }
  }
});

test("scan summary verified count ignores zero-balance holdings", () => {
  const zeroToken: EngineFinding = {
    id: "token-eth-uni:x",
    sourceId: "token-eth-uni",
    category: "forgotten_token",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    title: "UNI",
    detail: "0",
    amount: "0",
    symbol: "UNI",
    sourceStatus: "ok",
  };
  const airdrop: EngineFinding = {
    id: "airdrop-uni-merkle:x",
    sourceId: "airdrop-uni-merkle",
    category: "airdrop",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    eligibility: "ineligible",
    title: "Uniswap UNI airdrop",
    detail: "not in merkle",
    sourceStatus: "ok",
  };
  const unread = {
    ...airdrop,
    id: "airdrop-blur:x",
    sourceId: "airdrop-blur",
    title: "Blur",
    ...liveReadUnavailable(),
    detail: "Official contract currently has no bytecode. Live eligibility cannot be read.",
  };
  const counts = interestingVerificationCounts([zeroToken, airdrop, unread]);
  assert.equal(counts.verified, 1);
  assert.equal(counts.uncertain, 0);
  assert.equal(liveReadUnavailable().verification, "uncertain");
  assert.equal(liveReadUnavailable().eligibility, "unable_to_verify");
});

test("publicEngineScan recomputes summary from interesting findings and unreadable bytecode", () => {
  const zeroToken: EngineFinding = {
    id: "token-eth-uni:x",
    sourceId: "token-eth-uni",
    category: "forgotten_token",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    title: "UNI",
    detail: "No UNI token balance.",
    amount: "0",
    symbol: "UNI",
    sourceStatus: "ok",
  };
  const unreadAirdrop: EngineFinding = {
    id: "airdrop-1inch:x",
    sourceId: "airdrop-1inch",
    catalogId: "1inch-airdrop",
    category: "airdrop",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    title: "1inch",
    detail:
      "Official contract 0xabc currently has no bytecode. Live eligibility cannot be read. PoolIndex does not invent Eligible.",
    sourceStatus: "ok",
  };
  const leftover: EngineFinding = {
    id: "protocol-compound-comp:x",
    sourceId: "protocol-compound-comp",
    category: "protocol_claim",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    title: "Compound v2 unclaimed COMP",
    detail: "accrued",
    amount: "1.2",
    symbol: "COMP",
    sourceStatus: "ok",
  };
  assert.equal(normalizeStoredFinding(unreadAirdrop).verification, "uncertain");
  assert.equal(normalizeStoredFinding(unreadAirdrop).eligibility, "unable_to_verify");
  const closed = {
    ...unreadAirdrop,
    eligibility: "window_closed" as const,
    detail: "Official contract currently has no bytecode. The official claim window is closed (2023-09-24).",
  };
  assert.equal(normalizeStoredFinding(closed).verification, "verified");
  const view = publicEngineScan({
    address: "0x0000000000000000000000000000000000000001",
    scannedAt: "2026-09-22T00:00:05.701Z",
    profile: {
      address: "0x0000000000000000000000000000000000000001",
      chains: [],
      tokens: [],
      protocols: [],
      contracts: [],
      relevantSourceIds: [],
    },
    findings: [zeroToken, unreadAirdrop, leftover],
    counters: {
      sourcesChecked: 3,
      sourcesFailed: 0,
      chainsChecked: 1,
      relevantSources: 3,
      potentialFindings: 3,
      verifiedFindings: 3,
    },
    summary: {
      adaptersChecked: 3,
      adaptersSucceeded: 3,
      adaptersFailed: 0,
      failures: [],
      verified: 63,
      uncertain: 5,
      rejected: 0,
    },
    changes: [],
  });
  assert.equal(view.summary.verified, 1);
  assert.equal(view.summary.uncertain, 0);
  assert.equal(view.counters.verifiedFindings, 1);
  assert.equal(view.counters.potentialFindings, 1);
  assert.equal(view.findings.some((row) => row.sourceId === "airdrop-1inch"), false);
  assert.equal(view.findings.some((row) => row.sourceId === "protocol-compound-comp"), true);
});

test("wallet profile uses token contracts and protocols from holdings, not source ids", () => {
  const address = "0x0000000000000000000000000000000000000001";
  const profile = buildWalletProfile(
    address,
    [
      {
        id: "native-ethereum:x",
        sourceId: "native-ethereum",
        category: "native_balance",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        title: "Ethereum native balance",
        detail: "has",
        amount: "1",
        symbol: "ETH",
        sourceStatus: "ok",
      },
      {
        id: "token-eth-uni:x",
        sourceId: "token-eth-uni",
        category: "forgotten_token",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        title: "UNI token balance",
        detail: "has",
        amount: "2",
        symbol: "UNI",
        sourceStatus: "ok",
      },
      {
        id: "protocol-compound-comp:x",
        sourceId: "protocol-compound-comp",
        category: "protocol_claim",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        title: "Compound v2 unclaimed COMP",
        detail: "accrued",
        amount: "0.5",
        symbol: "COMP",
        sourceStatus: "ok",
      },
    ],
    ENGINE_SOURCES.filter((source) =>
      ["native-ethereum", "token-eth-uni", "protocol-compound-comp"].includes(source.id),
    ),
    new Map([[1, 12]]),
  );
  assert.equal(profile.chains[0]?.txCount, 12);
  assert.equal(profile.tokens[0]?.contract.toLowerCase(), "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984");
  assert.ok(profile.protocols.includes("uniswap"));
  assert.ok(profile.protocols.includes("compound"));
  assert.ok(profile.contracts.some((row) => row.toLowerCase() === COMPOUND_COMPTROLLER.toLowerCase()));
});

test("finding safety rejects blocked hosts and does not invent Eligible", () => {
  const flagged = applyFindingSafety({
    id: "airdrop-uni-merkle:x",
    sourceId: "airdrop-uni-merkle",
    category: "airdrop",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    eligibility: "eligible",
    title: "Uniswap UNI airdrop",
    detail: "in tree",
    officialUrl: "https://privatekeys.pw/claim",
    sourceStatus: "ok",
    sourceConfidence: "official_project",
  });
  assert.equal(flagged.verification, "rejected");
  assert.equal(flagged.eligibility, undefined);
  assert.equal(flagged.sourceConfidence, "unverified");

  const official = applyFindingSafety({
    id: "airdrop-uni-merkle:x",
    sourceId: "airdrop-uni-merkle",
    category: "airdrop",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    eligibility: "ineligible",
    title: "Uniswap UNI airdrop",
    detail: "Address is not in the published Uniswap merkle chunks.",
    officialUrl: "https://app.uniswap.org/",
    sourceStatus: "ok",
    sourceConfidence: "official_merkle",
  });
  assert.equal(official.verification, "verified");
  assert.equal(official.eligibility, "ineligible");
});

test("source manager records include frequency, adapter version, and importance", () => {
  const rows = listSourceRecords([]);
  assert.ok(rows.length >= 40);
  const uni = rows.find((row) => row.id === "airdrop-uni-merkle");
  assert.equal(uni?.frequency, "daily");
  assert.equal(uni?.adapterVersion, "1");
  assert.equal(uni?.important, true);
  assert.equal(isImportantSource({ category: "forgotten_token" }), false);
});

test("diff reports an important source that failed after a healthy run", () => {
  const base: EngineScan = {
    address: "0x0000000000000000000000000000000000000001",
    scannedAt: "2026-01-01T00:00:00.000Z",
    profile: {
      address: "0x0000000000000000000000000000000000000001",
      chains: [],
      tokens: [],
      protocols: [],
      contracts: [],
      relevantSourceIds: [],
    },
    findings: [],
    counters: {
      sourcesChecked: 1,
      sourcesFailed: 0,
      chainsChecked: 1,
      relevantSources: 1,
      potentialFindings: 0,
      verifiedFindings: 0,
    },
    summary: {
      adaptersChecked: 1,
      adaptersSucceeded: 1,
      adaptersFailed: 0,
      failures: [],
      verified: 0,
      uncertain: 0,
      rejected: 0,
    },
    changes: [],
    sourceHealth: [{ id: "airdrop-uni-merkle", status: "ok", consecutiveFailures: 0, lastSuccessAt: "2026-01-01T00:00:00.000Z" }],
  };
  const next: EngineScan = {
    ...base,
    scannedAt: "2026-01-02T00:00:00.000Z",
    sourceHealth: [
      {
        id: "airdrop-uni-merkle",
        status: "failed",
        consecutiveFailures: 1,
        lastSuccessAt: "2026-01-01T00:00:00.000Z",
        lastError: "RPC timeout",
      },
    ],
  };
  const kinds = diffScans(base, next).map((change) => change.kind);
  assert.ok(kinds.includes("source_failed"));
});

test("scan progress is Profile → Chains → Protocols → Relevant Sources → Verification", () => {
  assert.deepEqual(Object.values(SCAN_STAGE_LABELS), [
    "Profile",
    "Chains",
    "Protocols",
    "Relevant Sources",
    "Verification",
  ]);
  assert.equal(SOURCE_TIMEOUT_MS, 30_000);
  const natives = ENGINE_SOURCES.filter((source) => source.category === "native_balance");
  const progress = buildScanProgress({
    address: "0x0000000000000000000000000000000000000001",
    startedAt: Date.now() - 5_000,
    stage: "chains",
    natives,
    selected: natives,
    findings: [
      {
        id: "native-ethereum:x",
        sourceId: "native-ethereum",
        category: "native_balance",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        title: "Ethereum native balance",
        detail: "has balance",
        amount: "1",
        symbol: "ETH",
        sourceStatus: "ok",
      },
    ],
    timedOut: 0,
    currentSource: "native-arbitrum",
  });
  assert.equal(progress.stages[0]?.status, "done");
  assert.equal(progress.stages[1]?.status, "active");
  assert.equal(progress.stages[1]?.count, 1);
  assert.equal(progress.stages[1]?.total, natives.length);
  assert.equal(progress.chainLabels[0], "Ethereum");
  assert.ok(progress.elapsedMs >= 0);
});

test("next wallet monitor is the following 07:00 UTC", () => {
  assert.equal(nextWalletMonitorAt(new Date("2026-09-21T08:00:00.000Z")), "2026-09-22T07:00:00.000Z");
  assert.equal(nextWalletMonitorAt(new Date("2026-09-21T06:00:00.000Z")), "2026-09-21T07:00:00.000Z");
});

test("wallet scan history keeps last scans newest first", () => {
  const dir = mkdtempSync(join(tmpdir(), "poolindex-engine-"));
  const previous = process.env.POOLINDEX_ENGINE_DIR;
  process.env.POOLINDEX_ENGINE_DIR = dir;
  try {
    const scan = (scannedAt: string, verifiedFindings: number): EngineScan => ({
      address: "0x0000000000000000000000000000000000000001",
      scannedAt,
      profile: {
        address: "0x0000000000000000000000000000000000000001",
        chains: [],
        tokens: [],
        protocols: [],
        contracts: [],
        relevantSourceIds: [],
      },
      findings: [],
      counters: {
        sourcesChecked: 42,
        sourcesFailed: 0,
        chainsChecked: 4,
        relevantSources: 10,
        potentialFindings: 2,
        verifiedFindings,
      },
      summary: {
        adaptersChecked: 42,
        adaptersSucceeded: 42,
        adaptersFailed: 0,
        failures: [],
        verified: verifiedFindings,
        uncertain: 0,
        rejected: 0,
      },
      changes: [],
    });
    saveScan(scan("2026-01-01T00:00:00.000Z", 1));
    saveScan(scan("2026-01-02T00:00:00.000Z", 3));
    const history = loadScanHistory("0x0000000000000000000000000000000000000001");
    assert.equal(history.length, 2);
    assert.equal(history[0]?.scannedAt, "2026-01-02T00:00:00.000Z");
    assert.equal(history[0]?.verifiedFindings, 3);
    assert.equal(history[1]?.scannedAt, "2026-01-01T00:00:00.000Z");
  } finally {
    if (previous == null) delete process.env.POOLINDEX_ENGINE_DIR;
    else process.env.POOLINDEX_ENGINE_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ENS official claim body is JSON merkle or HTML, never invented Eligible", () => {
  const html = interpretEnsClaimBody("text/html; charset=utf-8", "<!doctype html><html lang=\"en\">");
  assert.equal(html.kind, "not_json");
  const empty = interpretEnsClaimBody("application/json", "{}");
  assert.equal(empty.kind, "empty");
  const claim = interpretEnsClaimBody(
    "application/json",
    JSON.stringify({ index: 12, amount: "1000000000000000000" }),
  );
  assert.equal(claim.kind, "claim");
  if (claim.kind === "claim") {
    assert.equal(claim.claim.index, "12");
    assert.equal(claim.claim.amount, "1000000000000000000");
  }
});

test("unable_to_verify is never labeled verified, and the headline does not say money is owed", () => {
  const blur: EngineFinding = {
    id: "airdrop-blur:x",
    sourceId: "airdrop-blur",
    category: "airdrop",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    eligibility: "unable_to_verify",
    title: "Blur",
    detail: "no merkle",
    sourceStatus: "ok",
  };
  const fixed = normalizeStoredFinding(blur);
  assert.equal(fixed.verification, "uncertain");
  assert.equal(fixed.eligibility, "unable_to_verify");
  assert.equal(userCheckLabel(fixed), "Unable to verify");
  const ineligible: EngineFinding = {
    ...blur,
    id: "airdrop-uni:x",
    eligibility: "ineligible",
    verification: "verified",
  };
  assert.equal(userCheckLabel(ineligible), "Not eligible");
  const headline = scanHeadline([
    ineligible,
    {
      ...blur,
      id: "native-eth:x",
      sourceId: "native-eth",
      category: "native_balance",
      eligibility: undefined,
      amount: "1.2",
      verification: "verified",
    },
  ]);
  assert.equal(headline.claimNow, 0);
  assert.equal(headline.notEligible, 1);
  assert.equal(headline.holdings, 1);
  assert.match(headline.sentence, /Nothing to claim/i);
  assert.doesNotMatch(headline.sentence, /\b63 Verified\b/);
});
