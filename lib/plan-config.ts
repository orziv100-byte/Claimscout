import type { PlanId } from "./plan.ts";

export type DailyMonitorPolicy = "off" | "opt-in" | "included";

/** Server is the only authority for plan, quota, and (later) credits. Clients never set balances. */
export const CREDIT_AUTHORITY = "server" as const;

export const PLAN_POLICY: Record<
  PlanId,
  {
    maxWallets: number;
    dailyMonitor: DailyMonitorPolicy;
  }
> = {
  free: { maxWallets: 1, dailyMonitor: "opt-in" },
  paid: { maxWallets: 5, dailyMonitor: "included" },
};

export function dailyMonitorPolicy(plan: PlanId): DailyMonitorPolicy {
  return PLAN_POLICY[plan].dailyMonitor;
}
