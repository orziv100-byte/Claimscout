import { isHexAddress } from "../address.ts";
import { AuthError } from "../auth.ts";
import { filterCatalog, getClaimById } from "../catalog.ts";
import { recordTelemetry } from "../beta-store.ts";
import { scansAreOpen } from "../ops.ts";
import type { PlanId } from "../plan.ts";
import { newId } from "../password.ts";
import { readResourceSnapshot, type PressureLevel } from "../resource-guard.ts";
import type { LookupFn } from "../ssrf.ts";
import { assertNoSecretMaterial } from "../secrets-guard.ts";
import type { DiscoveredClaim, LiveSourceResult } from "../types.ts";
import { resourceHash, resourceKey } from "./fingerprint.ts";
import { ingestCatalogClaim, ingestDiscovery, refreshHuntLeadCounts, addEvidence, promoteLead, refreshLeadDimensions } from "./leads.ts";
import { huntLimits } from "./limits.ts";
import { notifyHuntCompleted, notifyNewLead, type NotifyFn } from "./notify.ts";
import { communityOnly, tierForSource } from "./reputation.ts";
import {
  activeHuntForUser,
  findHuntById,
  latestCompletedHunt,
  listAllHunts,
  listUserHunts,
  loadHuntForUser,
  saveHunt,
  withHuntLock,
} from "./store.ts";
import {
  assertPublicTarget,
  enqueueTrail,
  githubParts,
  isSsrfBlocked,
  trailAllowed,
} from "./trail.ts";
import { researchWalletClaim, type EligibilityFn } from "./wallet.ts";
import type {
  HuntMode,
  HuntProgress,
  HuntRecord,
  HuntSeed,
  HuntStatus,
  HuntTask,
  ReturnDigest,
  SeedDiscovery,
} from "./types.ts";

export type HuntAdapters = {
  searchGitHub?: (query: string) => Promise<LiveSourceResult>;
  searchWayback?: (query: string) => Promise<LiveSourceResult>;
  searchArchiveOrg?: (query: string) => Promise<LiveSourceResult>;
  waybackAvailable?: (url: string) => Promise<{ available: boolean; snapshotUrl?: string; timestamp?: string }>;
  cdxSearch?: (urlPattern: string, limit?: number) => Promise<{ timestamp: string; original: string }[]>;
  checkEligibility?: EligibilityFn;
  sendMail?: NotifyFn;
};

export type HuntDeps = {
  now?: () => Date;
  adapters?: HuntAdapters;
  scansOpen?: () => boolean;
  resourceLevel?: () => PressureLevel;
  lookup?: LookupFn;
};

const RESOURCE_PAUSE = "Deep Hunt paused — server protection active.";
const KILL_PAUSE = "Deep Hunt paused — scanning is stopped by the operator.";

function iso(deps: HuntDeps): string {
  return (deps.now?.() ?? new Date()).toISOString();
}

function epoch(deps: HuntDeps): number {
  return (deps.now?.() ?? new Date()).getTime();
}

function emptyProgress(): HuntProgress {
  return {
    sourcesChecked: 0,
    sourcesQueued: 0,
    pagesInspected: 0,
    rawDiscoveries: 0,
    leadsCreated: 0,
    strongEvidence: 0,
    investigating: 0,
    rejected: 0,
  };
}

function track(type: string, userId: string, detail?: string) {
  recordTelemetry({ type, userId, detail: detail?.slice(0, 200) });
}

function discoveryFromLive(item: DiscoveredClaim): SeedDiscovery {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    kind: item.kind,
    source: item.source,
    sourceLabel: item.sourceLabel,
    publishedAt: item.publishedAt,
    legitimacy: item.legitimacy,
    flags: item.flags,
    archiveUrl: item.archiveUrl,
    catalogId: item.catalogId,
  };
}

