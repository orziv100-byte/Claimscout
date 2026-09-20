import { getClaimById } from "../catalog.ts";
import { newId } from "../password.ts";
import { shouldBlockDiscovery } from "../safety.ts";
import type { CatalogClaim, ClaimKind, Claimability, SourceKind } from "../types.ts";
import { hostOf, leadFingerprint, resourceHash, resourceKey } from "./fingerprint.ts";
import { canPromoteWithoutCorroboration, communityOnly, confidenceForTier, githubConfidence, tierForSource } from "./reputation.ts";
import type {
  ClaimWindow,
  EligibilityEvidence,
  EvidenceRecord,
  EvidenceStrength,
  HuntRecord,
  LeadRecord,
  LeadStatus,
  OnchainEvidence,
  RiskEvidence,
  SeedDiscovery,
  SourceConfidence,
  SourceTier,
  WalletRelevance,
} from "./types.ts";

export function emptyLeadDimensions(): {
  sourceConfidence: SourceConfidence;
  historicalEvidence: EvidenceStrength;
  onchainEvidence: OnchainEvidence;
  walletRelevance: WalletRelevance;
  eligibility: EligibilityEvidence;
  claimWindow: ClaimWindow;
  risk: RiskEvidence;
} {
  return {
    sourceConfidence: "unknown_source",
    historicalEvidence: "none",
    onchainEvidence: "none",
    walletRelevance: "no_evidence",
    eligibility: "unknown",
    claimWindow: "unknown",
    risk: "needs_review",
  };
}

function nowIso(at?: string): string {
  return at ?? new Date().toISOString();
}

export function setLeadStatus(lead: LeadRecord, status: LeadStatus, reason: string, at?: string): void {
  const stamp = nowIso(at);
  if (lead.status === status) {
    lead.lastChecked = stamp;
    lead.updatedAt = stamp;
    return;
  }
  lead.status = status;
  lead.statusHistory.push({ at: stamp, status, reason });
  lead.lastChecked = stamp;
  lead.updatedAt = stamp;
}

export function addEvidence(lead: LeadRecord, evidence: Omit<EvidenceRecord, "id">): EvidenceRecord {
  const existing = lead.evidence.find(
    (row) => row.type === evidence.type && row.url === evidence.url && row.detail === evidence.detail,
  );
  if (existing) return existing;
  const row: EvidenceRecord = { id: newId(8), ...evidence };
  lead.evidence.push(row);
  lead.updatedAt = evidence.at;
  lead.lastChecked = evidence.at;
  lead.mentionCount += 1;
  return row;
}

function claimWindowFromCatalog(claim: CatalogClaim): ClaimWindow {
  if (claim.status === "open") return "open";
  if (claim.status === "expired") return "expired";
  if (claim.status === "archived") return "closed";
  return "unknown";
}

function riskFromCatalog(claim: CatalogClaim): RiskEvidence {
  if (claim.legitimacy === "suspicious") return "suspicious";
  if (claim.warnings.length) return "needs_review";
  if (claim.legitimacy === "official") return "low";
  return "needs_review";
}

export function whyFromEvidence(lead: LeadRecord): string {
  const lines: string[] = [];
  if (lead.walletRelevance === "direct_interaction" && lead.catalogId) {
    lines.push(`Your wallet has on-chain evidence related to ${lead.projectName}.`);
  } else if (lead.walletRelevance === "related_interaction") {
    lines.push(`Your wallet has a related on-chain signal for ${lead.projectName}.`);
  } else if (lead.walletRelevance === "possible_relevance") {
    lines.push(`PoolIndex checked this wallet against ${lead.projectName}; relevance is possible, not confirmed.`);
  }
  const catalog = lead.evidence.find((row) => row.type === "catalog");
  if (catalog) {
    lines.push(`PoolIndex catalog lists ${lead.projectName} as a documented ${lead.opportunityType} research target.`);
  }
  const archive = lead.evidence.find((row) => row.type === "archive" || row.type === "historical");
  if (archive) {
    lines.push("A public historical archive snapshot was found for this project.");
  }
  const github = lead.evidence.find((row) => row.type === "github");
  if (github) {
    lines.push("A public repository matching this project was inspected.");
  }
  const community = lead.evidence.find((row) => row.type === "community");
  if (community && !catalog) {
    lines.push("This started from a community source and still needs independent corroboration.");
  }
  if (lead.eligibility === "unknown") {
    lines.push("Eligibility has not yet been confirmed.");
  } else if (lead.eligibility === "confirmed") {
    lines.push("On-chain eligibility evidence was found. This is not a guaranteed reward.");
  } else if (lead.eligibility === "already_claimed") {
    lines.push("On-chain evidence indicates this address already claimed.");
  } else if (lead.eligibility === "not_eligible") {
    lines.push("On-chain evidence did not show eligibility for this address.");
  }
  if (lead.claimWindow === "expired" || lead.claimWindow === "closed") {
    lines.push("The documented claim window appears closed or expired.");
  }
  if (!lines.length) {
    lines.push("PoolIndex stored this as a lead from a public source. Evidence is still limited.");
  }
  return lines.join(" ");
}

