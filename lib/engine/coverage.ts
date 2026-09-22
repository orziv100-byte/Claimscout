import { CATALOG } from "../catalog.ts";
import { airdropHasAddressLookup, ENGINE_SOURCES } from "./sources.ts";

/** Paid SKU name. Never "Fix broken sources". */
export const COVERAGE_FEATURE_NAME = "Request Coverage";

export const COVERAGE_BILLING = {
  purchaseAvailable: false,
  closedBeta: true,
  buys: "a real wallet-level adapter for a named catalog program",
  doesNotBuy: "Eligible, Not eligible, or any other verdict",
  brokenSources:
    "An adapter that already exists and then fails (RPC change, upgraded contract, timeout) is product maintenance. It is not a paid add-on.",
} as const;

export type CoverageReason = "no_wallet_adapter" | "unhosted_merkle";

export type CoverageRequest = {
  catalogId: string;
  title: string;
  chain: string;
  officialUrl: string;
  reason: CoverageReason;
  reasonLabel: string;
  status: "queued";
};

export function catalogHasAddressLookup(catalogId: string): boolean {
  return ENGINE_SOURCES.some((source) => source.catalogId === catalogId && airdropHasAddressLookup(source.id));
}

export function listCoverageRequests(): CoverageRequest[] {
  return CATALOG.filter(
    (claim) => claim.kind === "airdrop" && claim.legitimacy === "official" && !catalogHasAddressLookup(claim.id),
  )
    .map((claim) => {
      const engine = ENGINE_SOURCES.find((source) => source.catalogId === claim.id);
      const reason: CoverageReason = engine ? "unhosted_merkle" : "no_wallet_adapter";
      return {
        catalogId: claim.id,
        title: claim.title,
        chain: claim.chain,
        officialUrl: claim.officialUrl ?? "",
        reason,
        reasonLabel:
          reason === "unhosted_merkle"
            ? "A catalog/engine row exists, but PoolIndex does not host this project's merkle or allocation API, so the wallet result stays Unable to verify."
            : "No wallet-level adapter in the engine yet.",
        status: "queued" as const,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
