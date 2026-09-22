/**
 * PayPal Sandbox settings only. Credentials live in gitignored `.env`.
 * Never log PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET. Live and charges stay off
 * until an explicit follow-up enables them.
 */

export type PaypalMode = "sandbox";

export type PaypalSettings = {
  mode: PaypalMode;
  credentialsPresent: boolean;
  liveRequested: boolean;
  chargesEnabled: false;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function paypalSettings(env: NodeJS.ProcessEnv = process.env): PaypalSettings {
  const requested = (env.PAYPAL_ENV || "sandbox").trim().toLowerCase();
  return {
    mode: "sandbox",
    credentialsPresent: hasValue(env.PAYPAL_CLIENT_ID) && hasValue(env.PAYPAL_CLIENT_SECRET),
    liveRequested: requested === "live",
    chargesEnabled: false,
  };
}

/** True only after a later, explicit enablement. Sandbox keys alone do not open checkout. */
export function paypalChargesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return paypalSettings(env).chargesEnabled;
}
