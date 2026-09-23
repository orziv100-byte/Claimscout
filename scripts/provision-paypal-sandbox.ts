import { readFileSync } from "node:fs";
import { ensurePaypalSandboxCatalog, webhookPublicUrl } from "../lib/paypal-api.ts";
import { PAYPAL_WEBHOOK_EVENTS, paypalSettings } from "../lib/paypal.ts";

function loadDotEnv() {
  try {
    for (const raw of readFileSync(".env", "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* gitignored .env may be absent in tests */
  }
}

loadDotEnv();

async function main() {
  const settings = paypalSettings();
  const catalog = await ensurePaypalSandboxCatalog();
  console.log(
    JSON.stringify({
      mode: settings.mode,
      liveRequested: settings.liveRequested,
      credentialsPresent: settings.credentialsPresent,
      chargesEnabled: settings.chargesEnabled,
      productSet: Boolean(catalog.productId),
      monthlyPlanSet: Boolean(catalog.monthlyPlanId),
      yearlyPlanSet: Boolean(catalog.yearlyPlanId),
      webhookIdSet: Boolean(catalog.webhookId),
      webhookUrl: catalog.webhookUrl || webhookPublicUrl(),
      events: [...PAYPAL_WEBHOOK_EVENTS],
    }),
  );
}

void main();
