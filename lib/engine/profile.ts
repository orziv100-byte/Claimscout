import type { Address } from "viem";
import { getEngineSource } from "./sources.ts";
import type { EngineFinding, EngineSource, WalletProfile } from "./types.ts";

export function isInterestingFinding(finding: EngineFinding): boolean {
  if (finding.sourceStatus === "failed") return true;
  if (finding.sourceStatus !== "ok") return finding.verification !== "rejected";
  if (
    finding.category === "native_balance" ||
    finding.category === "forgotten_token" ||
    finding.category === "protocol_claim"
  ) {
    const value = Number(finding.amount);
    return Number.isFinite(value) && value > 0;
  }
  return true;
}

/** Scan summary and history must count the same rows: interesting findings only. */
export function interestingVerificationCounts(findings: readonly EngineFinding[]): {
  verified: number;
  uncertain: number;
  rejected: number;
} {
  const interesting = findings.filter(isInterestingFinding);
  return {
    verified: interesting.filter((row) => row.verification === "verified").length,
    uncertain: interesting.filter((row) => row.verification === "uncertain").length,
    rejected: interesting.filter((row) => row.verification === "rejected").length,
  };
}

/** Live contract could not be read — never label that as verified. */
export function liveReadUnavailable(): { verification: "uncertain"; eligibility: "unable_to_verify" } {
  return { verification: "uncertain", eligibility: "unable_to_verify" };
}

/** Stored scans may still say verified when the adapter could not read bytecode. */
export function normalizeStoredFinding(finding: EngineFinding): EngineFinding {
  if (finding.sourceStatus !== "ok") return finding;
  if (finding.verification !== "verified") return finding;
  if (finding.eligibility === "window_closed" || finding.deadlineStatus === "expired") return finding;
  const detail = finding.detail ?? "";
  if (!/currently has no bytecode/i.test(detail)) return finding;
  if (!/cannot be read/i.test(detail)) return finding;
  return { ...finding, ...liveReadUnavailable() };
}

export function buildWalletProfile(
  address: Address,
  findings: EngineFinding[],
  selected: EngineSource[],
  txCounts: ReadonlyMap<number, number> = new Map(),
): WalletProfile {
  const chains = findings
    .filter((row) => row.category === "native_balance" && row.sourceStatus === "ok")
    .map((row) => ({
      chainId: row.chainId,
      chainLabel: row.chainLabel,
      native: row.amount ?? "0",
      symbol: row.symbol ?? "ETH",
      txCount: txCounts.get(row.chainId),
    }));

  const tokens = findings
    .filter((row) => row.category === "forgotten_token" && row.sourceStatus === "ok")
    .filter((row) => row.amount && Number(row.amount) > 0)
    .map((row) => {
      const source = getEngineSource(row.sourceId);
      return {
        chainId: row.chainId,
        symbol: row.symbol ?? source?.tokenSymbol ?? "TOKEN",
        amount: row.amount ?? "0",
        contract: source?.tokenAddress ?? row.sourceId,
      };
    });

  const protocols = [
    ...new Set(
      findings
        .filter(isInterestingFinding)
        .filter((row) => row.category === "forgotten_token" || row.category === "protocol_claim")
        .map((row) => getEngineSource(row.sourceId)?.protocol)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const contracts = [
    ...new Set(
      findings
        .filter(isInterestingFinding)
        .flatMap((row) => {
          const source = getEngineSource(row.sourceId);
          const ids: string[] = [];
          if (source?.tokenAddress) ids.push(source.tokenAddress);
          if (row.category === "protocol_claim" && source?.distributorAddress) ids.push(source.distributorAddress);
          return ids;
        }),
    ),
  ];

  return {
    address,
    chains,
    tokens,
    protocols,
    contracts,
    relevantSourceIds: selected.map((source) => source.id),
  };
}
