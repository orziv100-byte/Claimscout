import { ENGINE_SOURCES } from "./sources.ts";
import { listSourceHealth } from "./source-store.ts";
import { getSourcePause } from "./repair-store.ts";
import type { EngineSource, SourceHealth } from "./types.ts";

export type SourceRecord = EngineSource &
  SourceHealth & {
    important: boolean;
  };

export function isImportantSource(source: Pick<EngineSource, "category">): boolean {
  return source.category === "airdrop" || source.category === "native_balance" || source.category === "protocol_claim";
}

export function sourceFailedAfterHealthy(previous: SourceHealth | undefined, next: SourceHealth): boolean {
  if (next.status !== "failed") return false;
  if (!previous || previous.status !== "ok") return false;
  return true;
}

export function listSourceRecords(health = listSourceHealth(ENGINE_SOURCES.map((source) => source.id))): SourceRecord[] {
  const byId = new Map(health.map((row) => [row.id, row]));
  return ENGINE_SOURCES.map((source) => {
    const row = byId.get(source.id) ?? { id: source.id, status: "unknown" as const, consecutiveFailures: 0 };
    return {
      ...source,
      ...row,
      id: source.id,
      important: isImportantSource(source),
    };
  });
}

export function publicSourceRecords(health?: SourceHealth[]) {
  return listSourceRecords(health).map((row) => ({
    id: row.id,
    protocol: row.protocol,
    chainLabel: row.chainLabel,
    category: row.category,
    scanMethod: row.scanMethod,
    adapterVersion: row.adapterVersion,
    frequency: row.frequency,
    rateLimit: row.rateLimit,
    important: row.important,
    paused: Boolean(getSourcePause(row.id)),
    status: row.status,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    lastError: row.lastError,
    consecutiveFailures: row.consecutiveFailures,
  }));
}
