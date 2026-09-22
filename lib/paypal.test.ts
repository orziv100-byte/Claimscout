import assert from "node:assert/strict";
import { test } from "node:test";
import { paypalChargesAllowed, paypalSettings } from "./paypal.ts";
import { checkoutAllowed } from "./payments.ts";
import { PAYMENT_PROVIDER } from "./plan-config.ts";

test("PayPal stays sandbox with charges off even if live is requested", () => {
  const sandbox = paypalSettings({
    PAYPAL_ENV: "sandbox",
    PAYPAL_CLIENT_ID: "sandbox-id",
    PAYPAL_CLIENT_SECRET: "sandbox-secret",
  });
  assert.equal(sandbox.mode, "sandbox");
  assert.equal(sandbox.credentialsPresent, true);
  assert.equal(sandbox.liveRequested, false);
  assert.equal(sandbox.chargesEnabled, false);
  assert.equal(paypalChargesAllowed({ PAYPAL_ENV: "sandbox" }), false);

  const liveAttempt = paypalSettings({ PAYPAL_ENV: "live", PAYPAL_CLIENT_ID: "x", PAYPAL_CLIENT_SECRET: "y" });
  assert.equal(liveAttempt.mode, "sandbox");
  assert.equal(liveAttempt.liveRequested, true);
  assert.equal(liveAttempt.chargesEnabled, false);

  const dumped = JSON.stringify(sandbox);
  assert.equal(dumped.includes("sandbox-id"), false);
  assert.equal(dumped.includes("sandbox-secret"), false);
});

test("checkout stays refused while PayPal Sandbox is only configured", () => {
  assert.equal(PAYMENT_PROVIDER, "none");
  assert.equal(checkoutAllowed(), false);
});
