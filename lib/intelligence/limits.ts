import { PLANS, type PlanId, type ScanSource } from "../plan.ts";

export type HuntLimits = {
  deepHunt: boolean;
  maxActiveHunts: number;
  sources: readonly ScanSource[];
  maxTrailDepth: number;
  maxDerivedTargets: number;
  maxLeads: number;
  walletIntel: boolean;
  continuous: boolean;
  changeDetection: boolean;
  historical: boolean;
  maxSlicesPerMinute: number;
};

export function huntLimits(plan: PlanId): HuntLimits {
  if (plan === "paid") {
    return {
      deepHunt: true,
      maxActiveHunts: 1,
      sources: PLANS.paid.sources,
      maxTrailDepth: 2,
      maxDerivedTargets: 12,
      maxLeads: 60,
      walletIntel: true,
      continuous: true,
      changeDetection: true,
      historical: true,
      maxSlicesPerMinute: 20,
    };
  }
  return {
    deepHunt: true,
    maxActiveHunts: 1,
    sources: PLANS.free.sources,
    maxTrailDepth: 1,
    maxDerivedTargets: 4,
    maxLeads: 15,
    walletIntel: false,
    continuous: false,
    changeDetection: false,
    historical: false,
    maxSlicesPerMinute: 8,
  };
}
