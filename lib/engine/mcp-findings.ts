import { getEngineSource } from "./sources.ts";
import type { EngineFinding } from "./types.ts";
import { untrustedExternal, type UntrustedExternal } from "./mcp-untrusted.ts";

export const MCP_FINDING_TYPES = ["balance", "airdrop_check", "protocol_position"] as const;
export type McpFindingType = (typeof MCP_FINDING_TYPES)[number];

export const MCP_FINDING_STATUSES = [
  "verified_claimable",
  "not_eligible",
  "already_claimed",
  "window_closed",
  "unable_to_verify",
  "check_failed",
  "holding",
] as const;
export type McpFindingStatus = (typeof MCP_FINDING_STATUSES)[number];

export type McpFinding = {
  id: string;
  type: McpFindingType;
  status: McpFindingStatus;
  title: string;
  amount?: string;
  symbol?: string;
  amount_source: string;
  net_after_gas?: number;
  deadline?: string;
  evidence: {
    checked: string;
    chain: string;
    chainId: number;
    contract?: string;
    result: string;
  };
  source_url?: string;
  checked_at: string;
  detail?: UntrustedExternal;
};

export function mcpFindingType(category: EngineFinding["category"]): McpFindingType {
  if (category === "native_balance" || category === "forgotten_token") return "balance";
  if (category === "airdrop") return "airdrop_check";
  return "protocol_position";
}

export function mcpFindingStatus(finding: EngineFinding): McpFindingStatus {
  const type = mcpFindingType(finding.category);
  if (finding.sourceStatus === "failed") return "check_failed";
  if (finding.eligibility === "window_closed" || finding.deadlineStatus === "expired") return "window_closed";
  if (finding.eligibility === "already_claimed") return "already_claimed";
  if (finding.eligibility === "ineligible") return "not_eligible";
  if (finding.verification === "rejected") return "not_eligible";
  if (type === "balance") return "holding";
  if (finding.verification === "verified" && finding.eligibility === "eligible") {
    return "verified_claimable";
  }
  return "unable_to_verify";
}

function amountSource(finding: EngineFinding): string {
  if (finding.category === "native_balance") return "rpc_balance";
  if (finding.sourceConfidence === "official_merkle") return "official_merkle";
  if (finding.sourceConfidence === "official_onchain") return "official_onchain";
  if (finding.sourceStatus === "failed") return "check_failed";
  return "adapter";
}

export function toMcpFinding(finding: EngineFinding, checkedAt: string): McpFinding {
  const source = getEngineSource(finding.sourceId);
  const type = mcpFindingType(finding.category);
  const status = mcpFindingStatus(finding);
  const contract = source?.distributorAddress || source?.tokenAddress;
  const result =
    finding.sourceStatus === "failed"
      ? `adapter failed: ${finding.detail || "no detail"}`
      : `${finding.verification}${finding.eligibility ? `/${finding.eligibility}` : ""}`;
  return {
    id: finding.id,
    type,
    status,
    title: finding.title,
    amount: finding.amount,
    symbol: finding.symbol,
    amount_source: amountSource(finding),
    net_after_gas: finding.estimatedNetUsd,
    deadline: finding.deadline || undefined,
    evidence: {
      checked: source?.scanMethod || finding.sourceId,
      chain: finding.chainLabel,
      chainId: finding.chainId,
      contract,
      result,
    },
    source_url: finding.officialUrl,
    checked_at: checkedAt,
    detail: untrustedExternal(finding.detail),
  };
}

export function countFindings(findings: McpFinding[]) {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const row of findings) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  return { byType, byStatus, total: findings.length };
}
