import type { Address } from "viem";
import type { WalletEligibilityStatus } from "../types.ts";

export const ENGINE_VERDICTS = ["verified", "uncertain", "rejected"] as const;
export type EngineVerdict = (typeof ENGINE_VERDICTS)[number];

export const ENGINE_CATEGORIES = [
  "native_balance",
  "forgotten_token",
  "airdrop",
  "protocol_claim",
] as const;
export type EngineCategory = (typeof ENGINE_CATEGORIES)[number];

export type EngineEligibility =
  | WalletEligibilityStatus
  | "window_closed";

export const SOURCE_CONFIDENCE = [
  "official_onchain",
  "official_merkle",
  "official_project",
  "needs_review",
  "unverified",
] as const;
export type SourceConfidence = (typeof SOURCE_CONFIDENCE)[number];

export const DEADLINE_STATUSES = ["none", "open", "closing", "expired"] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

export const ROI_CONFIDENCE = ["none", "low", "medium", "high"] as const;
export type RoiConfidence = (typeof ROI_CONFIDENCE)[number];

export type EngineFinding = {
  id: string;
  sourceId: string;
  catalogId?: string;
  category: EngineCategory;
  chainId: number;
  chainLabel: string;
  verification: EngineVerdict;
  eligibility?: EngineEligibility;
  title: string;
  detail: string;
  officialUrl?: string;
  amount?: string;
  symbol?: string;
  sourceStatus: "ok" | "failed" | "skipped";
  sourceConfidence?: SourceConfidence;
  deadline?: string;
  deadlineStatus?: DeadlineStatus;
  deadlineLabel?: string;
  estimatedValueUsd?: number;
  estimatedFeesUsd?: number;
  estimatedNetUsd?: number;
  roiConfidence?: RoiConfidence;
  safetyFlags?: { severity: "info" | "warning" | "danger"; code: string; message: string }[];
};

export type EngineSource = {
  id: string;
  protocol: string;
  chainId: number;
  chainLabel: string;
  category: EngineCategory;
  catalogId?: string;
  walletLevel: boolean;
  officialUrl?: string;
  tokenAddress?: `0x${string}`;
  tokenSymbol?: string;
  tokenDecimals?: number;
  frequency: "on_demand" | "daily";
  rateLimit: "sequential";
  scanMethod: string;
  adapterVersion: "1";
  distributorAddress?: `0x${string}`;
  claimDeadline?: string;
  windowClosed?: boolean;
};

export type SourceHealth = {
  id: string;
  status: "ok" | "failed" | "unknown";
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  consecutiveFailures: number;
};

export type WalletProfile = {
  address: Address;
  chains: { chainId: number; chainLabel: string; native: string; symbol: string; txCount?: number }[];
  tokens: { chainId: number; symbol: string; amount: string; contract: string }[];
  protocols: string[];
  contracts: string[];
  relevantSourceIds: string[];
};

export type EngineCounters = {
  sourcesChecked: number;
  sourcesFailed: number;
  chainsChecked: number;
  relevantSources: number;
  potentialFindings: number;
  verifiedFindings: number;
};

export type EngineChange = {
  kind: "new_finding" | "removed_finding" | "status_changed" | "amount_changed" | "baseline" | "source_failed";
  findingId: string;
  summary: string;
};

export type ScanHistoryEntry = {
  scannedAt: string;
  sourcesChecked: number;
  sourcesFailed: number;
  potentialFindings: number;
  verifiedFindings: number;
};

export type EngineScanSummary = {
  adaptersChecked: number;
  adaptersSucceeded: number;
  adaptersFailed: number;
  failures: { sourceId: string; reason: string }[];
  verified: number;
  uncertain: number;
  rejected: number;
};

export type EngineScan = {
  address: Address;
  scannedAt: string;
  profile: WalletProfile;
  findings: EngineFinding[];
  counters: EngineCounters;
  summary: EngineScanSummary;
  changes: EngineChange[];
  previousScannedAt?: string;
  sourceHealth?: SourceHealth[];
  durationMs?: number;
};

export const SCAN_STAGE_IDS = [
  "profile",
  "chains",
  "protocols",
  "relevant_sources",
  "verification",
] as const;
export type ScanStageId = (typeof SCAN_STAGE_IDS)[number];

export type ScanStageView = {
  id: ScanStageId;
  label: string;
  status: "pending" | "active" | "done";
  count?: number;
  total?: number;
  detail?: string;
};

export type ScanProgressFinding = {
  id: string;
  sourceId?: string;
  title: string;
  verification: EngineVerdict;
  eligibility?: EngineEligibility;
  amount?: string;
  symbol?: string;
  category?: EngineCategory;
  officialUrl?: string;
  catalogId?: string;
  sourceStatus?: "ok" | "failed" | "skipped";
  detail?: string;
};

export type ScanProgress = {
  stage: ScanStageId | "done";
  stages: ScanStageView[];
  address: string;
  elapsedMs: number;
  chainsChecked: number;
  chainsTotal: number;
  chainLabels: string[];
  protocolsChecked: number;
  protocolsTotal: number;
  protocolNames: string[];
  sourcesChecked: number;
  sourcesTotal: number;
  sourcesFailed: number;
  sourcesTimedOut: number;
  currentSource?: string;
  verifiedFindings: number;
  uncertainFindings: number;
  potentialFindings: number;
  findings: ScanProgressFinding[];
};
