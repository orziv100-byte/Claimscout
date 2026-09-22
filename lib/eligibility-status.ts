import { ENGINE_WALLET_LEVEL_CATALOG_IDS } from "./engine/sources.ts";
import type { CatalogClaim, EligibilityResult, WalletEligibilityStatus } from "./types";

export const WALLET_ELIGIBILITY_LABEL: Record<WalletEligibilityStatus, string> = {
  eligible: "Eligible",
  ineligible: "Not eligible",
  already_claimed: "Already claimed",
  unable_to_verify: "Unable to verify",
};

export function walletEligibilityStatus(status: EligibilityResult["status"]): WalletEligibilityStatus {
  if (status === "eligible" || status === "ineligible" || status === "already_claimed") return status;
  return "unable_to_verify";
}

export function walletEligibilityLabel(status: EligibilityResult["status"]): string {
  if (status === "window_closed") return "Window closed";
  return WALLET_ELIGIBILITY_LABEL[walletEligibilityStatus(status)];
}

/** Address-level eth_call checkers. Remaining token balance is never a wallet check. */
export function catalogCheckKind(claim: CatalogClaim): "wallet_level" | "catalog_only" {
  if (ENGINE_WALLET_LEVEL_CATALOG_IDS.has(claim.id)) return "wallet_level";
  if (!claim.onChain?.claimedFn) return "catalog_only";
  if (claim.onChain.chainId !== 1 && claim.onChain.chainId !== 42161) return "catalog_only";
  return "wallet_level";
}
