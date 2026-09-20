import assert from "node:assert/strict";
import { test } from "node:test";
import { bindWallet, capSources, paidSourceCoverage, PLANS, sourceAccess } from "./plan.ts";

test("free plan is catalog + GitHub and one wallet", () => {
  assert.deepEqual([...PLANS.free.sources], ["catalog", "github"]);
  assert.equal(PLANS.free.maxWallets, 1);
  assert.equal(PLANS.free.priceUsd, 0);
});

test("paid plan is $40, five wallets, and about 70% of scan sources", () => {
  const coverage = paidSourceCoverage();
  assert.equal(PLANS.paid.name, "PoolIndex Pro");
  assert.equal(PLANS.paid.priceUsd, 40);
  assert.equal(PLANS.paid.maxWallets, 5);
  assert.equal(coverage.used, 4);
  assert.equal(coverage.total, 6);
  assert.ok(coverage.percent >= 66 && coverage.percent <= 70);
  assert.equal(sourceAccess("paid", "wayback"), "allowed");
  assert.equal(sourceAccess("free", "wayback"), "upgrade");
  assert.equal(sourceAccess("paid", "reddit"), "reserved");
});

test("capSources drops upgrade and reserved sources instead of scanning them", () => {
  const free = capSources("free", [...PLANS.free.sources, "wayback", "reddit"]);
  assert.deepEqual(free.allowed, ["catalog", "github"]);
  assert.deepEqual(free.locked, ["wayback"]);
  assert.deepEqual(free.reserved, ["reddit"]);
  assert.equal(free.capped, true);

  const paid = capSources("paid");
  assert.deepEqual(paid.allowed, [...PLANS.paid.sources]);
  assert.ok(paid.reserved.includes("reddit"));
  assert.ok(paid.reserved.includes("bitcointalk"));
});

test("bindWallet locks the first free address and allows five paid slots", () => {
  const first = bindWallet([], 1, "0x1111111111111111111111111111111111111111");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = bindWallet(first.wallets, 1, "0x2222222222222222222222222222222222222222");
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.code, "WALLET_LIMIT");

  let wallets: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const bound = bindWallet(wallets, 5, `0x${String(i).repeat(40)}`);
    assert.equal(bound.ok, true);
    if (bound.ok) wallets = bound.wallets;
  }
  const sixth = bindWallet(wallets, 5, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(sixth.ok, false);
});
