"use client";

import { useAuth } from "@/components/auth-provider";
import { usePlan } from "@/components/plan-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/plan";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type BillingInterval = "month" | "year";
type BillingStatus = "pending" | "active" | "cancelled" | "suspended" | "expired" | "payment_failed";

type BillingPayload = {
  ok?: boolean;
  checkoutEnabled?: boolean;
  live?: boolean;
  mode?: string;
  access?: "unverified" | "trial" | "pending" | "active" | "cancelled" | "suspended" | "expired" | "payment_failed";
  accessLabel?: string;
  plan?: "free" | "paid";
  approvalUrl?: string;
  error?: string;
  subscription?: {
    paypalSubscriptionId: string;
    status: BillingStatus;
    interval: BillingInterval;
    createdAt: string;
    updatedAt: string;
    nextBillingAt: string | null;
    approvalUrl: string | null;
  } | null;
  prices?: { monthlyUsd: number; yearlyUsd: number };
};

const STATUS_LABEL: Record<BillingStatus, string> = {
  pending: "Pending PayPal approval",
  active: "Active",
  cancelled: "Cancelled",
  suspended: "Suspended",
  expired: "Expired",
  payment_failed: "Payment failed",
};

export function SubscriptionPanel({ variant = "web" }: { variant?: "web" | "exe" }) {
  const { user, refresh: refreshAuth } = useAuth();
  const { plan, refresh: refreshPlan } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"month" | "year" | "cancel" | "sync" | null>(null);

  const userId = user?.id;

  const apply = useCallback(
    async (json: BillingPayload) => {
      setBilling(json);
      await Promise.all([refreshAuth(), refreshPlan()]);
    },
    [refreshAuth, refreshPlan],
  );

  const load = useCallback(async () => {
    if (!userId) {
      setBilling(null);
      return;
    }
    const res = await fetch("/api/billing/status");
    const json = (await res.json().catch(() => ({}))) as BillingPayload;
    if (!res.ok) {
      setError(json.error || "Could not load subscription status.");
      return;
    }
    setError(null);
    setBilling(json);
    if (json.plan === "paid" || json.plan === "free") {
      await Promise.all([refreshAuth(), refreshPlan()]);
    }
  }, [userId, refreshAuth, refreshPlan]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const flag = searchParams.get("billing");
    if (flag !== "paypal-return" || !userId) return;
    let cancelled = false;
    (async () => {
      setBusy("sync");
      const res = await fetch("/api/billing/paypal/sync", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const json = (await res.json().catch(() => ({}))) as BillingPayload;
      if (!cancelled) {
        if (res.ok) await apply(json);
        else setError(json.error || "Could not confirm PayPal Sandbox payment.");
        setBusy(null);
        router.replace(variant === "exe" ? "/desktop" : "/upgrade");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, router, searchParams, userId, variant]);

  useEffect(() => {
    if (billing?.subscription?.status !== "pending") return;
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [billing?.subscription?.status, load]);

  async function subscribe(interval: BillingInterval) {
    setBusy(interval);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval }),
    });
    const json = (await res.json().catch(() => ({}))) as BillingPayload;
    setBusy(null);
    if (!res.ok || !json.approvalUrl) {
      setError(json.error || "Could not start PayPal Sandbox checkout.");
      return;
    }
    window.location.assign(json.approvalUrl);
  }

  async function cancelSub() {
    setBusy("cancel");
    setError(null);
    const res = await fetch("/api/billing/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const json = (await res.json().catch(() => ({}))) as BillingPayload;
    setBusy(null);
    if (!res.ok) {
      setError(json.error || "Could not cancel the subscription.");
      return;
    }
    await apply(json);
  }

  const status = billing?.subscription?.status;
  const active = plan === "paid" || status === "active";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan / Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          PayPal Sandbox only. The server creates the subscription and never sends a PayPal secret to this page
          {variant === "exe" ? " or to PoolIndex.exe" : ""}. Live charges are off.
        </p>
        {!user ? (
          <p>
            Download does not require payment.{" "}
            <Link href="/download" className="text-primary underline">
              Download PoolIndex
            </Link>
            , then{" "}
            <Link href="/register" className="text-primary underline">
              register
            </Link>
            , verify email, and{" "}
            <Link href={`/login?next=${variant === "exe" ? "/desktop" : "/upgrade"}`} className="text-primary underline">
              sign in
            </Link>{" "}
            to choose Trial or Paid Subscription. The EXE cannot mark itself paid.
          </p>
        ) : (
          <>
            <p className="text-foreground">
              Access: {billing?.accessLabel || (active ? "Active" : "Trial (Closed Beta free access)")}. Product plan:{" "}
              {active ? "PoolIndex Pro" : "Trial"}. Subscription: {status ? STATUS_LABEL[status] : "none"}.
            </p>
            {billing?.subscription?.nextBillingAt ? (
              <p>Next billing (PayPal): {billing.subscription.nextBillingAt}</p>
            ) : null}
            {status === "pending" && billing?.subscription?.approvalUrl ? (
              <Button type="button" disabled={busy !== null} onClick={() => window.location.assign(billing.subscription!.approvalUrl!)}>
                Continue PayPal checkout
              </Button>
            ) : null}
            {(!status || status === "cancelled" || status === "expired" || status === "payment_failed" || status === "suspended") &&
            billing?.checkoutEnabled ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" disabled={busy !== null} onClick={() => void subscribe("month")}>
                  {busy === "month" ? "Starting…" : `Subscribe monthly ($${billing.prices?.monthlyUsd ?? PLANS.paid.priceUsd} Sandbox)`}
                </Button>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void subscribe("year")}>
                  {busy === "year" ? "Starting…" : `Subscribe yearly ($${billing.prices?.yearlyUsd ?? PLANS.paid.yearlyUsd} Sandbox)`}
                </Button>
              </div>
            ) : null}
            {status === "active" || status === "pending" || status === "suspended" || status === "payment_failed" ? (
              <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void cancelSub()}>
                {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
              </Button>
            ) : null}
            {billing && !billing.checkoutEnabled ? (
              <p>PayPal Sandbox checkout is not available on this server yet.</p>
            ) : null}
          </>
        )}
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
