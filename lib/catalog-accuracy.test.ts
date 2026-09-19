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
  assert.ok(rows.length >= 5);
  for (const claim of rows) {
    assert.equal(claim.claimability, "unclaimed_contract_balance_only", claim.id);
    assert.ok(claim.warnings.includes(CONTRACT_BALANCE_NOT_CLAIMABLE), claim.id);
    assert.doesNotMatch(
      `${claim.summary} ${claim.howToVerify}`.toLowerCase(),
      /remained claimable|still claimable|remaining (tokens|balance).{0,20}can claim/,
    );
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

test("safety wording and public health helpers stay conservative", () => {
  assert.match(contentSecurityPolicy("production"), /'none'/);
  assert.deepEqual(Object.keys(publicHealthBody("warn")).sort(), ["ok", "status"]);
});