function buildQueue(plan: PlanId, mode: HuntMode, catalogIds: string[]): HuntTask[] {
  const limits = huntLimits(plan);
  const queue: HuntTask[] = [];
  if (mode === "continuous") {
    if (limits.changeDetection) queue.push({ kind: "change_detection" });
    queue.push({ kind: "finalize" });
    return queue;
  }
  if (limits.sources.includes("catalog")) queue.push({ kind: "source", source: "catalog" });
  if (limits.sources.includes("github")) queue.push({ kind: "source", source: "github" });
  if (limits.sources.includes("wayback")) queue.push({ kind: "source", source: "wayback" });
  if (limits.sources.includes("archive_org")) queue.push({ kind: "source", source: "archive_org" });
  if (limits.historical) queue.push({ kind: "historical" });
  for (const id of catalogIds.slice(0, 12)) {
    queue.push({ kind: "corroborate", leadId: `catalog:${id}` });
  }
  if (limits.changeDetection) queue.push({ kind: "change_detection" });
  queue.push({ kind: "finalize" });
  return queue;
}

function refreshElapsed(hunt: HuntRecord, deps: HuntDeps): void {
  const now = epoch(deps);
  const started = Date.parse(hunt.startedAt);
  let paused = hunt.pausedAccumMs;
  if (hunt.status === "paused" && hunt.pauseStartedAt) {
    paused += Math.max(0, now - Date.parse(hunt.pauseStartedAt));
  }
  hunt.elapsedMs = Math.max(0, now - started - paused);
}

function pauseHuntRecord(hunt: HuntRecord, reason: string, deps: HuntDeps): HuntRecord {
  if (hunt.status === "paused") {
    hunt.pauseReason = reason;
    hunt.updatedAt = iso(deps);
    return hunt;
  }
  if (hunt.status !== "running" && hunt.status !== "queued") return hunt;
  hunt.status = "paused";
  hunt.pauseReason = reason;
  hunt.pauseStartedAt = iso(deps);
  hunt.updatedAt = iso(deps);
  hunt.resourceState = reason === RESOURCE_PAUSE ? "paused_resource" : "paused";
  refreshElapsed(hunt, deps);
  return hunt;
}

function insertBeforeFinalize(hunt: HuntRecord, task: HuntTask): void {
  if (hunt.queue.some((row) => JSON.stringify(row) === JSON.stringify(task))) return;
  const idx = hunt.queue.findIndex((row) => row.kind === "finalize");
  if (idx === -1) hunt.queue.push(task);
  else hunt.queue.splice(idx, 0, task);
}

function queueLeadFollowup(hunt: HuntRecord, lead: { id: string; catalogId?: string }): void {
  insertBeforeFinalize(hunt, { kind: "corroborate", leadId: lead.id });
  if (huntLimits(hunt.plan).walletIntel && hunt.wallet && lead.catalogId) {
    insertBeforeFinalize(hunt, { kind: "wallet", claimId: lead.catalogId });
  }
}

export const silentAdapters: HuntAdapters = {
  searchGitHub: async () => ({ items: [], blocked: 0 }),
  searchWayback: async () => ({ items: [], blocked: 0 }),
  searchArchiveOrg: async () => ({ items: [], blocked: 0 }),
  waybackAvailable: async () => ({ available: false }),
  cdxSearch: async () => [],
  checkEligibility: async (claimId, address) => ({
    claimId,
    address,
    status: "unknown",
    detail: "No on-chain adapter in this test.",
  }),
  sendMail: async () => ({ delivered: false, provider: "outbox" }),
};

