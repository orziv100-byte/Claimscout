import assert from "node:assert/strict";
import { test } from "node:test";
import { readRemainingPool } from "./onchain.ts";

test("dYdX remaining pool is Unsupported without calling generic balanceOf", async () => {
  const row = await readRemainingPool("dydx-airdrop");
  assert.equal(row.remaining, undefined);
  assert.match(row.error ?? "", /Unsupported/);
  assert.match(row.error ?? "", /no contract code/i);
  assert.doesNotMatch(row.error ?? "", /balanceOf/);
});
