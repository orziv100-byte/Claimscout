import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { betaRoot } from "./beta-store.ts";
import { publicOrigin } from "./mail.ts";
import { PLAN_PRICES } from "./plan-config.ts";
import { PAYPAL_SANDBOX_API, PAYPAL_WEBHOOK_EVENTS, paypalSettings } from "./paypal.ts";

export type PaypalJson = Record<string, unknown>;

export type PaypalCatalog = {
  mode: "sandbox";
  productId: string;
  monthlyPlanId: string;
  yearlyPlanId: string;
  webhookId: string | null;
  webhookUrl: string | null;
  updatedAt: string;
};

export type CreateSubscriptionResult = {
  paypalSubscriptionId: string;
  approvalUrl: string;
  paypalPlanId: string;
};

export class PaypalApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PaypalApiError";
    this.status = status;
    this.code = code;
  }
}

type TokenCache = { token: string; expiresAt: number };

let tokenCache: TokenCache | null = null;
let catalogChain: Promise<unknown> = Promise.resolve();

const APPROVAL_HOSTS = new Set(["www.sandbox.paypal.com", "sandbox.paypal.com"]);
const CERT_HOSTS = new Set(["api.sandbox.paypal.com", "api-m.sandbox.paypal.com"]);

function catalogPath(root = betaRoot()) {
  return join(root, "paypal-sandbox-catalog.json");
}

function withCatalogLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = catalogChain.then(fn, fn);
  catalogChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function credentials(env = process.env): { id: string; secret: string } {
  const settings = paypalSettings(env);
  if (settings.liveRequested) {
    throw new PaypalApiError(503, "PAYPAL_LIVE_BLOCKED", "Live PayPal is disabled.");
  }
  const id = env.PAYPAL_CLIENT_ID?.trim() ?? "";
  const secret = env.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) {
    throw new PaypalApiError(503, "PAYPAL_NOT_CONFIGURED", "PayPal Sandbox is not configured.");
  }
  return { id, secret };
}

async function paypalFetch(path: string, init: RequestInit, env = process.env): Promise<{ status: number; json: PaypalJson }> {
  if (!path.startsWith("/")) throw new PaypalApiError(500, "PAYPAL_PATH", "Invalid PayPal path.");
  const url = `${PAYPAL_SANDBOX_API}${path}`;
  const res = await fetch(url, { ...init, redirect: "error" });
  const text = await res.text();
  let json: PaypalJson = {};
  if (text) {
    try {
      json = JSON.parse(text) as PaypalJson;
    } catch {
      json = {};
    }
  }
  return { status: res.status, json };
}

async function accessToken(env = process.env): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;
  const { id, secret } = credentials(env);
  const basic = Buffer.from(`${id}:${secret}`, "utf8").toString("base64");
  const { status, json } = await paypalFetch(
    "/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
    env,
  );
  const token = typeof json.access_token === "string" ? json.access_token : "";
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 0;
  if (status !== 200 || !token) {
    throw new PaypalApiError(503, "PAYPAL_AUTH", "PayPal Sandbox authentication failed.");
  }
  tokenCache = { token, expiresAt: now + Math.max(60, expiresIn) * 1000 };
  return token;
}

