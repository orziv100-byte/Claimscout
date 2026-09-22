import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutAllowed, refuseCheckout } from "./payments.ts";
import { PAYMENT_PROVIDER, PLAN_PRICES, paymentsAreLive } from "./plan-config.ts";

test("checkout is refused while payment provider is none", () => {
  assert.equal(PAYMENT_PROVIDER, "none");
  assert.equal(paymentsAreLive(), false);
  assert.equal(checkoutAllowed(), false);
  const refused = refuseCheckout();
  assert.equal(refused.status, 503);
  assert.equal(refused.code, "PAYMENTS_UNAVAILABLE");
  assert.equal(refused.provider, "none");
  assert.equal(refused.priceUsd, PLAN_PRICES.paid.priceUsd);
  assert.equal(refused.yearlyUsd, 99);
  assert.match(refused.error, /unavailable/i);
});
