import type { ClaimKind, ClaimStatus, Legitimacy, SourceKind } from "./types";

export const KIND_LABEL: Record<ClaimKind, string> = {
  airdrop: "Airdrop",
  faucet: "Faucet",
  giveaway: "Giveaway",
  puzzle: "Public puzzle",
  redemption: "Redemption",
  testnet: "Testnet reward",
  promotional: "Promo claim",
  community: "Community",
};

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  open: "Open",
  unclaimed_remaining: "Unclaimed remaining",
  expired: "Window closed",
  archived: "Archive only",
  unknown: "Needs verification",
};

export const LEGITIMACY_LABEL: Record<Legitimacy, string> = {
  official: "Official",
  documented_public: "Documented public offer",
  unverified: "Unverified",
  suspicious: "Suspicious",
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  catalog: "Catalog",
  bitcointalk: "Bitcointalk",
  reddit: "Reddit",
  github: "GitHub",
  wayback: "Wayback Machine",
  archive_org: "Internet Archive",
  project_site: "Project site",
  blog: "Blog",
  explorer: "Explorer",
};

export const CHAIN_LABEL: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  optimism: "Optimism",
  arbitrum: "Arbitrum",
  base: "Base",
  polygon: "Polygon",
  solana: "Solana",
  multi: "Multi-chain",
  "testnet-sepolia": "Sepolia",
  "testnet-base-sepolia": "Base Sepolia",
  offchain: "Off-chain",
};

export function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
