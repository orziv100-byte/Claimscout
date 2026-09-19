import { isHexAddress } from "../address.ts";
import { getClaimById } from "../catalog.ts";
import type { EligibilityResult } from "../types.ts";
import type { Address } from "viem";
import { addEvidence, promoteLead, refreshLeadDimensions, setLeadStatus } from "./leads.ts";
import { tierForSource } from "./reputation.ts";
import type { HuntRecord, LeadRecord } from "./types.ts";

export type EligibilityFn = (claimId: string, address: Address) => Promise<EligibilityResult>;

export function catalogIdsForWallet(hunt: HuntRecord): string[] {
  const ids = hunt.leads.map((lead) => lead.catalogId).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export async function applyWalletEvidence(
  hunt: HuntRecord,
  lead: LeadRecord,
  result: EligibilityResult,
  at: string,
): Promise<void> {
  addEvidence(lead, {
    type: "wallet",
    sourceKind: "wallet",
    sourceTier: tierForSource("onchain"),
    label: "Public wallet history check",
    detail: result.detail,
    at,
  });
  if (result.status === "eligible") {
    lead.walletRelevance = "direct_interaction";
    lead.eligibility = "confirmed";
  } else if (result.status === "already_claimed") {
    lead.walletRelevance = "direct_interaction";
    lead.eligibility = "already_claimed";
  } else if (result.status === "ineligible") {
    lead.walletRelevance = "possible_relevance";
    lead.eligibility = "not_eligible";
  } else if (result.status === "window_closed") {
    lead.walletRelevance = lead.walletRelevance === "no_evidence" ? "possible_relevance" : lead.walletRelevance;
    lead.claimWindow = "closed";
    lead.eligibility = "unknown";
    setLeadStatus(lead, "window_closed", result.detail, at);
  } else {
    lead.walletRelevance = "no_evidence";
    lead.eligibility = "unknown";
  }
  refreshLeadDimensions(lead);
  promoteLead(lead, at);
}

export async function researchWalletClaim(
  hunt: HuntRecord,
  claimId: string,
  deps: { checkEligibility?: EligibilityFn; now?: () => string } = {},
): Promise<EligibilityResult | null> {
  if (!hunt.wallet || !isHexAddress(hunt.wallet)) return null;
  const claim = getClaimById(claimId);
  const lead = hunt.leads.find((row) => row.catalogId === claimId);
  if (!claim || !lead) return null;
  const check =
    deps.checkEligibility ??
    (await import("../onchain.ts")).checkEligibility;
  const result = await check(claimId, hunt.wallet);
  const at = deps.now?.() ?? new Date().toISOString();
  await applyWalletEvidence(hunt, lead, result, at);
  hunt.progress.pagesInspected += 1;
  return result;
}
