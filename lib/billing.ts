import { mutateBetaState, readBetaState } from "./beta-store.ts";
import type { BillingInterval, BillingStatus, PaypalWebhookReceipt, SubscriptionRecord } from "./beta-types.ts";
import { BILLING_STATUSES } from "./beta-types.ts";
import { newId } from "./password.ts";
import { PAYMENT_PROVIDER, PLAN_PRICES } from "./plan-config.ts";
import type { PlanId } from "./plan.ts";
import { checkoutAllowed } from "./payments.ts";
import {
  cancelPaypalSubscription,
  createPaypalSubscription,
  getPaypalSubscription,
  isSandboxApprovalUrl,
  PaypalApiError,
  readPaypalCatalog,
  verifyPaypalWebhook,
  type PaypalJson,
} from "./paypal-api.ts";
import { paypalSettings } from "./paypal.ts";

const RECEIPT_CAP = 2000;

export type PublicSubscription = {
  paypalSubscriptionId: string;
  plan: "paid";
  interval: BillingInterval;
  status: BillingStatus;
  createdAt: string;
  updatedAt: string;
  nextBillingAt: string | null;
  approvalUrl: string | null;
};

export type AccessKind =
  | "unverified"
  | "trial"
  | "pending"
  | "active"
  | "cancelled"
  | "suspended"
  | "expired"
  | "payment_failed";

export const ACCESS_LABELS: Record<AccessKind, string> = {
  unverified: "Email verification required",
  trial: "Trial (Closed Beta free access)",
  pending: "Pending",
  active: "Active",
  cancelled: "Cancelled",
  suspended: "Suspended",
  expired: "Expired",
  payment_failed: "Payment failed",
};

export type BillingStatusResponse = {
  ok: true;
  provider: typeof PAYMENT_PROVIDER;
  mode: "sandbox";
  live: false;
  checkoutEnabled: boolean;
  plan: PlanId;
  access: AccessKind;
  accessLabel: string;
  subscription: PublicSubscription | null;
  prices: { monthlyUsd: number; yearlyUsd: number };
};

export function accessKindForUser(userId: string): AccessKind {
  const user = readBetaState().users.find((row) => row.id === userId);
  if (!user || user.status === "pending_verification") return "unverified";
  const sub = currentSubscription(userId);
  if (!sub) return "trial";
  if (sub.status === "active") return "active";
  if (sub.status === "pending") return "pending";
  if (sub.status === "cancelled") return "cancelled";
  if (sub.status === "suspended") return "suspended";
  if (sub.status === "expired") return "expired";
  return "payment_failed";
}

export function mapPaypalSubscriptionStatus(raw: string | null | undefined): BillingStatus {
  switch ((raw || "").trim().toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "CANCELLED":
    case "CANCELED":
      return "cancelled";
    case "SUSPENDED":
      return "suspended";
    case "EXPIRED":
      return "expired";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "pending";
    default:
      return "pending";
  }
}

export function entitlementPlanForBilling(status: BillingStatus): PlanId {
  return status === "active" ? "paid" : "free";
}

export function publicSubscription(row: SubscriptionRecord): PublicSubscription {
  return {
    paypalSubscriptionId: row.paypalSubscriptionId,
    plan: row.plan,
    interval: row.interval,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    nextBillingAt: row.nextBillingAt,
    approvalUrl: row.status === "pending" && row.approvalUrl && isSandboxApprovalUrl(row.approvalUrl) ? row.approvalUrl : null,
  };
}

export function userPlanFromStore(userId: string, fallback: PlanId): PlanId {
  return readBetaState().users.find((row) => row.id === userId)?.plan ?? fallback;
}

