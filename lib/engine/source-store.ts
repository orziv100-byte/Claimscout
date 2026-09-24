import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { engineDataRoot } from "./paths.ts";
import type { SourceHealth } from "./types.ts";

function storePath(): string {
  return join(engineDataRoot(), "source-health.json");
}

export function loadSourceHealth(): Record<string, SourceHealth> {
  try {
    const raw = JSON.parse(readFileSync(storePath(), "utf8")) as Record<string, SourceHealth>;
    if (raw && typeof raw === "object") return raw;
  } catch {
    /* miss */
  }
  return {};
}

export function recordSourceHealth(id: string, ok: boolean, error?: string, at = new Date().toISOString()): SourceHealth {
  const all = loadSourceHealth();
  const prev = all[id] ?? { id, status: "unknown", consecutiveFailures: 0 };
  const next: SourceHealth = ok
    ? {
        id,
        status: "ok",
        lastSuccessAt: at,
        lastFailureAt: prev.lastFailureAt,
        consecutiveFailures: 0,
      }
    : {
        id,
        status: "failed",
        lastSuccessAt: prev.lastSuccessAt,
        lastFailureAt: at,
        lastError: (error || "failed").slice(0, 300),
        consecutiveFailures: (prev.consecutiveFailures || 0) + 1,
      };
  all[id] = next;
  mkdirSync(engineDataRoot(), { recursive: true });
  const dest = storePath();
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(all)}\n`);
  renameSync(tmp, dest);
  return next;
}

export function listSourceHealth(ids: readonly string[]): SourceHealth[] {
  const all = loadSourceHealth();
  return ids.map((id) => all[id] ?? { id, status: "unknown", consecutiveFailures: 0 });
}