export function refreshLeadDimensions(lead: LeadRecord): void {
  const tiers = lead.evidence.map((row) => row.sourceTier);
  const bestTier = (["A", "B", "C", "D", "E"] as SourceTier[]).find((tier) => tiers.includes(tier)) ?? "E";
  const githubEv = lead.evidence.find((row) => row.type === "github");
  lead.sourceConfidence = githubEv && bestTier === "A" ? githubConfidence(50) : confidenceForTier(bestTier);
  const hist = lead.evidence.filter((row) => row.type === "archive" || row.type === "historical");
  lead.historicalEvidence = hist.length >= 2 ? "strong" : hist.length === 1 ? "partial" : "none";
  const onchain = lead.evidence.filter((row) => row.type === "onchain" || row.type === "wallet");
  if (lead.eligibility === "confirmed" || lead.eligibility === "already_claimed") lead.onchainEvidence = "confirmed";
  else if (onchain.length) lead.onchainEvidence = "partial";
  else lead.onchainEvidence = "none";
  lead.historicalLayer = lead.historicalLayer || hist.length > 0 || lead.claimWindow === "expired" || lead.claimWindow === "closed";
  lead.why = whyFromEvidence(lead);
}

export function promoteLead(lead: LeadRecord, at?: string): void {
  const stamp = nowIso(at);
  refreshLeadDimensions(lead);
  const tiers = lead.evidence.map((row) => row.sourceTier);
  const onlyCommunity = tiers.length > 0 && tiers.every((tier) => communityOnly(tier));
  if (lead.risk === "blocked") {
    setLeadStatus(lead, "potential_risk", "Safety filter blocked this source.", stamp);
    return;
  }
  if (lead.risk === "suspicious") {
    setLeadStatus(lead, "potential_risk", "Suspicious source signals.", stamp);
    return;
  }
  if (lead.claimWindow === "expired") {
    setLeadStatus(lead, "expired", "Documented window is expired.", stamp);
    return;
  }
  if (lead.claimWindow === "closed") {
    setLeadStatus(lead, "window_closed", "Documented window is closed.", stamp);
    return;
  }
  if (lead.eligibility === "already_claimed") {
    setLeadStatus(lead, "already_claimed", "On-chain claimed mapping is true.", stamp);
    return;
  }
  if (lead.eligibility === "not_eligible" && lead.onchainEvidence !== "none") {
    setLeadStatus(lead, "eligibility_unknown", "Checked on-chain; this address was not shown as eligible.", stamp);
    return;
  }
  if (onlyCommunity) {
    setLeadStatus(lead, "investigating", "Community source alone cannot confirm an opportunity.", stamp);
    return;
  }
  const officialOk = canPromoteWithoutCorroboration(lead.discoverySource, lead.catalogId ? "official" : undefined);
  const corroborated =
    lead.evidence.length >= 2 &&
    lead.evidence.some((row) => row.sourceTier === "A" || row.sourceTier === "B");
  if (lead.historicalEvidence !== "none" || lead.onchainEvidence !== "none") {
    setLeadStatus(lead, lead.status === "discovered" ? "evidence_found" : lead.status, "Supporting evidence recorded.", stamp);
  }
  if (lead.eligibility === "confirmed") {
    setLeadStatus(lead, "eligibility_confirmed", "On-chain eligibility evidence found.", stamp);
    return;
  }
  if (officialOk || corroborated) {
    if (lead.eligibility === "unknown") {
      setLeadStatus(lead, "reviewable", "Enough independent evidence to review. Eligibility remains unknown.", stamp);
      return;
    }
  }
  if (lead.evidence.length >= 1 && lead.status === "discovered") {
    setLeadStatus(lead, "investigating", "Lead created; corroboration still required.", stamp);
  }
}