async function paypalJson(
  path: string,
  method: string,
  body?: unknown,
  env = process.env,
): Promise<{ status: number; json: PaypalJson }> {
  const token = await accessToken(env);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  return paypalFetch(
    path,
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function paypalApproveUrl(links: unknown): string | null {
  if (!Array.isArray(links)) return null;
  for (const link of links) {
    if (!link || typeof link !== "object") continue;
    const rel = str((link as { rel?: unknown }).rel);
    const href = str((link as { href?: unknown }).href);
    if ((rel === "approve" || rel === "payer-action") && href && isSandboxApprovalUrl(href)) return href;
  }
  return null;
}

export function isSandboxApprovalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && APPROVAL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function isPaypalSandboxCertUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && CERT_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function webhookPublicUrl(env = process.env): string | null {
  const origin = publicOrigin(env);
  if (!origin || !/^https:\/\//i.test(origin)) return null;
  return `${origin}/api/billing/paypal/webhook`;
}

export function billingReturnUrl(env = process.env): string {
  const origin = publicOrigin(env) || "https://poolindex.app";
  return `${origin}/upgrade?billing=paypal-return`;
}

export function billingCancelUrl(env = process.env): string {
  const origin = publicOrigin(env) || "https://poolindex.app";
  return `${origin}/upgrade?billing=paypal-cancel`;
}

export function readPaypalCatalog(root = betaRoot()): PaypalCatalog | null {
  try {
    const parsed = JSON.parse(readFileSync(catalogPath(root), "utf8")) as PaypalCatalog;
    if (parsed.mode !== "sandbox") return null;
    if (!parsed.productId || !parsed.monthlyPlanId || !parsed.yearlyPlanId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePaypalCatalog(catalog: PaypalCatalog, root = betaRoot()): void {
  mkdirSync(root, { recursive: true });
  const dest = catalogPath(root);
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(catalog, null, 2)}\n`);
  renameSync(tmp, dest);
}

async function createProduct(env = process.env): Promise<string> {
  const { status, json } = await paypalJson(
    "/v1/catalogs/products",
    "POST",
    {
      name: "PoolIndex Pro",
      description: "PoolIndex Pro Sandbox subscription",
      type: "SERVICE",
      category: "SOFTWARE",
    },
    env,
  );
  const id = str(json.id);
  if (status >= 300 || !id) throw new PaypalApiError(503, "PAYPAL_PRODUCT", "Could not create PayPal Sandbox product.");
  return id;
}

async function createPlan(
  productId: string,
  interval: "month" | "year",
  env = process.env,
): Promise<string> {
  const monthly = interval === "month";
  const { status, json } = await paypalJson(
    "/v1/billing/plans",
    "POST",
    {
      product_id: productId,
      name: monthly ? "PoolIndex Pro Monthly" : "PoolIndex Pro Yearly",
      billing_cycles: [
        {
          frequency: { interval_unit: monthly ? "MONTH" : "YEAR", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: monthly ? PLAN_PRICES.paid.priceUsd.toFixed(2) : PLAN_PRICES.paid.yearlyUsd.toFixed(2),
              currency_code: "USD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    },
    env,
  );
  const id = str(json.id);
  if (status >= 300 || !id) throw new PaypalApiError(503, "PAYPAL_PLAN", "Could not create PayPal Sandbox plan.");
  return id;
}

async function findWebhookId(url: string, env = process.env): Promise<string | null> {
  const { status, json } = await paypalJson("/v1/notifications/webhooks", "GET", undefined, env);
  if (status >= 300) return null;
  const webhooks = Array.isArray(json.webhooks) ? json.webhooks : [];
  for (const row of webhooks) {
    if (!row || typeof row !== "object") continue;
    const hookUrl = str((row as { url?: unknown }).url);
    const id = str((row as { id?: unknown }).id);
    if (hookUrl === url && id) return id;
  }
  return null;
}

async function createWebhook(url: string, env = process.env): Promise<string | null> {
  const existing = await findWebhookId(url, env);
  if (existing) return existing;
  const { status, json } = await paypalJson(
    "/v1/notifications/webhooks",
    "POST",
    {
      url,
      event_types: PAYPAL_WEBHOOK_EVENTS.map((name) => ({ name })),
    },
    env,
  );
  const id = str(json.id);
  if (id) return id;
  if (status >= 300) return findWebhookId(url, env);
  return null;
}

export async function ensurePaypalSandboxCatalog(env = process.env, root = betaRoot()): Promise<PaypalCatalog> {
  return withCatalogLock(async () => {
    const current = readPaypalCatalog(root);
    const webhookUrl = webhookPublicUrl(env);
    let productId = env.PAYPAL_PRODUCT_ID?.trim() || current?.productId || "";
    let monthlyPlanId = env.PAYPAL_PLAN_MONTHLY_ID?.trim() || current?.monthlyPlanId || "";
    let yearlyPlanId = env.PAYPAL_PLAN_YEARLY_ID?.trim() || current?.yearlyPlanId || "";
    let webhookId = env.PAYPAL_WEBHOOK_ID?.trim() || current?.webhookId || null;
    if (!productId) productId = await createProduct(env);
    if (!monthlyPlanId) monthlyPlanId = await createPlan(productId, "month", env);
    if (!yearlyPlanId) yearlyPlanId = await createPlan(productId, "year", env);
    if (webhookUrl && !webhookId) webhookId = await createWebhook(webhookUrl, env);
    const catalog: PaypalCatalog = {
      mode: "sandbox",
      productId,
      monthlyPlanId,
      yearlyPlanId,
      webhookId,
      webhookUrl,
      updatedAt: new Date().toISOString(),
    };
    writePaypalCatalog(catalog, root);
    return catalog;
  });
}

export async function createPaypalSubscription(input: {
  userId: string;
  interval: "month" | "year";
  env?: NodeJS.ProcessEnv;
  root?: string;
}): Promise<CreateSubscriptionResult> {
  const env = input.env ?? process.env;
  const catalog = await ensurePaypalSandboxCatalog(env, input.root ?? betaRoot());
  const paypalPlanId = input.interval === "year" ? catalog.yearlyPlanId : catalog.monthlyPlanId;
  const { status, json } = await paypalJson(
    "/v1/billing/subscriptions",
    "POST",
    {
      plan_id: paypalPlanId,
      custom_id: input.userId.slice(0, 127),
      application_context: {
        brand_name: "PoolIndex",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: billingReturnUrl(env),
        cancel_url: billingCancelUrl(env),
      },
    },
    env,
  );
  const paypalSubscriptionId = str(json.id);
  const approvalUrl = paypalApproveUrl(json.links);
  if (status >= 300 || !paypalSubscriptionId || !approvalUrl) {
    throw new PaypalApiError(503, "PAYPAL_SUBSCRIBE", "Could not start PayPal Sandbox checkout.");
  }
  return { paypalSubscriptionId, approvalUrl, paypalPlanId };
}

export async function getPaypalSubscription(paypalSubscriptionId: string, env = process.env): Promise<PaypalJson> {
  const id = encodeURIComponent(paypalSubscriptionId);
  const { status, json } = await paypalJson(`/v1/billing/subscriptions/${id}`, "GET", undefined, env);
  if (status >= 300) throw new PaypalApiError(502, "PAYPAL_GET", "Could not read PayPal subscription.");
  return json;
}

export async function cancelPaypalSubscription(paypalSubscriptionId: string, env = process.env): Promise<void> {
  const id = encodeURIComponent(paypalSubscriptionId);
  const { status } = await paypalJson(
    `/v1/billing/subscriptions/${id}/cancel`,
    "POST",
    { reason: "User cancelled in PoolIndex" },
    env,
  );
  if (status >= 300 && status !== 204 && status !== 422) {
    throw new PaypalApiError(502, "PAYPAL_CANCEL", "Could not cancel PayPal subscription.");
  }
}

export async function verifyPaypalWebhook(input: {
  webhookId: string;
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
  webhookEvent: PaypalJson;
  env?: NodeJS.ProcessEnv;
}): Promise<boolean> {
  if (!isPaypalSandboxCertUrl(input.certUrl)) return false;
  const { status, json } = await paypalJson(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: input.authAlgo,
      cert_url: input.certUrl,
      transmission_id: input.transmissionId,
      transmission_sig: input.transmissionSig,
      transmission_time: input.transmissionTime,
      webhook_id: input.webhookId,
      webhook_event: input.webhookEvent,
    },
    input.env,
  );
  return status === 200 && str(json.verification_status) === "SUCCESS";
}

export function resetPaypalTokenCacheForTests() {
  tokenCache = null;
}