export async function startHunt(input: {
  userId: string;
  plan: PlanId;
  query: string;
  wallet?: string;
  wallets?: string[];
  mode?: HuntMode;
  seed?: HuntSeed;
}, deps: HuntDeps = {}): Promise<HuntRecord> {
  const query = input.query.trim().slice(0, 120);
  if (!query) throw new AuthError(400, "QUERY_REQUIRED", "Enter a search query before starting Deep Hunt.");
  assertNoSecretMaterial(query, "query");
  const mode = input.mode ?? "deep";
  const limits = huntLimits(input.plan);
  if (!limits.deepHunt) throw new AuthError(403, "PLAN_LIMIT", "Deep Hunt is not available on this plan.");
  if (mode === "continuous" && !limits.continuous) {
    throw new AuthError(403, "PLAN_LIMIT", "Continuous Hunt is a PoolIndex Pro planned feature.");
  }
  let wallet: string | undefined;
  if (input.wallet) {
    if (!isHexAddress(input.wallet)) throw new AuthError(400, "INVALID_WALLET", "Use a public 0x address only.");
    const already = (input.wallets ?? []).some((row) => row.toLowerCase() === input.wallet!.toLowerCase());
    if (!already) {
      throw new AuthError(403, "WALLET_NOT_BOUND", "Bind this public wallet on your account before using it in a hunt.");
    }
    wallet = input.wallet.toLowerCase();
  }

  return withHuntLock(async () => {
    const active = activeHuntForUser(input.userId);
    if (active) {
      throw new AuthError(409, "HUNT_ACTIVE", "Pause or stop the current hunt before starting another.");
    }
    const previous = latestCompletedHunt(input.userId, query);
    if (mode === "continuous" && !previous) {
      throw new AuthError(400, "NO_PRIOR_HUNT", "Continuous Hunt needs a prior completed Deep Hunt for this query.");
    }
    const at = iso(deps);
    const catalogIds = [
      ...new Set([
        ...(input.seed?.catalogIds ?? []),
        ...(input.seed?.discovered ?? []).map((row) => row.catalogId).filter((id): id is string => Boolean(id)),
      ]),
    ];
    const queue = buildQueue(input.plan, mode, []);
    const hunt: HuntRecord = {
      id: newId(),
      userId: input.userId,
      query,
      wallet,
      mode,
      plan: input.plan,
      status: "running",
      stage: "ingest",
      startedAt: at,
      updatedAt: at,
      elapsedMs: 0,
      pausedAccumMs: 0,
      slicesThisWindow: 0,
      sliceWindowStart: at,
      previousHuntId: previous?.id,
      progress: emptyProgress(),
      queue,
      seenUrls: [],
      seenFingerprints: [],
      trailUsed: 0,
      maxTrailDepth: limits.maxTrailDepth,
      maxDerivedTargets: limits.maxDerivedTargets,
      maxLeads: limits.maxLeads,
      leads: [],
      changes: [],
      fingerprints: previous?.fingerprints ? previous.fingerprints.map((row) => ({ ...row })) : [],
      previousFingerprintCount: previous?.fingerprints.length ?? 0,
      notifications: [],
      errors: [],
    };
    hunt.progress.sourcesQueued = hunt.queue.filter((task) => task.kind === "source" || task.kind === "historical" || task.kind === "change_detection").length;

    if (mode === "continuous" && previous) {
      hunt.leads = previous.leads.map((lead) => ({
        ...lead,
        id: newId(10),
        huntId: hunt.id,
        evidence: lead.evidence.map((row) => ({ ...row })),
        statusHistory: lead.statusHistory.map((row) => ({ ...row })),
      }));
      for (const lead of hunt.leads) {
        enqueueTrail(hunt, lead, 0);
      }
      refreshHuntLeadCounts(hunt);
    } else if (input.seed) {
      for (const id of catalogIds) {
        const claim = getClaimById(id);
        if (claim) ingestCatalogClaim(hunt, claim, at);
      }
      for (const item of input.seed.discovered) {
        hunt.progress.rawDiscoveries += 1;
        ingestDiscovery(hunt, item, at);
        hunt.progress.pagesInspected += 1;
      }
      refreshHuntLeadCounts(hunt);
      for (const lead of hunt.leads) queueLeadFollowup(hunt, lead);
    }

    hunt.stage = hunt.queue[0]?.kind === "source" ? hunt.queue[0].source : hunt.queue[0]?.kind === "finalize" ? "finalize" : "ingest";
    saveHunt(hunt);
    track(mode === "continuous" ? "CONTINUOUS_HUNT_STARTED" : "DEEP_HUNT_STARTED", input.userId, hunt.id);
    return hunt;
  });
}

export async function pauseHunt(userId: string, huntId: string, reason = "Paused by user.", deps: HuntDeps = {}): Promise<HuntRecord> {
  return withHuntLock(async () => {
    const hunt = loadHuntForUser(userId, huntId);
    pauseHuntRecord(hunt, reason, deps);
    saveHunt(hunt);
    track("DEEP_HUNT_PAUSED", userId, huntId);
    return hunt;
  });
}

