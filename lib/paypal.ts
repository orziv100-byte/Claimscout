/**
 * PayPal Sandbox settings only. Credentials live in gitignored `.env`.
 * Never log PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET. Live stays off.
 */

export type PaypalMode = "sandbox";

export type PaypalSettings = {
  mode: PaypalMode;
  credentialsPresent: boolean;
  liveRequested: boolean;
  chargesEnabled: boolean;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function paypalSettings(env: NodeJS.ProcessEnv = process.env): PaypalSettings {
  const requested = (env.PAYPAL_ENV || "sandbox").trim().toLowerCase();
  const credentialsPresent = hasValue(env.PAYPAL_CLIENT_ID) && hasValue(env.PAYPAL_CLIENT_SECRET);
  const liveRequested = requested === "live";
  return {
    mode: "sandbox",
    credentialsPresent,
    liveRequested,
    chargesEnabled: credentialsPresent && !liveRequested,
  };
}

/** Sandbox checkout only. Live env never opens charges. */
export function paypalChargesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return paypalSettings(env).chargesEnabled;
}

export const PAYPAL_SANDBOX_API = "https://api-m.sandbox.paypal.com";
export const PAYPAL_WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.DENIED",
] as const;

export type PaypalWebhookEventName = (typeof PAYPAL_WEBHOOK_EVENTS)[number];
