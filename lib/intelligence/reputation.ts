import type { SourceKind } from "../types.ts";
import type { SourceConfidence, SourceTier } from "./types.ts";

export const DEFAULT_SOURCE_TIERS: Record<string, SourceTier> = {
  catalog: "A",
  project_site: "A",
  explorer: "A",
  onchain: "A",
  github: "A",
  blog: "B",
  wayback: "B",
  archive_org: "B",
  reddit: "D",
  bitcointalk: "D",
  community: "D",
  unknown: "E",
};

let overrides: Record<string, SourceTier> = {};

export function setSourceTierOverrides(next: Record<string, SourceTier>): void {
  overrides = { ...next };
}

export function sourceTierOverrides(): Record<string, SourceTier> {
  return { ...overrides };
}

export function tierForSource(source: string): SourceTier {
  return overrides[source] ?? DEFAULT_SOURCE_TIERS[source] ?? "E";
}

export function confidenceForTier(tier: SourceTier): SourceConfidence {
  if (tier === "A") return "official_source";
  if (tier === "B") return "archived_official";
  if (tier === "C") return "established_third_party";
  if (tier === "D") return "community_source";
  return "unknown_source";
}

export function githubConfidence(stars?: number): SourceConfidence {
  if (typeof stars === "number" && stars >= 50) return "verified_repository";
  return "community_source";
}

export function canPromoteWithoutCorroboration(source: SourceKind | string, legitimacy?: string): boolean {
  const tier = tierForSource(source);
  if (tier === "A" && (legitimacy === "official" || source === "catalog")) return true;
  return false;
}

export function communityOnly(tier: SourceTier): boolean {
  return tier === "D" || tier === "E";
}