function fingerprintFromCatalog(claim: CatalogClaim): string {
  return leadFingerprint({
    catalogId: claim.id,
    chain: claim.chain,
    contract: claim.onChain?.distributor || claim.onChain?.token,
    officialHost: hostOf(claim.officialUrl),
    projectName: claim.title,
    kind: claim.kind,
  });
}

function fingerprintFromDiscovery(item: SeedDiscovery): string {
  return leadFingerprint({
    catalogId: item.catalogId,
    officialHost: hostOf(item.url),
    projectName: item.title,
    kind: item.kind,
  });
}

export function findLead(hunt: HuntRecord, fingerprint: string): LeadRecord | undefined {
  return hunt.leads.find((lead) => lead.fingerprint === fingerprint);
}

export function createLeadShell(hunt: HuntRecord, input: {
  fingerprint: string;
  projectName: string;
  opportunityType: ClaimKind | "unknown";
  discoverySource: string;
  catalogId?: string;
  chain?: string;
  token?: string;
  contract?: string;
  officialDomain?: string;
  officialDocumentation?: string;
  github?: string;
  claimability?: Claimability;
  claimWindow?: ClaimWindow;
  risk?: RiskEvidence;
  historicalLayer?: boolean;
}, at?: string): LeadRecord {
  const stamp = nowIso(at);
  const lead: LeadRecord = {
    id: newId(10),
    huntId: hunt.id,
    userId: hunt.userId,
    fingerprint: input.fingerprint,
    projectName: input.projectName,
    opportunityType: input.opportunityType,
    chain: input.chain,
    token: input.token,
    contract: input.contract,
    officialDomain: input.officialDomain,
    officialDocumentation: input.officialDocumentation,
    github: input.github,
    catalogId: input.catalogId,
    discoverySource: input.discoverySource,
    discoveryDate: stamp,
    historicalLayer: Boolean(input.historicalLayer),
    ...emptyLeadDimensions(),
    claimability: input.claimability,
    claimWindow: input.claimWindow ?? "unknown",
    risk: input.risk ?? "needs_review",
    status: "discovered",
    statusHistory: [{ at: stamp, status: "discovered", reason: "Raw discovery ingested." }],
    why: "",
    evidence: [],
    mentionCount: 0,
    lastChecked: stamp,
    createdAt: stamp,
    updatedAt: stamp,
  };
  hunt.leads.push(lead);
  hunt.seenFingerprints.push(input.fingerprint);
  return lead;
}

export function ingestCatalogClaim(hunt: HuntRecord, claim: CatalogClaim, at?: string): LeadRecord | null {
  if (claim.id === "tornado-avoided") return null;
  const fingerprint = fingerprintFromCatalog(claim);
  const stamp = nowIso(at);
  let lead = findLead(hunt, fingerprint);
  if (!lead) {
    if (hunt.leads.length >= hunt.maxLeads) return null;
    lead = createLeadShell(hunt, {
      fingerprint,
      projectName: claim.title,
      opportunityType: claim.kind,
      discoverySource: "catalog",
      catalogId: claim.id,
      chain: claim.chain,
      token: claim.asset,
      contract: claim.onChain?.distributor || claim.onChain?.token,
      officialDomain: hostOf(claim.officialUrl),
      officialDocumentation: claim.officialUrl,
      github: claim.sources.find((row) => row.kind === "github")?.url,
      claimability: claim.claimability,
      claimWindow: claimWindowFromCatalog(claim),
      risk: riskFromCatalog(claim),
      historicalLayer: claim.status === "archived" || claim.status === "expired",
    }, stamp);
  }
  addEvidence(lead, {
    type: "catalog",
    sourceKind: "catalog",
    sourceTier: tierForSource("catalog"),
    url: claim.officialUrl,
    label: "PoolIndex catalog",
    detail: claim.summary,
    at: stamp,
  });
  if (claim.archiveUrl) {
    addEvidence(lead, {
      type: "archive",
      sourceKind: "wayback",
      sourceTier: tierForSource("wayback"),
      url: claim.archiveUrl,
      label: "Catalog archive URL",
      detail: "Historical archive URL recorded from the catalog.",
      at: stamp,
    });
  }
  if (claim.onChain?.distributor || claim.onChain?.token) {
    addEvidence(lead, {
      type: "onchain",
      sourceKind: "onchain",
      sourceTier: tierForSource("onchain"),
      url: claim.onChain.explorerDistributorUrl || claim.onChain.explorerTokenUrl,
      label: "Catalog on-chain spec",
      detail: `Public contract recorded on ${claim.onChain.chainLabel}. Remaining balance is not proof of a claim.`,
      at: stamp,
    });
  }
  refreshLeadDimensions(lead);
  promoteLead(lead, stamp);
  recordFingerprint(hunt, "lead", fingerprint, lead, stamp);
  return lead;
}

