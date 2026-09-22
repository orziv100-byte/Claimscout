export const CLAIM_KINDS = [
  "airdrop",
  "faucet",
  "giveaway",
  "puzzle",
  "redemption",
  "testnet",
  "promotional",
  "community",
] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_STATUSES = [
  "open",
  "unclaimed_remaining",
  "expired",
  "archived",
  "unknown",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIMABILITY = [
  "confirmed_live_claim",
  "unclaimed_contract_balance_only",
  "eligibility_unknown",
  "expired",
  "unsupported",
] as const;

export type Claimability = (typeof CLAIMABILITY)[number];

export const LEGITIMACY = [
  "official",
  "documented_public",
  "unverified",
  "suspicious",
] as const;

export type Legitimacy = (typeof LEGITIMACY)[number];

export const SOURCE_KINDS = [
  "catalog",
  "bitcointalk",
  "reddit",
  "github",
  "wayback",
  "archive_org",
  "project_site",
  "blog",
  "explorer",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export type ChainId =
  | "bitcoin"
  | "ethereum"
  | "optimism"
  | "arbitrum"
  | "base"
  | "polygon"
  | "solana"
  | "multi"
  | "testnet-sepolia"
  | "testnet-base-sepolia"
  | "offchain";

export type ClaimSource = {
  kind: SourceKind;
  label: string;
  url: string;
  publishedAt?: string;
};

export const REMAINING_METHODS = [
  "token_balance_of_holder",
  "token_total_supply",
  "unsupported",
] as const;

export type RemainingMethod = (typeof REMAINING_METHODS)[number];

export type OnChainSpec = {
  chainId: number;
  chainLabel: string;
  token?: `0x${string}`;
  distributor?: `0x${string}`;
  claimedFn?: "claimableTokens" | "claimed" | "hasClaimed";
  claimFn?: "claim" | "drip";
  claimDeadline?: string;
  remainingMethod?: RemainingMethod;
  remainingUnsupportedReason?: string;
  explorerTokenUrl?: string;
  explorerDistributorUrl?: string;
};

export type ClaimAction =
  | {
      type: "official_ui";
      url: string;
      label: string;
    }
  | {
      type: "onchain_function";
      contract: `0x${string}`;
      chainId: number;
      functionName: string;
      notes: string;
    }
  | {
      type: "none";
      reason: string;
    };

export type CatalogClaim = {
  id: string;
  title: string;
  summary: string;
  kind: ClaimKind;
  status: ClaimStatus;
  claimability: Claimability;
  legitimacy: Legitimacy;
  chain: ChainId;
  asset: string;
  announcedAt?: string;
  eligibility: string;
  howToVerify: string;
  warnings: string[];
  sources: ClaimSource[];
  officialUrl?: string;
  archiveUrl?: string;
  onChain?: OnChainSpec;
  action: ClaimAction;
  tags: string[];
};

export type DiscoveredClaim = {
  id: string;
  title: string;
  summary: string;
  url: string;
  kind: ClaimKind | "unknown";
  source: SourceKind;
  sourceLabel: string;
  publishedAt?: string;
  legitimacy: Legitimacy;
  flags: string[];
  archiveUrl?: string;
  catalogId?: string;
};

export type VerificationReport = {
  url: string;
  fetchedAt: string;
  live: boolean;
  statusCode?: number;
  finalUrl?: string;
  title?: string;
  flags: VerificationFlag[];
  archive: {
    available: boolean;
    snapshotUrl?: string;
    timestamp?: string;
    snapshotCount?: number;
  };
  catalogMatch?: { id: string; title: string };
  verdict: "safe_to_review" | "caution" | "blocked";
  verdictReason: string;
};

export type VerificationFlag = {
  severity: "info" | "warning" | "danger";
  code: string;
  message: string;
};

export type WalletEligibilityStatus =
  | "eligible"
  | "ineligible"
  | "already_claimed"
  | "unable_to_verify";

export type EligibilityResult = {
  claimId: string;
  address: string;
  status: WalletEligibilityStatus | "window_closed" | "unknown";
  detail: string;
  remainingPool?: string;
  remainingSymbol?: string;
  officialCheckerUrl?: string;
  checkKind?: "wallet_level" | "catalog_only";
};

export type LiveSourceResult = {
  items: DiscoveredClaim[];
  blocked: number;
  error?: string;
};

export type SearchResponse = {
  query: string;
  catalog: CatalogClaim[];
  discovered: DiscoveredClaim[];
  blocked: number;
  sourceErrors: { source: string; message: string }[];
  tookMs: number;
  degraded?: boolean;
  resourceNote?: string;
  plan?: {
    id: "free" | "paid";
    name: string;
    allowedSources: string[];
    lockedSources: string[];
    reservedSources: string[];
    maxWallets: number;
  };
};