export function billingStatusForUser(userId: string, plan: PlanId = userPlanFromStore(userId, "free"), env = process.env): BillingStatusResponse {
  const sub = currentSubscription(userId);
  const access = accessKindForUser(userId);
  return {
    ok: true,
    provider: PAYMENT_PROVIDER,
    mode: "sandbox",
    live: false,
    checkoutEnabled: checkoutAllowed(env),
    plan,
    access,
    accessLabel: ACCESS_LABELS[access],
    subscription: sub ? publicSubscription(sub) : null,
    prices: { monthlyUsd: PLAN_PRICES.paid.priceUsd, yearlyUsd: PLAN_PRICES.paid.yearlyUsd },
  };
}

export function currentSubscription(userId: string): SubscriptionRecord | null {
  const rows = readBetaState().subscriptions.filter((row) => row.userId === userId);
  const ranked = [...rows].sort((a, b) => rankStatus(b.status) - rankStatus(a.status) || b.updatedAt.localeCompare(a.updatedAt));
  return ranked[0] ?? null;
}

function rankStatus(status: BillingStatus): number {
  if (status === "active") return 5;
  if (status === "pending") return 4;
  if (status === "payment_failed") return 3;
  if (status === "suspended") return 2;
  return 1;
}

function nextBillingFromResource(resource: PaypalJson): string | null {
  const info = resource.billing_info;
  if (info && typeof info === "object") {
    const next = (info as { next_billing_time?: unknown }).next_billing_time;
    if (typeof next === "string" && next) return next;
  }
  const next = resource.next_billing_time;
  return typeof next === "string" && next ? next : null;
}

function applyUserPlan(state: { users: { id: string; plan: PlanId }[] }, userId: string, status: BillingStatus) {
  const user = state.users.find((row) => row.id === userId);
  if (!user) return;
  user.plan = entitlementPlanForBilling(status);
}

function upsertSubscription(
  state: { users: { id: string; plan: PlanId }[]; subscriptions: SubscriptionRecord[] },
  patch: {
    id?: string;
    createdAt?: string;
    userId: string;
    paypalSubscriptionId: string;
    paypalPlanId: string;
    interval: BillingInterval;
    status: BillingStatus;
    nextBillingAt: string | null;
    approvalUrl: string | null;
    lastPaypalEventId: string | null;
  },
): SubscriptionRecord {
  const now = new Date().toISOString();
  const existing =
    state.subscriptions.find((row) => row.paypalSubscriptionId === patch.paypalSubscriptionId) ||
    (patch.id ? state.subscriptions.find((row) => row.id === patch.id) : undefined);
  if (existing) {
    existing.userId = patch.userId;
    existing.paypalPlanId = patch.paypalPlanId || existing.paypalPlanId;
    existing.interval = patch.interval;
    existing.status = patch.status;
    existing.updatedAt = now;
    existing.nextBillingAt = patch.nextBillingAt;
    existing.approvalUrl = patch.approvalUrl;
    existing.lastPaypalEventId = patch.lastPaypalEventId;
    applyUserPlan(state, existing.userId, existing.status);
    return existing;
  }
  const row: SubscriptionRecord = {
    id: patch.id || newId(),
    userId: patch.userId,
    paypalSubscriptionId: patch.paypalSubscriptionId,
    paypalPlanId: patch.paypalPlanId,
    plan: "paid",
    interval: patch.interval,
    status: patch.status,
    createdAt: patch.createdAt || now,
    updatedAt: now,
    nextBillingAt: patch.nextBillingAt,
    approvalUrl: patch.approvalUrl,
    lastPaypalEventId: patch.lastPaypalEventId,
  };
  state.subscriptions.push(row);
  applyUserPlan(state, row.userId, row.status);
  return row;
}

