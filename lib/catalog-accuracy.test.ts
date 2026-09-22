import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, CONTRACT_BALANCE_NOT_CLAIMABLE } from "./catalog.ts";
import { CLAIMABILITY_LABEL } from "./labels.ts";
import { contentSecurityPolicy } from "./csp.ts";
import { publicHealthBody } from "./health.ts";

test("every catalog entry has an explicit claimability class", () => {
  for (const claim of CATALOG) {
    assert.ok(claim.claimability, claim.id);
    assert.ok(claim.claimability in CLAIMABILITY_LABEL, claim.id);
  }
});

test("unclaimed_remaining means unclaimed contract balance only, never proven claimability", () => {
  const rows = CATALOG.filter((claim) => claim.status === "unclaimed_remaining");
  assert.ok(rows.length >= 4);
  for (const claim of rows) {
    assert.equal(claim.claimability, "unclaimed_contract_balance_only", claim.id);
    assert.ok(claim.warnings.includes(CONTRACT_BALANCE_NOT_CLAIMABLE), claim.id);
    assert.match(
      `${claim.howToVerify} ${claim.warnings.join(" ")}`.toLowerCase(),
      /do not prove|does not prove|not proof/,
    );
  }
});

test("open catalog entries are confirmed live claims or eligibility unknown, never expired", () => {
  const rows = CATALOG.filter((claim) => claim.status === "open");
  assert.ok(rows.length >= 1);
  for (const claim of rows) {
    assert.ok(
      claim.claimability === "confirmed_live_claim" || claim.claimability === "eligibility_unknown",
      claim.id,
    );
  }
  assert.equal(CATALOG.find((c) => c.id === "freebitco-in")?.claimability, "confirmed_live_claim");
  assert.equal(CATALOG.find((c) => c.id === "sepolia-pow-faucet")?.claimability, "confirmed_live_claim");
  assert.equal(CATALOG.find((c) => c.id === "bitcoin-puzzle-2015")?.claimability, "eligibility_unknown");
  assert.equal(CATALOG.find((c) => c.id === "uniswap-socks")?.claimability, "eligibility_unknown");
  assert.equal(CATALOG.find((c) => c.id === "ethereum-foundation-testnet-notes")?.claimability, "eligibility_unknown");
});

test("expired and archived catalog entries are marked expired for claimability", () => {
  for (const claim of CATALOG.filter((row) => row.status === "expired" || row.status === "archived")) {
    assert.equal(claim.claimability, "expired", claim.id);
  }
});

test("catalog remaining-pool methods are declared and do not use mistyped token addresses", () => {
  const withToken = CATALOG.filter((claim) => claim.onChain?.token);
  assert.ok(withToken.length >= 8);
  for (const claim of withToken) {
    assert.ok(claim.onChain?.remainingMethod, claim.id);
  }

  const socks = CATALOG.find((c) => c.id === "uniswap-socks");
  assert.equal(socks?.onChain?.token, "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5");
  assert.equal(socks?.onChain?.remainingMethod, "token_total_supply");

  const hop = CATALOG.find((c) => c.id === "hop-protocol-airdrop");
  assert.equal(hop?.onChain?.token, "0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC");
  assert.equal(hop?.onChain?.remainingMethod, "token_balance_of_holder");
  assert.equal(hop?.status, "expired");
  assert.equal(hop?.onChain?.claimDeadline, "2022-12-09");

  const dydx = CATALOG.find((c) => c.id === "dydx-airdrop");
  assert.equal(dydx?.claimability, "unsupported");
  assert.equal(dydx?.onChain?.remainingMethod, "unsupported");
  assert.equal(dydx?.onChain?.distributor, "0x01d3348601968aB85b4bb028979006eac235a588");
  assert.match(dydx?.onChain?.remainingUnsupportedReason ?? "", /no contract code/i);
});

test("safety wording and public health helpers stay conservative", () => {
  assert.match(contentSecurityPolicy("production"), /'none'/);
  assert.deepEqual(Object.keys(publicHealthBody("warn")).sort(), ["ok", "status"]);
});
