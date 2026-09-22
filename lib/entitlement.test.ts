import assert from "node:assert/strict";
import { test } from "node:test";
import { gateWallet, parseEntitlement, serializeEntitlement } from "./entitlement.ts";

test("public runtime refuses the GitHub-known plan secret so a Pro cookie cannot be forged from source", () => {
  const prevNode = process.env.NODE_ENV;
  const prevPlan = process.env.POOLINDEX_PLAN_SECRET;
  try {
    process.env.NODE_ENV = "production";
    process.env.POOLINDEX_PLAN_SECRET = "dev-only-poolindex-plan-secret";
    const forged = serializeEntitlement({ plan: "paid", wallets: ["0xabc"] });
    const parsed = parseEntitlement(forged);
    assert.equal(parsed.plan, "free");
    assert.equal(parsed.wallets.length, 0);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevPlan === undefined) delete process.env.POOLINDEX_PLAN_SECRET;
    else process.env.POOLINDEX_PLAN_SECRET = prevPlan;
  }
});

test("local tests still round-trip a signed entitlement cookie", () => {
  const prevNode = process.env.NODE_ENV;
  const prevPlan = process.env.POOLINDEX_PLAN_SECRET;
  try {
    process.env.NODE_ENV = "test";
    process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
    const raw = serializeEntitlement({ plan: "paid", wallets: ["0xabc"] });
    const parsed = parseEntitlement(raw);
    assert.equal(parsed.plan, "paid");
    assert.deepEqual(parsed.wallets, ["0xabc"]);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevPlan === undefined) delete process.env.POOLINDEX_PLAN_SECRET;
    else process.env.POOLINDEX_PLAN_SECRET = prevPlan;
  }
});

test("operator email can bind a sixth public wallet; other Pro accounts cannot", () => {
  const five = [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555",
  ];
  const extra = "0x6666666666666666666666666666666666666666";
  const blocked = gateWallet({ plan: "paid", wallets: five }, extra, "other@example.com");
  assert.equal(blocked.ok, false);
  const allowed = gateWallet({ plan: "paid", wallets: five }, extra, "orziv100@gmail.com");
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.entitlement.wallets.length, 6);
});

test("Free gateWallet replaces the single bound address instead of 402", () => {
  const next = "0x2222222222222222222222222222222222222222";
  const swapped = gateWallet({ plan: "free", wallets: ["0x1111111111111111111111111111111111111111"] }, next, "free@example.com");
  assert.equal(swapped.ok, true);
  if (swapped.ok) assert.deepEqual(swapped.entitlement.wallets, [next]);
});
