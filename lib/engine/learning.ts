import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthError } from "../auth.ts";
import { recordSecurity } from "../beta-store.ts";
import { CATALOG } from "../catalog.ts";
import { listFeedback } from "../feedback.ts";
import { engineDataRoot, writeEngineAtomic } from "./paths.ts";
import { ENGINE_SOURCES } from "./sources.ts";
import { catalogHasAddressLookup } from "./coverage.ts";
import type {
  CompetitorRecord,
  LearningState,
  ProposalStatus,
  SourceProposal,
} from "./learning-types.ts";

const SEED_COMPETITORS: CompetitorRecord[] = [
  {
    id: "airdrop-checker-x402",
    name: "airdrop-checker-x402",
    url: "https://github.com/Br0ski777/airdrop-checker-x402",
    license: "MIT",
    stance: "architecture_ok",
    notes:
      "Learn structured eligibility results only. Do not copy airdrop lists, Etherscan scraping, x402, or MCP server code.",
    lastReviewedAt: "2026-09-21T00:00:00.000Z",
  },
  {
    id: "airdrop-checker-other",
    name: "Airdrop-Checker",
    url: "https://github.com/lif3time-secr3t-c0de/Airdrop-Checker",
    license: "Other / NOASSERTION",
    stance: "architecture_only",
    notes: "Architecture from the public description only. Do not clone, read, or copy that repository’s source.",
    lastReviewedAt: "2026-09-21T00:00:00.000Z",
  },
];

const V1_CHAINS = new Set(["ethereum", "optimism", "arbitrum", "base", "polygon", "multi"]);

function storePath(): string {
  return join(engineDataRoot(), "learning.json");
}

function emptyState(): LearningState {
  return { competitors: {}, proposals: {} };
}

export function loadLearningState(): LearningState {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), "utf8")) as LearningState;
    return {
      competitors: parsed.competitors && typeof parsed.competitors === "object" ? parsed.competitors : {},
      proposals: parsed.proposals && typeof parsed.proposals === "object" ? parsed.proposals : {},
    };
  } catch {
    return emptyState();
  }
}

function saveLearningState(state: LearningState): void {
  writeEngineAtomic(storePath(), `${JSON.stringify(state, null, 2)}\n`);
}

function mutateLearning<T>(fn: (state: LearningState) => T): T {
  const state = loadLearningState();
  const result = fn(state);
  saveLearningState(state);
  return result;
}

export function listCompetitors(): CompetitorRecord[] {
  const stored = loadLearningState().competitors;
  return SEED_COMPETITORS.map((row) => {
    const overlay = stored[row.id];
    if (!overlay) return row;
    return {
      ...row,
      notes: overlay.notes || row.notes,
      lastReviewedAt: overlay.lastReviewedAt || row.lastReviewedAt,
    };
  });
}

function catalogGapProposals(now: string): SourceProposal[] {
  return CATALOG.filter(
    (claim) =>
      claim.kind === "airdrop" &&
      claim.legitimacy === "official" &&
      !catalogHasAddressLookup(claim.id),
  ).map((claim) => {
    const v1 = V1_CHAINS.has(claim.chain);
    const engine = ENGINE_SOURCES.some((source) => source.catalogId === claim.id);
    return {
      id: `catalog:${claim.id}`,
      origin: "catalog_gap" as const,
      status: "queued" as const,
      title: claim.title,
      detail: !v1
        ? `Official catalog airdrop is outside the current v1 chain set (${claim.chain}). Keep queued; do not add a live adapter from this screen.`
        : engine
          ? `Official catalog airdrop has an engine row but no hosted merkle/API lookup. Request Coverage — do not invent eligibility.`
          : `Official catalog airdrop has no wallet-level engine adapter yet. Request Coverage — do not invent eligibility.`,
      catalogId: claim.id,
      chain: claim.chain,
      officialUrl: claim.officialUrl,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function feedbackProposals(now: string): SourceProposal[] {
  const rows: SourceProposal[] = [];
  for (const row of listFeedback()) {
    if (row.type !== "useful" && row.type !== "broken_link" && row.type !== "report_problem" && row.type !== "expired") {
      continue;
    }
    const catalogId = row.claimId || undefined;
    const key = catalogId || row.source;
    if (!key) continue;
    rows.push({
      id: `feedback:${key}`,
      origin: "feedback",
      status: "queued",
      title: catalogId ? `Feedback on ${catalogId}` : `Feedback on ${row.source}`,
      detail: `${row.type}: ${(row.note || "no note").slice(0, 240)} Public feedback is research. It does not change adapter trust or production sources.`,
      catalogId,
      feedbackType: row.type,
      createdAt: row.createdAt,
      updatedAt: now,
    });
  }
  return rows;
}

export function syncOperatorLearning(now = new Date().toISOString()): void {
  mutateLearning((state) => {
    for (const proposal of [...catalogGapProposals(now), ...feedbackProposals(now)]) {
      const existing = state.proposals[proposal.id];
      if (!existing) {
        state.proposals[proposal.id] = proposal;
        continue;
      }
      if (existing.status !== "queued") {
        existing.detail = proposal.detail;
        existing.title = proposal.title;
        existing.updatedAt = now;
        continue;
      }
      existing.detail = proposal.detail;
      existing.title = proposal.title;
      existing.officialUrl = proposal.officialUrl ?? existing.officialUrl;
      existing.chain = proposal.chain ?? existing.chain;
      existing.feedbackType = proposal.feedbackType ?? existing.feedbackType;
      existing.updatedAt = now;
    }
  });
}

export function listSourceProposals(): SourceProposal[] {
  return Object.values(loadLearningState().proposals).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function decideSourceProposal(id: string, decision: Exclude<ProposalStatus, "queued">, actorId: string): SourceProposal {
  return mutateLearning((state) => {
    const row = state.proposals[id];
    if (!row) throw new AuthError(404, "PROPOSAL_NOT_FOUND", "Source proposal not found.");
    if (row.status === "rejected" && decision !== "rejected") {
      throw new AuthError(409, "PROPOSAL_REJECTED", "Rejected proposals stay out of production.");
    }
    if (row.status === "shipped" && decision !== "shipped") {
      throw new AuthError(409, "PROPOSAL_SHIPPED", "Shipped is an operator confirmation after a code deploy.");
    }
    row.status = decision;
    row.decidedBy = actorId;
    row.updatedAt = new Date().toISOString();
    recordSecurity({ type: `learning_proposal_${decision}`, userId: actorId, detail: row.id });
    return { ...row };
  });
}

export function updateCompetitorNotes(id: string, notes: string, actorId: string): CompetitorRecord {
  const seed = SEED_COMPETITORS.find((row) => row.id === id);
  if (!seed) throw new AuthError(404, "COMPETITOR_NOT_FOUND", "Unknown competitor research record.");
  const cleaned = notes.trim().slice(0, 800);
  mutateLearning((state) => {
    state.competitors[id] = { notes: cleaned, lastReviewedAt: new Date().toISOString() };
  });
  recordSecurity({ type: "learning_competitor_note", userId: actorId, detail: id });
  return listCompetitors().find((row) => row.id === id) ?? { ...seed, notes: cleaned };
}

export function operatorLearningSnapshot() {
  syncOperatorLearning();
  return {
    autoProductionChanges: false as const,
    engineAdapterCount: ENGINE_SOURCES.length,
    competitors: listCompetitors(),
    proposals: listSourceProposals(),
  };
}

export function learningDoesNotMutateProduction(): true {
  return true;
}