export async function startSandboxCheckout(input: {
  userId: string;
  interval: BillingInterval;
}): Promise<{ approvalUrl: string; subscription: PublicSubscription }> {
  if (!checkoutAllowed()) {
    throw new PaypalApiError(503, "PAYMENTS_UNAVAILABLE", "PayPal Sandbox checkout is not available.");
  }
  if (input.interval !== "month" && input.interval !== "year") {
    throw new PaypalApiError(400, "INVALID_INTERVAL", "Choose monthly or yearly.");
  }
  const existing = currentSubscription(input.userId);
  if (existing?.status === "active") {
    throw new PaypalApiError(409, "ALREADY_SUBSCRIBED", "This account already has an active PoolIndex Pro subscription.");
  }
  if (existing?.status === "pending" && existing.approvalUrl && isSandboxApprovalUrl(existing.approvalUrl)) {
    return { approvalUrl: existing.approvalUrl, subscription: publicSubscription(existing) };
  }
  const created = await createPaypalSubscription({ userId: input.userId, interval: input.interval });
  const row = mutateBetaState((state) =>
    upsertSubscription(state, {
      userId: input.userId,
      paypalSubscriptionId: created.paypalSubscriptionId,
      paypalPlanId: created.paypalPlanId,
      interval: input.interval,
      status: "pending",
      nextBillingAt: null,
      approvalUrl: created.approvalUrl,
      lastPaypalEventId: null,
    }),
  );
  return { approvalUrl: created.approvalUrl, subscription: publicSubscription(row) };
}

export async function syncUserSubscription(userId: string): Promise<PublicSubscription | null> {
  const existing = currentSubscription(userId);
  if (!existing) return null;
  const remote = await getPaypalSubscription(existing.paypalSubscriptionId);
  const customId = typeof remote.custom_id === "string" ? remote.custom_id : "";
  if (customId && customId !== userId) {
    throw new PaypalApiError(409, "SUBSCRIPTION_MISMATCH", "PayPal subscription is not linked to this PoolIndex user.");
  }
  const status = mapPaypalSubscriptionStatus(typeof remote.status === "string" ? remote.status : existing.status);
  const row = mutateBetaState((state) =>
    upsertSubscription(state, {
      id: existing.id,
      userId,
      paypalSubscriptionId: existing.paypalSubscriptionId,
      paypalPlanId: existing.paypalPlanId,
      interval: existing.interval,
      status,
      nextBillingAt: nextBillingFromResource(remote),
      approvalUrl: existing.approvalUrl,
      lastPaypalEventId: existing.lastPaypalEventId,
    }),
  );
  return publicSubscription(row);
}

export async function cancelUserSubscription(userId: string): Promise<PublicSubscription | null> {
  const existing = currentSubscription(userId);
  if (!existing) return null;
  if (existing.status === "cancelled" || existing.status === "expired") return publicSubscription(existing);
  await cancelPaypalSubscription(existing.paypalSubscriptionId);
  try {
    return await syncUserSubscription(userId);
  } catch {
    const row = mutateBetaState((state) =>
      upsertSubscription(state, {
        id: existing.id,
        userId,
        paypalSubscriptionId: existing.paypalSubscriptionId,
        paypalPlanId: existing.paypalPlanId,
        interval: existing.interval,
        status: "cancelled",
        nextBillingAt: existing.nextBillingAt,
        approvalUrl: null,
        lastPaypalEventId: existing.lastPaypalEventId,
      }),
    );
    return publicSubscription(row);
  }
}

function webhookSubscriptionId(eventType: string, resource: PaypalJson): string | null {
  if (eventType.startsWith("BILLING.SUBSCRIPTION.") && typeof resource.id === "string") return resource.id;
  if (typeof resource.billing_agreement_id === "string") return resource.billing_agreement_id;
  return typeof resource.id === "string" ? resource.id : null;
}

