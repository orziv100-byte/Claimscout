import { BRAND_NAME } from "./app-info.ts";
import { PLAN_POLICY, PLAN_PRICES } from "./plan-config.ts";

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
    priceUsd: PLAN_PRICES.free.priceUsd,
    yearlyUsd: PLAN_PRICES.free.yearlyUsd,
    billingInterval: "none",
    maxWallets: PLAN_POLICY.free.maxWallets,
    sources: ["catalog", "github"],
    summary:
      "One public wallet, catalog, honest eligibility names, and URL inspect. Finding names are never hidden behind payment.",
  },
  paid: {
    id: "paid",
    name: `${BRAND_NAME} Pro`,
    priceUsd: PLAN_PRICES.paid.priceUsd,
    yearlyUsd: PLAN_PRICES.paid.yearlyUsd,
    billingInterval: "month",
    maxWallets: PLAN_POLICY.paid.maxWallets,
    sources: ["catalog", "github", "wayback", "archive_org"],
    summary:
      `Planned $${PLAN_PRICES.paid.priceUsd}/month or $${PLAN_PRICES.paid.yearlyUsd}/year: up to ${PLAN_POLICY.paid.maxWallets} wallets, claim-window and verified-finding email alerts, and Wayback/archive scanning. Finding names stay free. Payment processing is unavailable.`,
  },
};

export const RESERVED_SOURCES: readonly ScanSource[] = ["reddit", "bitcointalk"];

/** Operator QA wallet-check cap. Product Free/Pro stay 1 and 5. */
export const OPERATOR_WALLET_CHECK_CAP = 10_000;

/** Daily monitor never walks every bound QA address — that would overload the host. */
export const MONITOR_WALLET_CAP = PLANS.paid.maxWallets;

export function unlimitedWalletEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const emails = new Set(["orziv100@gmail.com"]);
  for (const email of (env.POOLINDEX_UNLIMITED_WALLET_EMAILS || "")
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)) {
    emails.add(email);
  }
  return emails;
}

export function isUnlimitedWalletAccount(email?: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  return unlimitedWalletEmails(env).has(email.trim().toLowerCase());
}

export function maxWalletsFor(plan: PlanId, email?: string | null, env: NodeJS.ProcessEnv = process.env): number {
  if (isUnlimitedWalletAccount(email, env)) return OPERATOR_WALLET_CHECK_CAP;
  return PLANS[plan].maxWallets;
}

export function formatWalletCap(maxWallets: number): string {
  return maxWallets >= OPERATOR_WALLET_CHECK_CAP ? "unlimited" : String(maxWallets);
}

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
  opts: { replaceAtCap?: boolean } = {},
):
  | { ok: true; wallets: string[]; added: boolean; replaced: boolean }
  | { ok: false; code: "WALLET_LIMIT"; wallets: string[] } {
  const next = address.toLowerCase();
  if (wallets.some((wallet) => wallet.toLowerCase() === next)) {
    return { ok: true, wallets, added: false, replaced: false };
  }
  if (wallets.length >= maxWallets) {
    if (opts.replaceAtCap && maxWallets === 1) {
      return { ok: true, wallets: [address], added: true, replaced: true };
    }
    return { ok: false, code: "WALLET_LIMIT", wallets };
  }
  return { ok: true, wallets: [...wallets, address], added: true, replaced: false };
}

export function paidSourceCoverage(): { used: number; total: number; percent: number } {
  const used = PLANS.paid.sources.length;
  const total = SCAN_SOURCES.length;
  return { used, total, percent: Math.round((used / total) * 100) };
}

export function walletLimitMessage(plan: PlanId, email?: string | null): string {
  if (isUnlimitedWalletAccount(email)) {
    return `${BRAND_NAME} operator wallet-check slots are full on this account.`;
  }
  if (plan === "free") {
    return `Free keeps one wallet at a time. Paste another public 0x address to replace it. ${BRAND_NAME} Pro is planned ($${PLANS.paid.priceUsd}/month or $${PLANS.paid.yearlyUsd}/year; payment processing unavailable) for up to five wallets plus email alerts and archive scanning. Offer names are never hidden behind payment.`;
  }
  return `${BRAND_NAME} Pro includes up to five wallets.`;
}

export function isPaidPlan(plan: PlanId): boolean {
  return plan === "paid";
}

/** Daily wallet monitor: Pro always, Free only with explicit opt-in. */
export function monitoringActive(plan: PlanId, monitorEnabled?: boolean): boolean {
  if (isPaidPlan(plan)) return true;
  return monitorEnabled === true;
}
