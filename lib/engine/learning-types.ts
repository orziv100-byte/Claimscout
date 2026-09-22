export const COMPETITOR_STANCES = ["architecture_ok", "architecture_only"] as const;
export type CompetitorStance = (typeof COMPETITOR_STANCES)[number];

export type CompetitorRecord = {
  id: string;
  name: string;
  url: string;
  license: string;
  stance: CompetitorStance;
  notes: string;
  lastReviewedAt: string;
};

export const PROPOSAL_ORIGINS = ["catalog_gap", "feedback"] as const;
export type ProposalOrigin = (typeof PROPOSAL_ORIGINS)[number];

export const PROPOSAL_STATUSES = ["queued", "accepted", "rejected", "shipped"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type SourceProposal = {
  id: string;
  origin: ProposalOrigin;
  status: ProposalStatus;
  title: string;
  detail: string;
  catalogId?: string;
  chain?: string;
  officialUrl?: string;
  feedbackType?: string;
  createdAt: string;
  updatedAt: string;
  decidedBy?: string;
};

export type LearningState = {
  competitors: Record<string, { notes: string; lastReviewedAt: string }>;
  proposals: Record<string, SourceProposal>;
};
