export const REPAIR_DIAGNOSES = [
  "timeout",
  "no_bytecode",
  "self_destruct",
  "rpc",
  "revert",
  "unverifiable",
  "unknown",
] as const;
export type RepairDiagnosis = (typeof REPAIR_DIAGNOSES)[number];

export const REPAIR_ACTIONS = ["keep_reporting", "skip_until_restored"] as const;
export type RepairAction = (typeof REPAIR_ACTIONS)[number];

export const REPAIR_STATUSES = ["proposed", "approved", "rejected", "restored"] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export type RepairResearch = {
  protocol: string;
  chainLabel: string;
  scanMethod: string;
  officialUrl?: string;
  tokenAddress?: string;
  notes: string;
};

export type RepairCase = {
  id: string;
  sourceId: string;
  status: RepairStatus;
  diagnosis: RepairDiagnosis;
  suggestedAction: RepairAction;
  lastError: string;
  consecutiveFailures: number;
  research: RepairResearch;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
  appliedAction?: RepairAction;
};

export type SourcePause = {
  sourceId: string;
  caseId: string;
  pausedAt: string;
  reason: string;
  approvedBy: string;
};
