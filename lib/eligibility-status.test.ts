import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, getClaimById } from "./catalog.ts";
import { ENGINE_WALLET_LEVEL_CATALOG_IDS } from "./engine/sources.ts";
import {
  catalogCheckKind,
  walletEligibilityLabel,
  walletEligibilityStatus,
} from "./eligibility-status.ts";

test("wallet labels are the four public verdicts", () => {
  assert.equal(walletEligibilityLabel("eligible"), "Eligible");
  assert.equal(walletEligibilityLabel("ineligible"), "Not eligible");
  assert.equal(walletEligibilityLabel("already_claimed"), "Already claimed");
  assert.equal(walletEligibilityLabel("unable_to_verify"), "Unable to verify");
  assert.equal(walletEligibilityLabel("unknown"), "Unable to verify");
  assert.equal(walletEligibilityLabel("window_closed"), "Window closed");
  assert.equal(walletEligibilityStatus("window_closed"), "unable_to_verify");
});

test("remaining-pool catalog offers are not wallet-level checks unless an adapter exists", () => {
  const uni = getClaimById("uniswap-uni-airdrop");
  assert.ok(uni);
  assert.equal(uni.claimability, "unclaimed_contract_balance_only");
  assert.equal(catalogCheckKind(uni), "wallet_level");

  const inch = getClaimById("1inch-airdrop");
  assert.ok(inch);
  assert.equal(catalogCheckKind(inch), ENGINE_WALLET_LEVEL_CATALOG_IDS.has("1inch-airdrop") ? "wallet_level" : "catalog_only");

  const faucet = getClaimById("sepolia-pow-faucet");
  assert.ok(faucet);
  assert.equal(catalogCheckKind(faucet), "catalog_only");

  const btc = getClaimById("gavin-andresen-bitcoin-faucet");
  assert.ok(btc);
  assert.equal(catalogCheckKind(btc), "catalog_only");
});

test("claimedFn and merkle adapters are the wallet-level catalog checks", () => {
  const walletLevel = CATALOG.filter((claim) => catalogCheckKind(claim) === "wallet_level").map((c) => c.id);
  const expected = [...ENGINE_WALLET_LEVEL_CATALOG_IDS].filter((id) => CATALOG.some((claim) => claim.id === id)).sort();
  assert.deepEqual(walletLevel.sort(), expected);
  for (const claim of CATALOG) {
    if (ENGINE_WALLET_LEVEL_CATALOG_IDS.has(claim.id)) continue;
    if (!claim.onChain?.claimedFn) assert.equal(catalogCheckKind(claim), "catalog_only");
  }
});