export async function resumeHunt(userId: string, huntId: string, deps: HuntDeps = {}): Promise<HuntRecord> {
  return withHuntLock(async () => {
    const hunt = loadHuntForUser(userId, huntId);
    if (hunt.status !== "paused") {
      throw new AuthError(409, "HUNT_NOT_PAUSED", "Only a paused hunt can be resumed.");
    }
    if (!(deps.scansOpen ?? scansAreOpen)()) {
      throw new AuthError(503, "SCANS_PAUSED", KILL_PAUSE);
    }
    const level = (deps.resourceLevel ?? (() => readResourceSnapshot().level))();
    if (level === "critical") {
      throw new AuthError(503, "RESOURCE_PRESSURE", RESOURCE_PAUSE);
    }
    if (hunt.pauseStartedAt) {
      hunt.pausedAccumMs += Math.max(0, epoch(deps) - Date.parse(hunt.pauseStartedAt));
    }
    hunt.status = "running";
    hunt.pauseReason = undefined;
    hunt.pauseStartedAt = undefined;
    hunt.resourceState = "ok";
    hunt.updatedAt = iso(deps);
    refreshElapsed(hunt, deps);
    saveHunt(hunt);
    track("DEEP_HUNT_RESUMED", userId, huntId);
    return hunt;
  });
}

export async function stopHunt(userId: string, huntId: string, deps: HuntDeps = {}): Promise<HuntRecord> {
  return withHuntLock(async () => {
    const hunt = loadHuntForUser(userId, huntId);
    if (hunt.status === "completed" || hunt.status === "stopped") return hunt;
    hunt.status = "stopped";
    hunt.queue = [];
    hunt.updatedAt = iso(deps);
    hunt.completedAt = iso(deps);
    hunt.pauseReason = undefined;
    refreshElapsed(hunt, deps);
    refreshHuntLeadCounts(hunt);
    saveHunt(hunt);
    track("DEEP_HUNT_STOPPED", userId, huntId);
    return hunt;
  });
}

export async function adminStopHunt(huntId: string, deps: HuntDeps = {}): Promise<HuntRecord> {
  return withHuntLock(async () => {
    const hunt = findHuntById(huntId);
    if (!hunt) throw new AuthError(404, "HUNT_NOT_FOUND", "Hunt not found.");
    hunt.status = "stopped";
    hunt.queue = [];
    hunt.updatedAt = iso(deps);
    hunt.completedAt = iso(deps);
    refreshElapsed(hunt, deps);
    saveHunt(hunt);
    track("DEEP_HUNT_STOPPED", hunt.userId, huntId);
    return hunt;
  });
}

function allowSlice(hunt: HuntRecord, deps: HuntDeps): boolean {
  const limits = huntLimits(hunt.plan);
  const now = epoch(deps);
  const windowStart = Date.parse(hunt.sliceWindowStart);
  if (now - windowStart >= 60_000) {
    hunt.sliceWindowStart = iso(deps);
    hunt.slicesThisWindow = 0;
  }
  if (hunt.slicesThisWindow >= limits.maxSlicesPerMinute) return false;
  hunt.slicesThisWindow += 1;
  hunt.lastSliceAt = iso(deps);
  return true;
}

async function defaultAdapters(): Promise<Required<Pick<HuntAdapters, "searchGitHub" | "searchWayback" | "searchArchiveOrg" | "waybackAvailable" | "cdxSearch">>> {
  const [{ searchGitHub }, { searchWayback, waybackAvailable, cdxSearch }, { searchArchiveOrg }] = await Promise.all([
    import("../sources/github.ts"),
    import("../sources/wayback.ts"),
    import("../sources/archive-org.ts"),
  ]);
  return { searchGitHub, searchWayback, searchArchiveOrg, waybackAvailable, cdxSearch };
}

async function sourceRunner(source: "github" | "wayback" | "archive_org", query: string, adapters: HuntAdapters): Promise<LiveSourceResult> {
  if (source === "github") {
    const run = adapters.searchGitHub ?? (await defaultAdapters()).searchGitHub;
    return run(query);
  }
  if (source === "wayback") {
    const run = adapters.searchWayback ?? (await defaultAdapters()).searchWayback;
    return run(query);
  }
  const run = adapters.searchArchiveOrg ?? (await defaultAdapters()).searchArchiveOrg;
  return run(query);
}

