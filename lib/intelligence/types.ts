import type { ClaimKind, Claimability, SourceKind } from "../types.ts";
import type { PlanId } from "../plan.ts";

export const HUNT_STATUSES = [
  "queued",
  "running",
  "paused",
  "stopped",
  "completed",
  "failed",
] as const;
export type HuntStatus = (typeof HUNT_STATUSES)[number];

export const HUNT_MODES = ["deep", "continuous"] as const;
export type HuntMode = (typeof HUNT_MODES)[number];

export const HUNT_STAGES = [
  "ingest",
  "catalog",
  "github",
  "wayback",
  "archive_org",
  "historical",
  "corroboration",
  "trail",
  "wallet",
  "change_detection",
  "finalize",
] as const;
export type HuntStage = (typeof HUNT_STAGES)[number];

export const LEAD_STATUSES = [
  "discovered",
  "investigating",
  "evidence_found",
  "reviewable",
  "eligibility_unknown",
  "eligibility_confirmed",
  "already_claimed",
  "window_closed",
  "expired",
  "rejected",
  "potential_risk",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SOURCE_TIERS = ["A", "B", "C", "D", "E"] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export const SOURCE_CONFIDENCE = [
  "official_source",
  "verified_repository",
  "archived_official",
  "established_third_party",
  "community_source",
  "unknown_source",
] as const;
export type SourceConfidence = (typeof SOURCE_CONFIDENCE)[number];

export const EVIDENCE_STRENGTH = ["none", "partial", "strong"] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTH)[number];

export const ONCHAIN_EVIDENCE = ["none", "partial", "confirmed"] as const;
export type OnchainEvidence = (typeof ONCHAIN_EVIDENCE)[number];

export const WALLET_RELEVANCE = [
  "no_evidence",
  "possible_relevance",
  "related_interaction",
  "direct_interaction",
] as const;
export type WalletRelevance = (typeof WALLET_RELEVANCE)[number];

export const CLAIM_WINDOW = ["unknown", "open", "closed", "expired"] as const;
export type ClaimWindow = (typeof CLAIM_WINDOW)[number];

export const ELIGIBILITY_EVIDENCE = [
  "unknown",
  "confirmed",
  "not_eligible",
  "already_claimed",
] as const;
export type EligibilityEvidence = (typeof ELIGIBILITY_EVIDENCE)[number];

export const RISK_EVIDENCE = ["low", "needs_review", "suspicious", "blocked"] as const;
export type RiskEvidence = (typeof RISK_EVIDENCE)[number];

export type HuntProgress = {
  sourcesChecked: number;
  sourcesQueued: number;
  pagesInspected: number;
  rawDiscoveries: number;
  leadsCreated: number;
  strongEvidence: number;
  investigating: number;
  rejected: number;
};

export type HuntTask =
  | { kind: "source"; source: "catalog" | "github" | "wayback" | "archive_org" }
  | { kind: "historical" }
  | { kind: "corroborate"; leadId: string }
  | { kind: "trail"; url: string; depth: number; fromLeadId: string }
  | { kind: "wallet"; claimId: string }
  | { kind: "change_detection" }
  | { kind: "finalize" };

export type EvidenceRecord = {
  id: string;
  type:
    | "catalog"
    | "discovery"
    | "archive"
    | "github"
    | "onchain"
    | "wallet"
    | "documentation"
    | "community"
    | "historical";
  sourceKind: SourceKind | "catalog" | "onchain" | "wallet";
  sourceTier: SourceTier;
  url?: string;
  label: string;
  detail: string;
  at: string;
};

export type LeadRecord = {
  id: string;
  huntId: string;
  userId: string;
  fingerprint: string;
  projectName: string;
  opportunityType: ClaimKind | "unknown";
  chain?: string;
  token?: string;
  contract?: string;
  officialDomain?: string;
  officialDocumentation?: string;
  github?: string;
  catalogId?: string;
  discoverySource: string;
  discoveryDate: string;
  historicalLayer: boolean;
  walletRelevance: WalletRelevance;
  eligibility: EligibilityEvidence;
  claimWindow: ClaimWindow;
  claimability?: Claimability;
  sourceConfidence: SourceConfidence;
  historicalEvidence: EvidenceStrength;
  onchainEvidence: OnchainEvidence;
  risk: RiskEvidence;
  status: LeadStatus;
  statusHistory: { at: string; status: LeadStatus; reason: string }[];
  why: string;
  evidence: EvidenceRecord[];
  mentionCount: number;
  lastChecked: string;
  createdAt: string;
  updatedAt: string;
};

export type ResourceFingerprint = {
  key: string;
  hash: string;
  lastSeen: string;
  label: string;
};

export type HuntChange = {
  at: string;
  kind:
    | "new_lead"
    | "stronger_evidence"
    | "status_changed"
    | "source_changed"
    | "fingerprint_new";
  leadId?: string;
  summary: string;
};

export type HuntError = {
  at: string;
  stage: HuntStage | "system";
  message: string;
};

export type HuntRecord = {
  id: string;
  userId: string;
  query: string;
  wallet?: string;
  mode: HuntMode;
  plan: PlanId;
  status: HuntStatus;
  stage: HuntStage;
  pauseReason?: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  elapsedMs: number;
  pausedAccumMs: number;
  pauseStartedAt?: string;
  slicesThisWindow: number;
  sliceWindowStart: string;
  lastSliceAt?: string;
  previousHuntId?: string;
  resourceState?: string;
  progress: HuntProgress;
  queue: HuntTask[];
  seenUrls: string[];
  seenFingerprints: string[];
  trailUsed: number;
  maxTrailDepth: number;
  maxDerivedTargets: number;
  maxLeads: number;
  leads: LeadRecord[];
  changes: HuntChange[];
  fingerprints: ResourceFingerprint[];
  previousFingerprintCount: number;
  notifications: string[];
  errors: HuntError[];
};

export type HuntSummary = {
  id: string;
  userId: string;
  query: string;
  mode: HuntMode;
  status: HuntStatus;
  stage: HuntStage;
  startedAt: string;
  updatedAt: string;
  progress: HuntProgress;
  leadCount: number;
};

export type PublicHunt = Omit<HuntRecord, "userId"> & { userId: string };

export type SeedDiscovery = {
  id: string;
  title: string;
  summary: string;
  url: string;
  kind: ClaimKind | "unknown";
  source: SourceKind;
  sourceLabel: string;
  publishedAt?: string;
  legitimacy?: string;
  flags?: string[];
  archiveUrl?: string;
  catalogId?: string;
};

export type HuntSeed = {
  catalogIds: string[];
  discovered: SeedDiscovery[];
};

export type ReturnDigest = {
  previousHuntId: string | null;
  sourcesRechecked: number;
  sourcesChanged: number;
  newLeads: number;
  strongerEvidence: number;
  statusChanges: number;
  securityWarnings: number;
  capturedAt: string;
};
