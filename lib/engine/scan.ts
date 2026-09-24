import type { Address } from "viem";
import { withTimeout } from "../http.ts";
import type { EligibilityResult } from "../types.ts";
import { runSource } from "./adapters.ts";
import { enrichFindings } from "./enrich.ts";
import { buildScanProgress, SOURCE_TIMEOUT_MS } from "./progress.ts";
import { ENGINE_SOURCES, selectEngineSources } from "./sources.ts";
import { listSourceHealth, recordSourceHealth } from "./source-store.ts";
import { publicSourceRecords } from "./source-manager.ts";
import { detectBrokenSource, getSourcePause, pausedFinding } from "./repair.ts";
import { diffScans, loadPreviousScan, loadScanHistory, saveScan } from "./state.ts";
import { nextWalletMonitorAt } from "./schedule.ts";
import {
  buildWalletProfile,
  interestingVerificationCounts,
  isInterestingFinding,
  isWalletSpecificAirdrop,
  normalizeStoredFinding,
} from "./profile.ts";
import { transactionCount } from "./rpc.ts";
import type {
  EngineCounters,
  EngineFinding,
  EngineScan,
  EngineScanSummary,
  EngineSource,
  ScanProgress,
} from "./types.ts";

export function scanSummary(findings: EngineFinding[]): EngineScanSummary {
  const failures = findings
    .filter((row) => row.sourceStatus === "failed")
    .map((row) => ({ sourceId: row.sourceId, reason: row.detail }));
  const counts = interestingVerificationCounts(findings);
  return {
    adaptersChecked: findings.filter((row) => row.sourceStatus !== "skipped").length,
    adaptersSucceeded: findings.filter((row) => row.sourceStatus === "ok").length,
    adaptersFailed: failures.length,
    failures,
    verified: counts.verified,
    uncertain: counts.uncertain,
    rejected: counts.rejected,
  };
}

function counters(findings: EngineFinding[], relevant: string[]): EngineCounters {
  const interesting = findings.filter(isInterestingFinding);
  return {
    sourcesChecked: findings.filter((row) => row.sourceStatus !== "skipped").length,
    sourcesFailed: findings.filter((row) => row.sourceStatus === "failed").length,
    chainsChecked: new Set(findings.map((row) => row.chainId)).size,
    relevantSources: relevant.length,
    potentialFindings: interesting.length,
    verifiedFindings: interesting.filter((row) => row.verification === "verified").length,
  };
}

function timedOutFinding(source: EngineSource, timeoutMs: number): EngineFinding {
  return {
    id: `${source.id}:timeout`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: source.category,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "uncertain",
    title: source.id,
    detail: `Source timed out after ${Math.round(timeoutMs / 1000)}s. Continuing with other sources. No verdict was invented.`,
    officialUrl: source.officialUrl,
    sourceStatus: "failed",
  };
}

