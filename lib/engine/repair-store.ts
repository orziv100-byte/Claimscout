import { readFileSync } from "node:fs";
import { join } from "node:path";
import { engineDataRoot, writeEngineAtomic } from "./paths.ts";
import type { RepairCase, SourcePause } from "./repair-types.ts";

export type RepairState = {
  cases: Record<string, RepairCase>;
  pauses: Record<string, SourcePause>;
};

const EMPTY: RepairState = { cases: {}, pauses: {} };

function storePath(): string {
  return join(engineDataRoot(), "repairs.json");
}

export function loadRepairState(): RepairState {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), "utf8")) as RepairState;
    return {
      cases: parsed.cases && typeof parsed.cases === "object" ? parsed.cases : {},
      pauses: parsed.pauses && typeof parsed.pauses === "object" ? parsed.pauses : {},
    };
  } catch {
    return { cases: {}, pauses: {} };
  }
}

export function saveRepairState(state: RepairState): void {
  writeEngineAtomic(storePath(), `${JSON.stringify(state, null, 2)}\n`);
}

export function mutateRepairState<T>(fn: (state: RepairState) => T): T {
  const state = loadRepairState();
  const result = fn(state);
  saveRepairState(state);
  return result;
}

export function getSourcePause(sourceId: string): SourcePause | null {
  return loadRepairState().pauses[sourceId] ?? null;
}

export function resetRepairStateForTests(): void {
  saveRepairState({ ...EMPTY, cases: {}, pauses: {} });
}
