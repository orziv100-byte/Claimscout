import type { ClaimKind, ClaimStatus, Claimability, Legitimacy, SourceKind } from "./types";

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
  unclaimed_remaining: "Unclaimed contract balance",
  expired: "Window closed",
  archived: "Archive only",
  unknown: "Needs verification",
};

export const CLAIMABILITY_LABEL: Record<Claimability, string> = {
  confirmed_live_claim: "Confirmed live claim",
  unclaimed_contract_balance_only: "Unclaimed contract balance only",
  eligibility_unknown: "Eligibility unknown",
  expired: "Expired",
  unsupported: "Unverifiable / Unsupported",
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

export function formatTokenAmount(amount?: string): string {
  if (amount == null || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  if (n === 0) return "0";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

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

const ISRAEL_TZ = "Asia/Jerusalem";

export function formatIsraelDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatIsraelDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(", ", " ");
}

export const HUNT_STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  paused: "Paused",
  stopped: "Stopped",
  completed: "Completed",
  failed: "Failed",
};

export const HUNT_STAGE_LABEL: Record<string, string> = {
  ingest: "Ingest",
  catalog: "Catalog",
  github: "GitHub",
  wayback: "Wayback Machine",
  archive_org: "Internet Archive",
  historical: "Historical Archive Research",
  corroboration: "Corroboration",
  trail: "Follow the Trail",
  wallet: "Wallet History",
  change_detection: "Change Detection",
  finalize: "Finalize",
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  discovered: "Discovered",
  investigating: "Investigating",
  evidence_found: "Evidence found",
  reviewable: "Reviewable",
  eligibility_unknown: "Eligibility unknown",
  eligibility_confirmed: "Eligibility confirmed",
  already_claimed: "Already claimed",
  window_closed: "Window closed",
  expired: "Expired",
  rejected: "Rejected",
  potential_risk: "Potential risk",
};

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
