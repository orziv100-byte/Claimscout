import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { registerAccount, DEV_INVITE } from "./auth.ts";
import { applyVerifiedPaypalEvent, accessKindForUser, billingStatusForUser, entitlementPlanForBilling, mapPaypalSubscriptionStatus } from "./billing.ts";
import { mutateBetaState, readBetaState } from "./beta-store.ts";
import { isPaypalSandboxCertUrl, paypalApproveUrl } from "./paypal-api.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-billing-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "billing-admin@example.com";
process.env.NODE_ENV = "test";

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("PayPal status maps to billing states and only ACTIVE grants Pro", () => {
  assert.equal(mapPaypalSubscriptionStatus("ACTIVE"), "active");
  assert.equal(mapPaypalSubscriptionStatus("CANCELLED"), "cancelled");
  assert.equal(mapPaypalSubscriptionStatus("SUSPENDED"), "suspended");
  assert.equal(mapPaypalSubscriptionStatus("EXPIRED"), "expired");
  assert.equal(mapPaypalSubscriptionStatus("APPROVAL_PENDING"), "pending");
  assert.equal(entitlementPlanForBilling("active"), "paid");
  assert.equal(entitlementPlanForBilling("pending"), "free");
  assert.equal(entitlementPlanForBilling("payment_failed"), "free");
  assert.equal(entitlementPlanForBilling("cancelled"), "free");
});

test("sandbox approve/cert URLs reject live hosts", () => {
  assert.equal(
    paypalApproveUrl([{ rel: "approve", href: "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=test" }]),
    "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=test",
  );
  assert.equal(paypalApproveUrl([{ rel: "approve", href: "https://www.paypal.com/checkout" }]), null);
  assert.equal(isPaypalSandboxCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/foo"), true);
  assert.equal(isPaypalSandboxCertUrl("https://api.paypal.com/v1/notifications/certs/foo"), false);
});

test("verified webhook is linked to PoolIndex user id and is idempotent", async () => {
  const created = await registerAccount({
    email: "sub@example.com",
    password: "correct-battery-staple",
    displayName: "Sub User",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  assert.equal(accessKindForUser(created.user.id), "unverified");
  mutateBetaState((state) => {
    const live = state.users.find((row) => row.id === created.user.id);
    if (!live) throw new Error("missing user");
    live.status = "active";
    live.emailVerifiedAt = new Date().toISOString();
    return live;
  });
  assert.equal(accessKindForUser(created.user.id), "trial");
  const event = {
    id: "WH-EVT-1",
    event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
    resource: {
      id: "I-SANDBOXSUB",
      custom_id: created.user.id,
      status: "ACTIVE",
      billing_info: { next_billing_time: "2026-10-23T00:00:00Z" },
    },
  };
  const first = applyVerifiedPaypalEvent(event);
  assert.equal(first.applied, true);
  assert.equal(first.duplicate, false);
  assert.equal(accessKindForUser(created.user.id), "active");
  const dup = applyVerifiedPaypalEvent(event);
  assert.equal(dup.duplicate, true);
  assert.equal(dup.applied, false);
  const state = readBetaState(dir);
  assert.equal(state.users.find((row) => row.id === created.user.id)?.plan, "paid");
  assert.equal(state.subscriptions.length, 1);
  assert.equal(state.subscriptions[0]?.userId, created.user.id);
  assert.equal(state.subscriptions[0]?.status, "active");
  assert.equal(state.paypalWebhookReceipts.length, 1);

  const failed = applyVerifiedPaypalEvent({
    id: "WH-EVT-2",
    event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    resource: { id: "I-SANDBOXSUB", custom_id: created.user.id },
  });
  assert.equal(failed.applied, true);
  const afterFail = readBetaState(dir);
  assert.equal(afterFail.users.find((row) => row.id === created.user.id)?.plan, "free");
  assert.equal(afterFail.subscriptions[0]?.status, "payment_failed");
  assert.equal(accessKindForUser(created.user.id), "payment_failed");

  const orphan = applyVerifiedPaypalEvent({
    id: "WH-EVT-3",
    event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
    resource: { id: "I-OTHER", custom_id: "not-a-user", status: "ACTIVE" },
  });
  assert.equal(orphan.applied, false);
});

test("verified accounts without a PayPal subscription stay on existing Trial (free) access", async () => {
  const created = await registerAccount({
    email: "trial@example.com",
    password: "correct-battery-staple",
    displayName: "Trial User",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  assert.equal(accessKindForUser(created.user.id), "unverified");
  mutateBetaState((state) => {
    const live = state.users.find((row) => row.id === created.user.id);
    if (!live) throw new Error("missing user");
    live.status = "active";
    live.emailVerifiedAt = new Date().toISOString();
    return live;
  });
  assert.equal(accessKindForUser(created.user.id), "trial");
  const status = billingStatusForUser(created.user.id);
  assert.equal(status.access, "trial");
  assert.equal(status.plan, "free");
  assert.equal(status.live, false);
});

