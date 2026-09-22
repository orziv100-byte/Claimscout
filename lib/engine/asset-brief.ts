import { estimateRoi } from "./deadline.ts";
import { loadGoPlusTokenSecurity, type ContractSecurity } from "./goplus.ts";
import { marketSnapshotForSymbol, type MarketSnapshot } from "./markets.ts";
import { getEngineSource } from "./sources.ts";
import { loadPreviousScan } from "./state.ts";
import type { EngineFinding, EngineScan } from "./types.ts";
import type { Address } from "viem";

export type WalletAssetContext = {
  address: string;
  amount?: string;
  symbol?: string;
  estimatedValueUsd?: number;
  eligibility?: string;
  verification: string;
  scannedAt: string;
  chainLabel: string;
  nativeTxCount?: number;
  transferHistory: "not_available";
  detail: string;
};

export type AssetBrief = {
  sourceId: string;
  title: string;
  category: string;
  officialUrl?: string;
  wallet: WalletAssetContext;
  market: MarketSnapshot;
  security: ContractSecurity;
};

export function walletContextFromScan(scan: EngineScan, finding: EngineFinding): WalletAssetContext {
  const native = finding.category === "native_balance"
    ? scan.profile.chains.find((row) => row.chainId === finding.chainId)
    : undefined;
  return {
    address: scan.address,
    amount: finding.amount,
    symbol: finding.symbol,
    estimatedValueUsd: finding.estimatedValueUsd,
    eligibility: finding.eligibility,
    verification: finding.verification,
    scannedAt: scan.scannedAt,
    chainLabel: finding.chainLabel,
    nativeTxCount: native?.txCount,
    transferHistory: "not_available",
    detail:
      "This page is about this public address. First-transfer and full send/receive history are not available in Closed Beta — those would need a hosted indexer. Missing history is omitted, not invented.",
  };
}

export function applyMarketToContext(wallet: WalletAssetContext, market: MarketSnapshot): WalletAssetContext {
  const roi = estimateRoi({
    amount: wallet.amount,
    priceUsd: market.priceUsd,
    includeFees: false,
  });
  return {
    ...wallet,
    estimatedValueUsd: roi.estimatedValueUsd ?? wallet.estimatedValueUsd,
  };
}

export async function buildAssetBrief(address: Address, sourceId: string): Promise<AssetBrief | { error: string; code: string }> {
  const scan = loadPreviousScan(address);
  if (!scan) {
    return { error: "Scan this public address in Wallet check first.", code: "SCAN_REQUIRED" };
  }
  const finding = scan.findings.find((row) => row.sourceId === sourceId);
  if (!finding) {
    return { error: "That source was not in the latest scan for this address.", code: "FINDING_NOT_FOUND" };
  }
  const source = getEngineSource(sourceId);
  const market = await marketSnapshotForSymbol(finding.symbol || source?.tokenSymbol);
  let security: ContractSecurity;
  if (finding.category === "native_balance" || !source?.tokenAddress) {
    security = {
      source: "goplus",
      available: false,
      chainId: finding.chainId,
      detail:
        finding.category === "native_balance"
          ? "Native gas token — GoPlus token-security does not apply."
          : "No token contract on this engine source. GoPlus skipped.",
    };
  } else {
    security = await loadGoPlusTokenSecurity(finding.chainId, source.tokenAddress);
  }
  return {
    sourceId,
    title: finding.title,
    category: finding.category,
    officialUrl: finding.officialUrl || source?.officialUrl,
    wallet: applyMarketToContext(walletContextFromScan(scan, finding), market),
    market,
    security,
  };
}
