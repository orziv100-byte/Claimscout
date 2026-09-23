import assert from "node:assert/strict";
import { test } from "node:test";
import { bindWallet, capSources, formatWalletCap, maxWalletsFor, MONITOR_WALLET_CAP, OPERATOR_WALLET_CHECK_CAP, paidSourceCoverage, PLANS, sourceAccess } from "./plan.ts";
import { CREDIT_AUTHORITY, dailyMonitorPolicy, PAYMENT_PROVIDER, PLAN_POLICY, PLAN_PRICES } from "./plan-config.ts";

test("free plan is one wallet, catalog + GitHub, and never paywalls names", () => {
  assert.deepEqual([...PLANS.free.sources], ["catalog", "github"]);
  assert.equal(PLANS.free.maxWallets, 1);
  assert.equal(PLANS.free.priceUsd, 0);
  assert.match(PLANS.free.summary, /never hidden behind payment/i);
  assert.equal(dailyMonitorPolicy("free"), "opt-in");
  assert.equal(PLAN_POLICY.free.maxWallets, 1);
  assert.equal(CREDIT_AUTHORITY, "server");
  assert.equal(PAYMENT_PROVIDER, "paypal");
  assert.equal(PLAN_PRICES.paid.priceUsd, 20);
  assert.equal(PLAN_PRICES.paid.yearlyUsd, 99);
});

test("paid plan is $20/month or $99/year, five wallets, alerts and archive — not pay-to-reveal", () => {
  const coverage = paidSourceCoverage();
  assert.equal(PLANS.paid.name, "PoolIndex Pro");
  assert.equal(PLANS.paid.priceUsd, 20);
  assert.equal(PLANS.paid.yearlyUsd, 99);
  assert.equal(PLANS.paid.maxWallets, 5);
  assert.match(PLANS.paid.summary, /Finding names stay free/);
  assert.match(PLANS.paid.summary, /PayPal Sandbox/);
  assert.equal(coverage.used, 4);
  assert.equal(coverage.total, 6);
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

test("bindWallet lets Free replace the single slot and still caps Pro at five", () => {
  const first = bindWallet([], 1, "0x1111111111111111111111111111111111111111");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const blocked = bindWallet(first.wallets, 1, "0x2222222222222222222222222222222222222222");
  assert.equal(blocked.ok, false);
  const replaced = bindWallet(first.wallets, 1, "0x2222222222222222222222222222222222222222", {
    replaceAtCap: true,
  });
  assert.equal(replaced.ok, true);
  if (replaced.ok) {
    assert.equal(replaced.replaced, true);
    assert.deepEqual(replaced.wallets, ["0x2222222222222222222222222222222222222222"]);
  }

  let wallets: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const bound = bindWallet(wallets, 5, `0x${String(i).repeat(40)}`);
    assert.equal(bound.ok, true);
    if (bound.ok) wallets = bound.wallets;
  }
  const sixth = bindWallet(wallets, 5, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(sixth.ok, false);
});

test("operator unlimited-wallet emails raise the check cap without changing product Pro", () => {
  const env = { POOLINDEX_UNLIMITED_WALLET_EMAILS: "extra-qa@example.com" };
  assert.equal(PLANS.paid.maxWallets, 5);
  assert.equal(maxWalletsFor("paid", "other@example.com", env), 5);
  assert.equal(maxWalletsFor("paid", "orziv100@gmail.com", {}), OPERATOR_WALLET_CHECK_CAP);
  assert.equal(maxWalletsFor("paid", "extra-qa@example.com", env), OPERATOR_WALLET_CHECK_CAP);
  assert.equal(formatWalletCap(OPERATOR_WALLET_CHECK_CAP), "unlimited");
  assert.equal(MONITOR_WALLET_CAP, 5);

  let wallets: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const bound = bindWallet(wallets, maxWalletsFor("paid", "orziv100@gmail.com", {}), `0x${String(i).repeat(40)}`);
    assert.equal(bound.ok, true);
    if (bound.ok) wallets = bound.wallets;
  }
  assert.equal(wallets.length, 6);
});