async function ingestLive(hunt: HuntRecord, items: DiscoveredClaim[], deps: HuntDeps): Promise<void> {
  const at = iso(deps);
  hunt.progress.pagesInspected += items.length;
  hunt.progress.rawDiscoveries += items.length;
  const known = new Set(hunt.leads.map((lead) => lead.id));
  for (const item of items) {
    const lead = ingestDiscovery(hunt, discoveryFromLive(item), at);
    if (lead && !known.has(lead.id)) {
      known.add(lead.id);
      queueLeadFollowup(hunt, lead);
    }
  }
  refreshHuntLeadCounts(hunt);
}

async function runSource(hunt: HuntRecord, source: "catalog" | "github" | "wayback" | "archive_org", deps: HuntDeps): Promise<void> {
  hunt.stage = source;
  const adapters = deps.adapters ?? {};
  if (source === "catalog") {
    const rows = filterCatalog({ query: hunt.query });
    hunt.progress.pagesInspected += rows.length;
    const at = iso(deps);
    for (const claim of rows) ingestCatalogClaim(hunt, claim, at);
    for (const lead of hunt.leads) queueLeadFollowup(hunt, lead);
    hunt.progress.sourcesChecked += 1;
    refreshHuntLeadCounts(hunt);
    return;
  }
  let result: LiveSourceResult = { items: [], blocked: 0 };
  result = await sourceRunner(source, hunt.query, adapters);
  if (result.error) {
    hunt.errors.push({ at: iso(deps), stage: source, message: result.error });
  }
  await ingestLive(hunt, result.items, deps);
  hunt.progress.sourcesChecked += 1;
}

async function runHistorical(hunt: HuntRecord, deps: HuntDeps): Promise<void> {
  hunt.stage = "historical";
  if (!huntLimits(hunt.plan).historical) {
    hunt.progress.sourcesChecked += 1;
    return;
  }
  const adapters = deps.adapters ?? {};
  const cdx = adapters.cdxSearch ?? (await defaultAdapters()).cdxSearch;
  const at = iso(deps);
  const leads = hunt.leads.filter((lead) => lead.officialDomain || lead.officialDocumentation).slice(0, 6);
  for (const lead of leads) {
    const pattern = lead.officialDocumentation || (lead.officialDomain ? `https://${lead.officialDomain}/*` : "");
    if (!pattern) continue;
    try {
      await assertPublicTarget(pattern.replace("/*", "/"), deps.lookup);
    } catch (err) {
      if (isSsrfBlocked(err)) {
        hunt.errors.push({ at, stage: "historical", message: "Blocked unsafe historical URL." });
        continue;
      }
    }
    try {
      const rows = await cdx(pattern, 6);
      hunt.progress.pagesInspected += rows.length;
      if (rows.length) {
        addEvidence(lead, {
          type: "historical",
          sourceKind: "wayback",
          sourceTier: tierForSource("wayback"),
          url: rows[0]?.original,
          label: "Wayback CDX",
          detail: `${rows.length} historical snapshot(s) recorded. This is historical investigation, not a claim of remaining funds.`,
          at,
        });
        lead.historicalLayer = true;
        refreshLeadDimensions(lead);
        promoteLead(lead, at);
      }
    } catch (err) {
      hunt.errors.push({ at, stage: "historical", message: err instanceof Error ? err.message : "historical failed" });
    }
  }
  hunt.progress.sourcesChecked += 1;
  refreshHuntLeadCounts(hunt);
}

