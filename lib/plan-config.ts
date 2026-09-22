import config from "../config/plans.json";
import type { PlanId } from "./plan.ts";

export type DailyMonitorPolicy = "off" | "opt-in" | "included";
export type PaymentProvider = "none" | "mor" | "stripe";

/** Server is the only authority for plan, quota, and (later) credits. Clients never set balances. */
export const CREDIT_AUTHORITY = "server" as const;

const allowedProviders = new Set(["none", "mor", "stripe"]);

export const PAYMENT_PROVIDER: PaymentProvider = allowedProviders.has(config.payments.provider)
  ? (config.payments.provider as PaymentProvider)
  : "none";

export const PLAN_PRICES = {
  free: { priceUsd: config.plans.free.priceUsd, yearlyUsd: config.plans.free.yearlyUsd },
  paid: { priceUsd: config.plans.paid.priceUsd, yearlyUsd: config.plans.paid.yearlyUsd },
} as const;

export const PLAN_POLICY: Record<
  PlanId,
  {
    maxWallets: number;
    dailyMonitor: DailyMonitorPolicy;
  }
> = {
  free: { maxWallets: config.plans.free.maxWallets, dailyMonitor: config.plans.free.dailyMonitor as DailyMonitorPolicy },
  paid: { maxWallets: config.plans.paid.maxWallets, dailyMonitor: config.plans.paid.dailyMonitor as DailyMonitorPolicy },
};

export function dailyMonitorPolicy(plan: PlanId): DailyMonitorPolicy {
  return PLAN_POLICY[plan].dailyMonitor;
}

export function paymentsAreLive(): boolean {
  return PAYMENT_PROVIDER !== "none";
}
