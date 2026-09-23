import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogHasAddressLookup, COVERAGE_BILLING, COVERAGE_FEATURE_NAME, listCoverageRequests } from "./coverage.ts";

test("Request Coverage lists unhosted merkle programs and never sells Eligible", () => {
  assert.equal(COVERAGE_FEATURE_NAME, "Request Coverage");
  assert.equal(COVERAGE_BILLING.purchaseAvailable, false);
  assert.match(COVERAGE_BILLING.doesNotBuy, /Eligible/);
  assert.match(COVERAGE_BILLING.brokenSources, /not a paid add-on/i);

  const rows = listCoverageRequests();
  const ids = new Set(rows.map((row) => row.catalogId));
  for (const id of [
    "1inch-airdrop",
    "blur-airdrop",
    "layerzero-airdrop",
    "gitcoin-gtc-airdrop",
    "safe-token-airdrop",
    "dydx-airdrop",
  ]) {
    assert.equal(ids.has(id), true, id);
    assert.equal(catalogHasAddressLookup(id), false);
  }
  assert.equal(ids.has("uniswap-uni-airdrop"), false);
  assert.equal(catalogHasAddressLookup("uniswap-uni-airdrop"), true);
  assert.equal(
    rows.find((row) => row.catalogId === "1inch-airdrop")?.reason,
    "unhosted_merkle",
  );
  assert.ok(rows.every((row) => row.status === "queued"));
});

test("product copy does not sell fixing broken sources", () => {
  const page = readFileSync(new URL("../../app/coverage/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Request Coverage/);
  assert.match(page, /does not buy Eligible/i);
  assert.doesNotMatch(page, /Fix broken sources/);
  assert.doesNotMatch(page, /buy now|purchase now|subscribe now/i);
  const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /isAppPath/);
  const surfaces = readFileSync(new URL("../site-surface.ts", import.meta.url), "utf8");
  assert.match(surfaces, /"\/coverage"/);
});
