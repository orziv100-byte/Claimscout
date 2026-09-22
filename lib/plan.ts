import { BRAND_NAME } from "./app-info.ts";

export const SCAN_SOURCES = [
  "catalog",
  "github",
  "wayback",
  "archive_org",
  "reddit",
  "bitcointalk",
] as const;

export type ScanSource = (typeof SCAN_SOURCES)[number];
export type PlanId = "free" | "paid";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceUsd: number;
  yearlyUsd: number;
  billingInterval: "month" | "none";
  maxWallets: number;
  sources: readonly ScanSource[];
  summary: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    yearlyUsd: 0,
    billingInterval: "none",
    maxWallets: 1,
    sources: ["catalog", "github"],
    summary:
      "One public wallet, catalog, honest eligibility names, and URL inspect. Finding names are never hidden behind payment.",
  },
  paid: {
    id: "paid",
    name: `${BRAND_NAME} Pro`,
    priceUsd: 20,
    yearlyUsd: 99,
    billingInterval: "month",
    maxWallets: 5,
    sources: ["catalog", "github", "wayback", "archive_org"],
    summary:
      "Planned $20/month or $99/year: up to five wallets, claim-window and verified-finding email alerts, and Wayback/archive scanning. Finding names stay free. Payment processing is unavailable.",
  },
};

export const RESERVED_SOURCES: readonly ScanSource[] = ["reddit", "bitcointalk"];

export type SourceAccess = "allowed" | "upgrade" | "reserved";

export function sourceAccess(plan: PlanId, source: string): SourceAccess {
  if ((PLANS[plan].sources as readonly string[]).includes(source)) return "allowed";
  if ((RESERVED_SOURCES as readonly string[]).includes(source)) return "reserved";
  if ((PLANS.paid.sources as readonly string[]).includes(source)) return "upgrade";
  return "reserved";
}

export function capSources(
  plan: PlanId,
  requested?: string[],
): { allowed: ScanSource[]; locked: string[]; reserved: string[]; capped: boolean } {
  const wanted = (requested?.length ? requested : [...SCAN_SOURCES]).filter((source) =>
    (SCAN_SOURCES as readonly string[]).includes(source),
  ) as ScanSource[];
  const allowed: ScanSource[] = [];
  const locked: string[] = [];
  const reserved: string[] = [];
  for (const source of wanted) {
    const access = sourceAccess(plan, source);
    if (access === "allowed") allowed.push(source);
    else if (access === "upgrade") locked.push(source);
    else reserved.push(source);
  }
  if (allowed.length === 0) allowed.push(...PLANS[plan].sources);
  return {
    allowed,
    locked,
    reserved,
    capped: locked.length > 0 || reserved.length > 0,
  };
}

export function bindWallet(
  wallets: string[],
  maxWallets: number,
  address: string,
): { ok: true; wallets: string[]; added: boolean } | { ok: false; code: "WALLET_LIMIT"; wallets: string[] } {
  const next = address.toLowerCase();
  if (wallets.some((wallet) => wallet.toLowerCase() === next)) {
    return { ok: true, wallets, added: false };
  }
  if (wallets.length >= maxWallets) {
    return { ok: false, code: "WALLET_LIMIT", wallets };
  }
  return { ok: true, wallets: [...wallets, address], added: true };
}

export function paidSourceCoverage(): { used: number; total: number; percent: number } {
  const used = PLANS.paid.sources.length;
  const total = SCAN_SOURCES.length;
  return { used, total, percent: Math.round((used / total) * 100) };
}

export function walletLimitMessage(plan: PlanId): string {
  if (plan === "free") {
    return `Free checks one wallet. ${BRAND_NAME} Pro is planned ($${PLANS.paid.priceUsd}/month or $${PLANS.paid.yearlyUsd}/year; payment processing unavailable) and unlocks up to five wallets plus email alerts and archive scanning. Offer names are never hidden behind payment.`;
  }
  return `${BRAND_NAME} Pro includes up to five wallets.`;
}

export function isPaidPlan(plan: PlanId): boolean {
  return plan === "paid";
}
