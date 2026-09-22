import { airdropHasAddressLookup, ENGINE_SOURCES, getEngineSource } from "./sources.ts";
import type { EngineFinding, WalletProfile } from "./types.ts";

export type WalletActivity = {
  protocols: Set<string>;
  tokenSymbols: Set<string>;
  chainIdsWithBalance: number[];
  chainIdsWithTxs: number[];
};

export function walletActivity(
  profile: Pick<WalletProfile, "chains" | "tokens" | "protocols">,
): WalletActivity {
  return {
    protocols: new Set(profile.protocols.map((row) => row.toLowerCase())),
    tokenSymbols: new Set(profile.tokens.map((row) => row.symbol.toUpperCase())),
    chainIdsWithBalance: profile.chains.filter((row) => Number(row.native) > 0).map((row) => row.chainId),
    chainIdsWithTxs: profile.chains.filter((row) => (row.txCount ?? 0) > 0).map((row) => row.chainId),
  };
}

function protocolTouched(protocol: string | undefined, activity: WalletActivity): boolean {
  if (!protocol) return false;
  return activity.protocols.has(protocol.toLowerCase());
}

/** Activity evidence already on this wallet. Does not invent Eligible. */
export function findingIsRelevantToWallet(
  finding: Pick<EngineFinding, "sourceId" | "eligibility" | "amount">,
  activity: WalletActivity,
): boolean {
  if (finding.eligibility === "eligible" || finding.eligibility === "already_claimed") return true;
  if (
    finding.eligibility === "window_closed" &&
    airdropHasAddressLookup(finding.sourceId) &&
    Number(finding.amount) > 0
  ) {
    return true;
  }
  const source = getEngineSource(finding.sourceId);
  if (protocolTouched(source?.protocol, activity)) return true;
  if (source?.tokenSymbol && activity.tokenSymbols.has(source.tokenSymbol.toUpperCase())) return true;
  const related = ENGINE_SOURCES.find(
    (row) =>
      row.category === "airdrop" &&
      row.protocol === source?.protocol &&
      row.tokenSymbol &&
      activity.tokenSymbols.has(row.tokenSymbol.toUpperCase()),
  );
  return Boolean(related);
}

export function catalogIsRelevantToWallet(
  claim: { id: string; asset: string },
  activity: WalletActivity,
): boolean {
  if (claim.asset && activity.tokenSymbols.has(claim.asset.toUpperCase())) return true;
  const source = ENGINE_SOURCES.find((row) => row.catalogId === claim.id);
  if (protocolTouched(source?.protocol, activity)) return true;
  if (source?.tokenSymbol && activity.tokenSymbols.has(source.tokenSymbol.toUpperCase())) return true;
  return false;
}
