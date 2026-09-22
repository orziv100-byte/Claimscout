import { APP_VERSION } from "./app-info.ts";
import { PAYMENT_PROVIDER, PLAN_PRICES, paymentsAreLive } from "./plan-config.ts";

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

/** No PayPal/Stripe/MoR charges while provider is none. Sandbox keys in `.env` do not open checkout. */
export function refuseCheckout(): CheckoutRefusal {
  return {
    ok: false,
    status: 503,
    code: "PAYMENTS_UNAVAILABLE",
    error:
      PAYMENT_PROVIDER === "none"
        ? "Payment processing is unavailable. PoolIndex Pro price is configured but no merchant is connected."
        : "Checkout is not wired yet for this provider. No charges were attempted.",
    version: APP_VERSION,
    provider: PAYMENT_PROVIDER,
    priceUsd: PLAN_PRICES.paid.priceUsd,
    yearlyUsd: PLAN_PRICES.paid.yearlyUsd,
  };
}

export function checkoutAllowed(): boolean {
  return paymentsAreLive();
}