async function runCorroborate(hunt: HuntRecord, leadId: string, deps: HuntDeps): Promise<void> {
  hunt.stage = "corroboration";
  const lead = hunt.leads.find((row) => row.id === leadId || row.fingerprint === leadId || row.catalogId && `catalog:${row.catalogId}` === leadId);
  if (!lead) return;
  const at = iso(deps);
  hunt.progress.pagesInspected += 1;
  if (lead.catalogId && !lead.evidence.some((row) => row.type === "catalog")) {
    const claim = getClaimById(lead.catalogId);
    if (claim) ingestCatalogClaim(hunt, claim, at);
  }
  const github = githubParts(lead.github);
  if (github && huntLimits(hunt.plan).sources.includes("github")) {
    try {
      const result = await (deps.adapters?.searchGitHub ?? (await defaultAdapters()).searchGitHub)(github.repo || github.org);
      hunt.progress.pagesInspected += result.items.length;
      const hit = result.items.find((item) => item.url.toLowerCase().includes(github.org.toLowerCase()));
      if (hit) {
        addEvidence(lead, {
          type: "github",
          sourceKind: "github",
          sourceTier: tierForSource("github"),
          url: hit.url,
          label: "GitHub corroboration",
          detail: hit.summary,
          at,
        });
      }
    } catch (err) {
      hunt.errors.push({ at, stage: "corroboration", message: err instanceof Error ? err.message : "github corroboration failed" });
    }
  }
  if (lead.officialDocumentation && huntLimits(hunt.plan).sources.includes("wayback")) {
    try {
      await assertPublicTarget(lead.officialDocumentation, deps.lookup);
      const snap = await (deps.adapters?.waybackAvailable ?? (await defaultAdapters()).waybackAvailable)(lead.officialDocumentation);
      hunt.progress.pagesInspected += 1;
      if (snap.available && snap.snapshotUrl) {
        addEvidence(lead, {
          type: "archive",
          sourceKind: "wayback",
          sourceTier: tierForSource("wayback"),
          url: snap.snapshotUrl,
          label: "Wayback snapshot",
          detail: `Archive snapshot ${snap.timestamp || "recorded"}.`,
          at,
        });
      }
    } catch (err) {
      if (isSsrfBlocked(err)) {
        hunt.errors.push({ at, stage: "corroboration", message: "Blocked unsafe corroboration URL." });
      }
    }
  }
  refreshLeadDimensions(lead);
  const before = lead.status;
  promoteLead(lead, at);
  if (communityOnly(tierForSource(lead.discoverySource)) && lead.evidence.every((row) => communityOnly(row.sourceTier))) {
    lead.status = "investigating";
  }
  enqueueTrail(hunt, lead, 0);
  if (lead.status !== before && (lead.status === "reviewable" || lead.historicalEvidence === "strong")) {
    hunt.changes.push({ at, kind: "stronger_evidence", leadId: lead.id, summary: `${lead.projectName} gained corroborating evidence.` });
    await notifyNewLead(hunt, lead, { sendMail: deps.adapters?.sendMail });
  }
  refreshHuntLeadCounts(hunt);
}

async function runTrail(hunt: HuntRecord, task: Extract<HuntTask, { kind: "trail" }>, deps: HuntDeps): Promise<void> {
  hunt.stage = "trail";
  const allowed = trailAllowed(hunt, task.url, task.depth);
  if (!allowed.ok && !hunt.seenUrls.includes(task.url.toLowerCase())) return;
  try {
    await assertPublicTarget(task.url, deps.lookup);
  } catch (err) {
    hunt.errors.push({ at: iso(deps), stage: "trail", message: isSsrfBlocked(err) ? "Blocked unsafe trail URL." : "Invalid trail URL." });
    return;
  }
  hunt.progress.pagesInspected += 1;
  const lead = hunt.leads.find((row) => row.id === task.fromLeadId);
  if (!lead) return;
  const at = iso(deps);
  const parts = githubParts(task.url);
  const limits = huntLimits(hunt.plan);
  if (parts && limits.sources.includes("github")) {
    const result = await (deps.adapters?.searchGitHub ?? (await defaultAdapters()).searchGitHub)(parts.repo || parts.org);
    hunt.progress.rawDiscoveries += result.items.length;
    await ingestLive(hunt, result.items, deps);
  } else if (limits.sources.includes("wayback")) {
    const snap = await (deps.adapters?.waybackAvailable ?? (await defaultAdapters()).waybackAvailable)(task.url);
    if (snap.available && snap.snapshotUrl) {
      addEvidence(lead, {
        type: "archive",
        sourceKind: "wayback",
        sourceTier: tierForSource("wayback"),
        url: snap.snapshotUrl,
        label: "Trail archive",
        detail: "Archive snapshot found while following a related public URL.",
        at,
      });
      refreshLeadDimensions(lead);
      promoteLead(lead, at);
    }
  }
  enqueueTrail(hunt, lead, task.depth);
  refreshHuntLeadCounts(hunt);
}

