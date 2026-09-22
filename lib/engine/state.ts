import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Address } from "viem";
import { engineDataRoot, writeEngineAtomic } from "./paths.ts";
import { ENGINE_SOURCES } from "./sources.ts";
import { isImportantSource, sourceFailedAfterHealthy } from "./source-manager.ts";
import type { EngineChange, EngineScan, ScanHistoryEntry } from "./types.ts";

const HISTORY_KEEP = 30;

function walletsDir(): string {
  return join(engineDataRoot(), "wallets");
}

function walletPath(address: Address): string {
  return join(walletsDir(), `${address.toLowerCase()}.json`);
}

function historyPath(address: Address): string {
  return join(walletsDir(), `${address.toLowerCase()}.history.jsonl`);
}

export function loadPreviousScan(address: Address): EngineScan | null {
  try {
    return JSON.parse(readFileSync(walletPath(address), "utf8")) as EngineScan;
  } catch {
    return null;
  }
}

export function saveScan(scan: EngineScan): void {
  writeEngineAtomic(walletPath(scan.address), `${JSON.stringify(scan)}\n`);
  appendScanHistory(scan);
}

export function appendScanHistory(scan: EngineScan): void {
  const dest = historyPath(scan.address);
  const row: ScanHistoryEntry = {
    scannedAt: scan.scannedAt,
    sourcesChecked: scan.counters.sourcesChecked,
    sourcesFailed: scan.counters.sourcesFailed,
    potentialFindings: scan.counters.potentialFindings,
    verifiedFindings: scan.counters.verifiedFindings,
  };
  let lines: string[] = [];
  try {
    lines = readFileSync(dest, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    /* first history row */
  }
  lines.push(JSON.stringify(row));
  if (lines.length > HISTORY_KEEP) lines = lines.slice(-HISTORY_KEEP);
  writeEngineAtomic(dest, `${lines.join("\n")}\n`);
}

export function loadScanHistory(address: Address, limit = 10): ScanHistoryEntry[] {
  try {
    const lines = readFileSync(historyPath(address), "utf8").trim().split("\n").filter(Boolean);
    const rows: ScanHistoryEntry[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        const parsed = JSON.parse(line) as ScanHistoryEntry;
        if (parsed && typeof parsed.scannedAt === "string") rows.push(parsed);
      } catch {
        /* skip damaged line */
      }
    }
    return rows.reverse();
  } catch {
    return [];
  }
}

export function diffScans(previous: EngineScan | null, next: EngineScan): EngineChange[] {
  if (!previous) {
    return [{ kind: "baseline", findingId: "*", summary: "First engine scan for this address." }];
  }
  const before = new Map(previous.findings.map((row) => [row.id, row]));
  const after = new Map(next.findings.map((row) => [row.id, row]));
  const changes: EngineChange[] = [];
  for (const [id, finding] of after) {
    const old = before.get(id);
    if (!old) {
      changes.push({ kind: "new_finding", findingId: id, summary: `New finding: ${finding.title}` });
      continue;
    }
    if (old.verification !== finding.verification || old.eligibility !== finding.eligibility) {
      changes.push({
        kind: "status_changed",
        findingId: id,
        summary: `${finding.title}: ${old.verification}/${old.eligibility ?? "n/a"} → ${finding.verification}/${finding.eligibility ?? "n/a"}`,
      });
    } else if (old.deadlineStatus !== finding.deadlineStatus && (finding.deadlineStatus === "closing" || finding.deadlineStatus === "expired")) {
      changes.push({
        kind: "status_changed",
        findingId: id,
        summary: `${finding.title}: ${finding.deadlineLabel ?? finding.deadlineStatus}`,
      });
    } else if ((old.amount ?? "") !== (finding.amount ?? "")) {
      changes.push({
        kind: "amount_changed",
        findingId: id,
        summary: `${finding.title}: amount ${old.amount ?? "0"} → ${finding.amount ?? "0"}`,
      });
    }
  }
  for (const [id, finding] of before) {
    if (!after.has(id)) {
      changes.push({ kind: "removed_finding", findingId: id, summary: `Removed: ${finding.title}` });
    }
  }
  for (const nextHealth of next.sourceHealth ?? []) {
    const source = ENGINE_SOURCES.find((row) => row.id === nextHealth.id);
    if (!source || !isImportantSource(source)) continue;
    const prevHealth = previous.sourceHealth?.find((row) => row.id === nextHealth.id);
    if (sourceFailedAfterHealthy(prevHealth, nextHealth)) {
      changes.push({
        kind: "source_failed",
        findingId: nextHealth.id,
        summary: nextHealth.lastError
          ? `Source ${nextHealth.id} failed after a healthy run: ${nextHealth.lastError}`
          : `Source ${nextHealth.id} failed after a healthy run.`,
      });
    }
  }
  return changes;
}
