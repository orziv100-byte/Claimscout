import { ENGINE_SOURCES } from "./sources.ts";
import { isInterestingFinding } from "./profile.ts";
import type { EngineFinding, EngineSource, ScanProgress, ScanStageId } from "./types.ts";

export const SCAN_STAGES: ScanStageId[] = [
  "profile",
  "chains",
  "protocols",
  "relevant_sources",
  "verification",
];

export const SCAN_STAGE_LABELS: Record<ScanStageId, string> = {
  profile: "Profile",
  chains: "Chains",
  protocols: "Protocols",
  relevant_sources: "Relevant Sources",
  verification: "Verification",
};

export const SOURCE_TIMEOUT_MS = 30_000;

/** Human label for the source currently in flight. Built from real adapter metadata only. */
export function sourceCheckingLabel(currentSource?: string): string | undefined {
  if (!currentSource) return undefined;
  if (currentSource === "catalog overlay") return "Checking catalog overlay…";
  const id = currentSource.replace(/:nonce$/, "");
  const source = ENGINE_SOURCES.find((row) => row.id === id);
  if (!source) return `Checking ${id}…`;
  if (currentSource.endsWith(":nonce")) return `Checking ${source.chainLabel} activity…`;
  if (source.category === "native_balance") return `Checking ${source.chainLabel}…`;
  return `Checking ${source.protocol} on ${source.chainLabel}…`;
}

export type ScanProgressInput = {
  address: string;
  startedAt: number;
  stage: ScanStageId | "done";
  natives: readonly EngineSource[];
  selected: readonly EngineSource[];
  findings: readonly EngineFinding[];
  timedOut: number;
  currentSource?: string;
};

function stageState(
  current: ScanStageId | "done",
  id: ScanStageId,
): "pending" | "active" | "done" {
  if (current === "done") return "done";
  const currentIndex = SCAN_STAGES.indexOf(current);
  const idIndex = SCAN_STAGES.indexOf(id);
  if (idIndex < currentIndex) return "done";
  if (idIndex === currentIndex) return "active";
  return "pending";
}

export function buildScanProgress(input: ScanProgressInput): ScanProgress {
  const chainFindings = input.findings.filter((row) => row.category === "native_balance");
  const chainLabels = chainFindings
    .filter((row) => row.sourceStatus === "ok" && Number(row.amount) > 0)
    .map((row) => row.chainLabel);
  const protocols = [...new Set(input.selected.map((source) => source.protocol))];
  const checked = input.findings.filter((row) => row.sourceStatus !== "skipped").length;
  const failed = input.findings.filter((row) => row.sourceStatus === "failed").length;
  const interesting = input.findings.filter(isInterestingFinding);
  const sourcesTotal = input.selected.length || input.natives.length;
  const checkingLabel = sourceCheckingLabel(input.currentSource);
  return {
    stage: input.stage,
    stages: SCAN_STAGES.map((id) => {
      const status = stageState(input.stage, id);
      if (id === "profile") {
        return {
          id,
          label: SCAN_STAGE_LABELS[id],
          status,
          count: 1,
          total: 1,
          detail: status === "active" && checkingLabel ? checkingLabel : input.address,
        };
      }
      if (id === "chains") {
        return {
          id,
          label: SCAN_STAGE_LABELS[id],
          status,
          count: chainFindings.length,
          total: input.natives.length,
          detail: status === "active" && checkingLabel ? checkingLabel : chainLabels.join(", ") || undefined,
        };
      }
      if (id === "protocols") {
        return {
          id,
          label: SCAN_STAGE_LABELS[id],
          status,
          count: protocols.length,
          total: protocols.length,
          detail: protocols.join(", ") || undefined,
        };
      }
      if (id === "relevant_sources") {
        return {
          id,
          label: SCAN_STAGE_LABELS[id],
          status,
          count: input.selected.length,
          total: ENGINE_SOURCES.length,
          detail: `${input.selected.length} of ${ENGINE_SOURCES.length} adapters selected for this wallet`,
        };
      }
      return {
        id,
        label: SCAN_STAGE_LABELS[id],
        status,
        count: checked,
        total: sourcesTotal,
        detail: checkingLabel,
      };
    }),
    address: input.address,
    elapsedMs: Date.now() - input.startedAt,
    chainsChecked: chainFindings.length,
    chainsTotal: input.natives.length,
    chainLabels,
    protocolsChecked: protocols.length,
    protocolsTotal: protocols.length,
    protocolNames: protocols,
    sourcesChecked: checked,
    sourcesTotal,
    sourcesFailed: failed,
    sourcesTimedOut: input.timedOut,
    currentSource: input.currentSource,
    checkingLabel,
    verifiedFindings: interesting.filter((row) => row.verification === "verified").length,
    uncertainFindings: interesting.filter((row) => row.verification === "uncertain").length,
    potentialFindings: interesting.length,
    findings: interesting.map((row) => ({
      id: row.id,
      sourceId: row.sourceId,
      title: row.title,
      verification: row.verification,
      eligibility: row.eligibility,
      amount: row.amount,
      symbol: row.symbol,
      category: row.category,
      officialUrl: row.officialUrl,
      catalogId: row.catalogId,
      sourceStatus: row.sourceStatus,
      detail: row.detail,
      chainLabel: row.chainLabel,
    })),
  };
}