async function runSourceTimed(
  source: EngineSource,
  address: Address,
  timeoutMs: number,
): Promise<{ finding: EngineFinding; timedOut: boolean }> {
  try {
    const finding = await withTimeout(runSource(source, address), timeoutMs, source.id);
    return { finding, timedOut: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    if (/timed out/i.test(message)) return { finding: timedOutFinding(source, timeoutMs), timedOut: true };
    return {
      finding: {
        id: `${source.id}:error`,
        sourceId: source.id,
        catalogId: source.catalogId,
        category: source.category,
        chainId: source.chainId,
        chainLabel: source.chainLabel,
        verification: "uncertain",
        title: source.id,
        detail: `Adapter RPC/contract error: ${message}`,
        officialUrl: source.officialUrl,
        sourceStatus: "failed",
      },
      timedOut: false,
    };
  }
}

async function inspectSource(
  source: EngineSource,
  address: Address,
  timeoutMs: number,
): Promise<{ finding: EngineFinding; timedOut: boolean }> {
  const pause = getSourcePause(source.id);
  if (pause) {
    return { finding: pausedFinding(source, pause.reason), timedOut: false };
  }
  const result = await runSourceTimed(source, address, timeoutMs);
  const health = recordSourceHealth(
    source.id,
    result.finding.sourceStatus === "ok",
    result.finding.sourceStatus === "failed" ? result.finding.detail : undefined,
  );
  if (health.status === "failed") detectBrokenSource({ source, health });
  return result;
}

export type ScanWalletEngineOptions = {
  onProgress?: (progress: ScanProgress) => void;
  sourceTimeoutMs?: number;
  /** Desktop writes to the user's machine. Server wallet checks must not persist. */
  persist?: boolean;
};

export async function scanWalletEngine(
  address: Address,
  opts: ScanWalletEngineOptions = {},
): Promise<EngineScan> {
  const startedAt = Date.now();
  const timeoutMs = opts.sourceTimeoutMs ?? SOURCE_TIMEOUT_MS;
  const findings: EngineFinding[] = [];
  const natives = ENGINE_SOURCES.filter((source) => source.category === "native_balance");
  let selected: EngineSource[] = natives;
  let timedOut = 0;
  let currentSource: string | undefined;

  const emit = (stage: ScanProgress["stage"]) => {
    opts.onProgress?.(
      buildScanProgress({
        address,
        startedAt,
        stage,
        natives,
        selected,
        findings,
        timedOut,
        currentSource,
      }),
    );
  };

  emit("profile");
  const txCounts = new Map<number, number>();
  for (const source of natives) {
    currentSource = `${source.id}:nonce`;
    emit("profile");
    try {
      const count = await withTimeout(transactionCount(source.chainId, address), timeoutMs, `${source.id}:nonce`);
      txCounts.set(source.chainId, count);
    } catch {
      // Profile nonce is optional. A failed nonce does not invent activity and does not fail the scan.
    }
  }
  currentSource = undefined;

  emit("chains");
  for (const source of natives) {
    currentSource = source.id;
    emit("chains");
    const result = await inspectSource(source, address, timeoutMs);
    if (result.timedOut) timedOut += 1;
    findings.push(result.finding);
  }
  currentSource = undefined;

  const activeChainIds = findings
    .filter((row) => row.category === "native_balance" && Number(row.amount) > 0)
    .map((row) => row.chainId);
  selected = selectEngineSources(activeChainIds);
  emit("protocols");
  emit("relevant_sources");

  const remaining = selected.filter((source) => source.category !== "native_balance");
  emit("verification");
  for (const source of remaining) {
    currentSource = source.id;
    emit("verification");
    const result = await inspectSource(source, address, timeoutMs);
    if (result.timedOut) timedOut += 1;
    findings.push(result.finding);
  }
  currentSource = undefined;

  const enriched = await enrichFindings(ENGINE_SOURCES, findings);
  const profile = buildWalletProfile(address, enriched, selected, txCounts);
  const previous = loadPreviousScan(address);
  const scan: EngineScan = {
    address,
    scannedAt: new Date().toISOString(),
    profile,
    findings: enriched,
    counters: counters(enriched, profile.relevantSourceIds),
    summary: scanSummary(enriched),
    changes: [],
    previousScannedAt: previous?.scannedAt,
    sourceHealth: listSourceHealth(ENGINE_SOURCES.map((source) => source.id)),
    durationMs: Date.now() - startedAt,
  };
  scan.changes = diffScans(previous, scan);
  if (opts.persist !== false) saveScan(scan);
  emit("verification");
  return scan;
}

export function eligibilityOverlay(scan: EngineScan): EligibilityResult[] {
  const rows: EligibilityResult[] = [];
  for (const finding of scan.findings) {
    if (!finding.catalogId || !finding.eligibility) continue;
    if (finding.category === "airdrop" && !isWalletSpecificAirdrop(finding)) continue;
    rows.push({
      claimId: finding.catalogId,
      address: scan.address,
      status: finding.eligibility,
      detail: finding.detail,
      officialCheckerUrl: finding.officialUrl,
      checkKind: "wallet_level",
    });
  }
  return rows;
}

export function publicEngineScan(scan: EngineScan) {
  const findings = scan.findings.map(normalizeStoredFinding);
  const summary = scanSummary(findings);
  const interesting = findings.filter(isInterestingFinding);
  const counts = interestingVerificationCounts(findings);
  const counters = {
    ...scan.counters,
    sourcesFailed: findings.filter((row) => row.sourceStatus === "failed").length,
    potentialFindings: interesting.length,
    verifiedFindings: counts.verified,
  };
  return {
    scannedAt: scan.scannedAt,
    previousScannedAt: scan.previousScannedAt,
    nextScanAt: nextWalletMonitorAt(),
    durationMs: scan.durationMs,
    counters,
    summary,
    profile: {
      chains: scan.profile.chains,
      tokens: scan.profile.tokens,
      protocols: scan.profile.protocols,
      contracts: scan.profile.contracts,
      relevantSourceIds: scan.profile.relevantSourceIds,
    },
    findings: interesting,
    changes: scan.changes,
    sources: publicSourceRecords(scan.sourceHealth),
    history: loadScanHistory(scan.address).map((row) =>
      row.scannedAt === scan.scannedAt
        ? {
            ...row,
            sourcesFailed: counters.sourcesFailed,
            potentialFindings: counters.potentialFindings,
            verifiedFindings: counters.verifiedFindings,
          }
        : row,
    ),
  };
}