async function runChangeDetection(hunt: HuntRecord, deps: HuntDeps): Promise<void> {
  hunt.stage = "change_detection";
  if (!huntLimits(hunt.plan).changeDetection) {
    hunt.progress.sourcesChecked += 1;
    return;
  }
  const previous = hunt.previousHuntId ? latestCompletedHunt(hunt.userId, hunt.query) : null;
  const at = iso(deps);
  let changed = 0;
  for (const lead of hunt.leads) {
    const hash = resourceHash(`${lead.fingerprint}|${lead.status}|${lead.evidence.map((row) => `${row.type}:${row.url ?? ""}`).join(",")}`);
    const key = resourceKey("lead", lead.fingerprint);
    const prior = hunt.fingerprints.find((row) => row.key === key) || previous?.fingerprints.find((row) => row.key === key);
    if (!prior) {
      hunt.fingerprints.push({ key, hash, lastSeen: at, label: lead.projectName });
      hunt.changes.push({ at, kind: "new_lead", leadId: lead.id, summary: `New lead ${lead.projectName}.` });
      changed += 1;
    } else if (prior.hash !== hash) {
      prior.hash = hash;
      prior.lastSeen = at;
      hunt.changes.push({ at, kind: "source_changed", leadId: lead.id, summary: `${lead.projectName} changed since last check.` });
      changed += 1;
    }
    hunt.progress.pagesInspected += 1;
  }
  if (changed && hunt.mode === "continuous") {
    track("CONTINUOUS_HUNT_CHANGE_FOUND", hunt.userId, String(changed));
  }
  hunt.progress.sourcesChecked += 1;
}

async function runFinalize(hunt: HuntRecord, deps: HuntDeps): Promise<void> {
  hunt.stage = "finalize";
  refreshHuntLeadCounts(hunt);
  hunt.status = "completed";
  hunt.completedAt = iso(deps);
  hunt.queue = [];
  refreshElapsed(hunt, deps);
  await notifyHuntCompleted(hunt, { sendMail: deps.adapters?.sendMail });
  track(hunt.mode === "continuous" ? "CONTINUOUS_HUNT_COMPLETED" : "DEEP_HUNT_COMPLETED", hunt.userId, hunt.id);
}

export async function tickHunt(userId: string, huntId: string, deps: HuntDeps = {}): Promise<HuntRecord> {
  return withHuntLock(async () => {
    const hunt = loadHuntForUser(userId, huntId);
    if (hunt.status === "stopped" || hunt.status === "completed" || hunt.status === "failed") return hunt;
    if (hunt.status === "paused") return hunt;
    if (!(deps.scansOpen ?? scansAreOpen)()) {
      pauseHuntRecord(hunt, KILL_PAUSE, deps);
      saveHunt(hunt);
      track("DEEP_HUNT_PAUSED", userId, huntId);
      return hunt;
    }
    const level = (deps.resourceLevel ?? (() => readResourceSnapshot().level))();
    if (level === "critical") {
      pauseHuntRecord(hunt, RESOURCE_PAUSE, deps);
      saveHunt(hunt);
      track("DEEP_HUNT_PAUSED", userId, huntId);
      return hunt;
    }
    if (!allowSlice(hunt, deps)) {
      hunt.updatedAt = iso(deps);
      saveHunt(hunt);
      return hunt;
    }
    const task = hunt.queue.shift();
    if (!task) {
      await runFinalize(hunt, deps);
      saveHunt(hunt);
      return hunt;
    }
    try {
      if (task.kind === "source") await runSource(hunt, task.source, deps);
      else if (task.kind === "historical") await runHistorical(hunt, deps);
      else if (task.kind === "corroborate") await runCorroborate(hunt, task.leadId, deps);
      else if (task.kind === "trail") await runTrail(hunt, task, deps);
      else if (task.kind === "wallet") {
        hunt.stage = "wallet";
        if (huntLimits(hunt.plan).walletIntel) {
          await researchWalletClaim(hunt, task.claimId, {
            checkEligibility: deps.adapters?.checkEligibility,
            now: () => iso(deps),
          });
          track("WALLET_RESEARCH_STARTED", hunt.userId, task.claimId);
        }
        refreshHuntLeadCounts(hunt);
      } else if (task.kind === "change_detection") await runChangeDetection(hunt, deps);
      else if (task.kind === "finalize") await runFinalize(hunt, deps);
      if (task.kind === "trail") track("TRAIL_FOLLOWED", hunt.userId, String(hunt.trailUsed));
      refreshElapsed(hunt, deps);
      hunt.updatedAt = iso(deps);
      if (hunt.status === "running" && hunt.queue.length === 0 && hunt.stage !== "finalize") {
        await runFinalize(hunt, deps);
      }
      saveHunt(hunt);
      return hunt;
    } catch (err) {
      hunt.status = "failed";
      hunt.error = err instanceof Error ? err.message : "Hunt failed";
      hunt.updatedAt = iso(deps);
      hunt.errors.push({ at: iso(deps), stage: hunt.stage, message: hunt.error });
      saveHunt(hunt);
      track("DEEP_HUNT_FAILED", userId, hunt.error);
      return hunt;
    }
  });
}