export function ingestDiscovery(hunt: HuntRecord, item: SeedDiscovery, at?: string): LeadRecord | null {
  const stamp = nowIso(at);
  const blocked = shouldBlockDiscovery({ title: item.title, summary: item.summary, url: item.url });
  const fingerprint = fingerprintFromDiscovery(item);
  if (item.catalogId) {
    const claim = getClaimById(item.catalogId);
    if (claim) {
      const lead = ingestCatalogClaim(hunt, claim, stamp);
      if (lead) {
        addEvidence(lead, {
          type: item.source === "github" ? "github" : item.source === "wayback" || item.source === "archive_org" ? "archive" : "community",
          sourceKind: item.source,
          sourceTier: tierForSource(item.source),
          url: item.url,
          label: item.sourceLabel,
          detail: item.summary,
          at: stamp,
        });
        refreshLeadDimensions(lead);
        promoteLead(lead, stamp);
      }
      return lead;
    }
  }
  let lead = findLead(hunt, fingerprint);
  if (!lead) {
    if (hunt.leads.length >= hunt.maxLeads) return null;
    lead = createLeadShell(hunt, {
      fingerprint,
      projectName: item.title,
      opportunityType: item.kind,
      discoverySource: item.source,
      catalogId: item.catalogId,
      officialDomain: hostOf(item.url),
      github: item.source === "github" ? item.url : undefined,
      historicalLayer: item.source === "wayback" || item.source === "archive_org",
      risk: blocked.blocked ? "blocked" : item.legitimacy === "suspicious" ? "suspicious" : "needs_review",
    }, stamp);
  }
  const source = item.source as SourceKind;
  addEvidence(lead, {
    type: source === "github" ? "github" : source === "wayback" || source === "archive_org" ? "archive" : "community",
    sourceKind: source,
    sourceTier: tierForSource(source),
    url: item.url,
    label: item.sourceLabel,
    detail: item.summary,
    at: stamp,
  });
  if (blocked.blocked) {
    lead.risk = "blocked";
    setLeadStatus(lead, "potential_risk", blocked.reason || "Safety filter blocked this discovery.", stamp);
  } else {
    refreshLeadDimensions(lead);
    promoteLead(lead, stamp);
  }
  recordFingerprint(hunt, "lead", fingerprint, lead, stamp);
  return lead;
}

function recordFingerprint(hunt: HuntRecord, kind: string, key: string, lead: LeadRecord, at: string): void {
  const hash = resourceHash(`${lead.fingerprint}|${lead.status}|${lead.evidence.map((row) => row.type).join(",")}`);
  const existing = hunt.fingerprints.find((row) => row.key === resourceKey(kind, key));
  if (!existing) {
    hunt.fingerprints.push({ key: resourceKey(kind, key), hash, lastSeen: at, label: lead.projectName });
    hunt.changes.push({ at, kind: "fingerprint_new", leadId: lead.id, summary: `New fingerprint for ${lead.projectName}.` });
    return;
  }
  if (existing.hash !== hash) {
    existing.hash = hash;
    existing.lastSeen = at;
    hunt.changes.push({ at, kind: "source_changed", leadId: lead.id, summary: `Evidence or status changed for ${lead.projectName}.` });
  } else {
    existing.lastSeen = at;
  }
}

export function refreshHuntLeadCounts(hunt: HuntRecord): void {
  hunt.progress.leadsCreated = hunt.leads.length;
  hunt.progress.investigating = hunt.leads.filter((lead) => lead.status === "investigating").length;
  hunt.progress.rejected = hunt.leads.filter((lead) => lead.status === "rejected").length;
  hunt.progress.strongEvidence = hunt.leads.filter(
    (lead) => lead.historicalEvidence === "strong" || lead.onchainEvidence === "confirmed" || lead.status === "reviewable" || lead.status === "eligibility_confirmed",
  ).length;
}
