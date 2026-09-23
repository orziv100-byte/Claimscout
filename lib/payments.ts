import { APP_VERSION } from "./app-info.ts";
import { PAYMENT_PROVIDER, PLAN_PRICES } from "./plan-config.ts";
import { paypalSettings } from "./paypal.ts";

export type CheckoutRefusal = {
  ok: false;
  status: 503;
  code: "PAYMENTS_UNAVAILABLE";
  error: string;
  version: string;
  provider: typeof PAYMENT_PROVIDER;
  priceUsd: number;
  yearlyUsd: number;
};

export function refuseCheckout(): CheckoutRefusal {
  const settings = paypalSettings();
  let error = "Payment processing is unavailable.";
  if (PAYMENT_PROVIDER !== "paypal") {
    error = "Payment processing is unavailable. PoolIndex Pro price is configured but no merchant is connected.";
  } else if (settings.liveRequested) {
    error = "Live PayPal is disabled. Sandbox only.";
  } else if (!settings.credentialsPresent) {
    error = "PayPal Sandbox credentials are not configured.";
  } else {
    error = "PayPal Sandbox checkout is not available.";
  }
  return {
    ok: false,
    status: 503,
    code: "PAYMENTS_UNAVAILABLE",
    error,
    version: APP_VERSION,
    provider: PAYMENT_PROVIDER,
    priceUsd: PLAN_PRICES.paid.priceUsd,
    yearlyUsd: PLAN_PRICES.paid.yearlyUsd,
  };
}

export function checkoutAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (PAYMENT_PROVIDER !== "paypal") return false;
  const settings = paypalSettings(env);
  return settings.chargesEnabled;
}