function statusFromEvent(eventType: string, resource: PaypalJson, fallback: BillingStatus): BillingStatus {
  if (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" || eventType === "PAYMENT.SALE.DENIED") return "payment_failed";
  if (eventType === "PAYMENT.SALE.COMPLETED") return "active";
  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") return "active";
  if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") return "cancelled";
  if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") return "suspended";
  if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") return "expired";
  if (eventType === "BILLING.SUBSCRIPTION.CREATED") return "pending";
  if (typeof resource.status === "string") return mapPaypalSubscriptionStatus(resource.status);
  return fallback;
}

function rememberReceipt(receipts: PaypalWebhookReceipt[], id: string, eventType: string): boolean {
  if (receipts.some((row) => row.id === id)) return false;
  receipts.push({ id, eventType, at: new Date().toISOString() });
  if (receipts.length > RECEIPT_CAP) receipts.splice(0, receipts.length - RECEIPT_CAP);
  return true;
}

export function applyVerifiedPaypalEvent(event: PaypalJson): { duplicate: boolean; applied: boolean } {
  const eventId = typeof event.id === "string" ? event.id : "";
  const eventType = typeof event.event_type === "string" ? event.event_type : "";
  const resource = event.resource && typeof event.resource === "object" ? (event.resource as PaypalJson) : {};
  if (!eventId || !eventType) return { duplicate: false, applied: false };
  return mutateBetaState((state) => {
    if (!rememberReceipt(state.paypalWebhookReceipts, eventId, eventType)) {
      return { duplicate: true, applied: false };
    }
    const paypalSubscriptionId = webhookSubscriptionId(eventType, resource);
    if (!paypalSubscriptionId) return { duplicate: false, applied: false };
    const customId = typeof resource.custom_id === "string" ? resource.custom_id : "";
    const existing = state.subscriptions.find((row) => row.paypalSubscriptionId === paypalSubscriptionId);
    const userId = existing?.userId || (customId && state.users.some((user) => user.id === customId) ? customId : "");
    if (!userId) return { duplicate: false, applied: false };
    if (customId && customId !== userId) return { duplicate: false, applied: false };
    const interval: BillingInterval = existing?.interval || "month";
    const status = statusFromEvent(eventType, resource, existing?.status || "pending");
    if (!BILLING_STATUSES.includes(status)) return { duplicate: false, applied: false };
    upsertSubscription(state, {
      id: existing?.id,
      userId,
      paypalSubscriptionId,
      paypalPlanId: existing?.paypalPlanId || "",
      interval,
      status,
      nextBillingAt: nextBillingFromResource(resource) ?? existing?.nextBillingAt ?? null,
      approvalUrl: status === "pending" ? existing?.approvalUrl ?? null : null,
      lastPaypalEventId: eventId,
    });
    return { duplicate: false, applied: true };
  });
}

export async function handlePaypalWebhookRequest(request: Request): Promise<{ ok: true; duplicate?: boolean } | { ok: false; status: number; code: string; error: string }> {
  if (paypalSettings().liveRequested) {
    return { ok: false, status: 503, code: "PAYPAL_LIVE_BLOCKED", error: "Live PayPal is disabled." };
  }
  const raw = await request.text();
  let event: PaypalJson;
  try {
    event = JSON.parse(raw) as PaypalJson;
  } catch {
    return { ok: false, status: 400, code: "INVALID_JSON", error: "Invalid webhook body." };
  }
  const catalog = readPaypalCatalog();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() || catalog?.webhookId || "";
  if (!webhookId) {
    return { ok: false, status: 503, code: "WEBHOOK_NOT_REGISTERED", error: "PayPal webhook is not registered." };
  }
  const transmissionId = request.headers.get("paypal-transmission-id") || "";
  const transmissionTime = request.headers.get("paypal-transmission-time") || "";
  const transmissionSig = request.headers.get("paypal-transmission-sig") || "";
  const certUrl = request.headers.get("paypal-cert-url") || "";
  const authAlgo = request.headers.get("paypal-auth-algo") || "";
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return { ok: false, status: 400, code: "WEBHOOK_HEADERS", error: "Missing PayPal webhook headers." };
  }
  const verified = await verifyPaypalWebhook({
    webhookId,
    transmissionId,
    transmissionTime,
    transmissionSig,
    certUrl,
    authAlgo,
    webhookEvent: event,
  });
  if (!verified) {
    return { ok: false, status: 401, code: "WEBHOOK_INVALID", error: "PayPal webhook signature was rejected." };
  }
  const result = applyVerifiedPaypalEvent(event);
  return result.duplicate ? { ok: true, duplicate: true } : { ok: true };
}