export function returnDigest(userId: string, hunt?: HuntRecord): ReturnDigest {
  const current = hunt;
  const previous = latestCompletedHunt(userId, current?.query);
  const capturedAt = new Date().toISOString();
  if (!current || !previous || previous.id === current.id) {
    return {
      previousHuntId: previous && previous.id !== current?.id ? previous.id : current?.previousHuntId ?? null,
      sourcesRechecked: current?.progress.sourcesChecked ?? 0,
      sourcesChanged: current?.changes.filter((row) => row.kind === "source_changed").length ?? 0,
      newLeads: current?.changes.filter((row) => row.kind === "new_lead").length ?? 0,
      strongerEvidence: current?.changes.filter((row) => row.kind === "stronger_evidence").length ?? 0,
      statusChanges: current?.changes.filter((row) => row.kind === "status_changed").length ?? 0,
      securityWarnings: current?.leads.filter((lead) => lead.status === "potential_risk").length ?? 0,
      capturedAt,
    };
  }
  return {
    previousHuntId: previous.id,
    sourcesRechecked: current.progress.sourcesChecked,
    sourcesChanged: current.changes.filter((row) => row.kind === "source_changed").length,
    newLeads: current.leads.filter((lead) => !previous.leads.some((row) => row.fingerprint === lead.fingerprint)).length,
    strongerEvidence: current.changes.filter((row) => row.kind === "stronger_evidence").length,
    statusChanges: current.leads.filter((lead) => {
      const prior = previous.leads.find((row) => row.fingerprint === lead.fingerprint);
      return Boolean(prior && prior.status !== lead.status);
    }).length,
    securityWarnings: current.leads.filter((lead) => lead.status === "potential_risk").length,
    capturedAt,
  };
}

export function publicHunt(hunt: HuntRecord) {
  return {
    ...hunt,
    wallet: hunt.wallet ? `${hunt.wallet.slice(0, 6)}…${hunt.wallet.slice(-4)}` : undefined,
  };
}

export function huntAdminStats() {
  const rows = listAllHunts();
  const byStatus = (status: HuntStatus) => rows.filter((row) => row.status === status).length;
  return {
    active: byStatus("running") + byStatus("queued"),
    queued: byStatus("queued"),
    paused: byStatus("paused"),
    failed: byStatus("failed"),
    completed: byStatus("completed"),
    stopped: byStatus("stopped"),
    sourcesChecked: rows.reduce((sum, row) => sum + row.progress.sourcesChecked, 0),
    leadsCreated: rows.reduce((sum, row) => sum + row.progress.leadsCreated, 0),
    hunts: rows.slice(0, 80),
  };
}

export { loadHuntForUser, listAllHunts, listUserHunts };
