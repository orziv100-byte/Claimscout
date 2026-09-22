import { AuthError } from "../auth.ts";
import { recordSecurity } from "../beta-store.ts";
import { getSourcePause, loadRepairState, mutateRepairState } from "./repair-store.ts";
import { REPAIR_DIAGNOSES, type RepairAction, type RepairCase, type RepairDiagnosis, type RepairResearch } from "./repair-types.ts";
import { ENGINE_SOURCES, getEngineSource } from "./sources.ts";
import { listSourceRecords } from "./source-manager.ts";
import type { EngineFinding, EngineSource, SourceHealth } from "./types.ts";

export function diagnoseRepair(error: string): RepairDiagnosis {
  const text = error || "";
  if (/timed out/i.test(text)) return "timeout";
  if (/self-destruct/i.test(text)) return "self_destruct";
  if (/no contract code/i.test(text)) return "no_bytecode";
  if (/unverifiable|unsupported/i.test(text)) return "unverifiable";
  if (/execution reverted|revert/i.test(text)) return "revert";
  if (/rpc|econn|enotfound|fetch failed|http\/?\s*[45]|network/i.test(text)) return "rpc";
  return "unknown";
}

export function suggestRepairAction(diagnosis: RepairDiagnosis): RepairAction {
  if (diagnosis === "no_bytecode" || diagnosis === "self_destruct" || diagnosis === "unverifiable") {
    return "skip_until_restored";
  }
  return "keep_reporting";
}

export function researchRepair(source: EngineSource, diagnosis: RepairDiagnosis): RepairResearch {
  const notes =
    diagnosis === "no_bytecode" || diagnosis === "self_destruct" || diagnosis === "unverifiable"
      ? "Live RPC cannot currently verify this source. Do not invent eligibility. After human approve, PoolIndex may skip the live call and still list the source as skipped with this diagnosis. Restore re-enables the live check."
      : diagnosis === "timeout" || diagnosis === "rpc"
        ? "Keep reporting the real RPC/timeout error. Do not skip this source without a later human decision. One timeout already continues to the next source."
        : "Keep reporting the adapter result. An adapter code change still requires a separate deploy; this queue does not rewrite adapters.";
  return {
    protocol: source.protocol,
    chainLabel: source.chainLabel,
    scanMethod: source.scanMethod,
    officialUrl: source.officialUrl,
    tokenAddress: source.tokenAddress,
    notes,
  };
}

export function pausedFinding(source: EngineSource, reason: string): EngineFinding {
  return {
    id: `${source.id}:repair-paused`,
    sourceId: source.id,
    catalogId: source.catalogId,
    category: source.category,
    chainId: source.chainId,
    chainLabel: source.chainLabel,
    verification: "uncertain",
    title: source.id,
    detail: `Repair sandbox: live check skipped until human Restore. ${reason} No eligibility was invented.`,
    officialUrl: source.officialUrl,
    sourceStatus: "skipped",
  };
}

export function detectBrokenSource(input: {
  source: EngineSource;
  health: SourceHealth;
  now?: string;
}): RepairCase | null {
  if (input.health.status !== "failed") return null;
  const now = input.now ?? new Date().toISOString();
  const lastError = (input.health.lastError || "failed").slice(0, 300);
  const diagnosis = diagnoseRepair(lastError);
  const suggestedAction = suggestRepairAction(diagnosis);
  const research = researchRepair(input.source, diagnosis);

  return mutateRepairState((state) => {
    const existing = state.cases[input.source.id];
    if (existing?.status === "approved") {
      existing.lastError = lastError;
      existing.diagnosis = diagnosis;
      existing.consecutiveFailures = input.health.consecutiveFailures;
      existing.updatedAt = now;
      return existing;
    }
    if (existing?.status === "rejected") return existing;
    if (existing?.status === "proposed") {
      existing.lastError = lastError;
      existing.diagnosis = diagnosis;
      existing.suggestedAction = suggestedAction;
      existing.consecutiveFailures = input.health.consecutiveFailures;
      existing.research = research;
      existing.updatedAt = now;
      return existing;
    }
    const row: RepairCase = {
      id: input.source.id,
      sourceId: input.source.id,
      status: "proposed",
      diagnosis,
      suggestedAction,
      lastError,
      consecutiveFailures: input.health.consecutiveFailures,
      research,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    state.cases[input.source.id] = row;
    return row;
  });
}

export function syncRepairCasesFromHealth(now = new Date().toISOString()): RepairCase[] {
  for (const row of listSourceRecords()) {
    const source = getEngineSource(row.id) ?? ENGINE_SOURCES.find((item) => item.id === row.id);
    if (!source || row.status !== "failed") continue;
    detectBrokenSource({ source, health: row, now });
  }
  return listRepairCases();
}

export function listRepairCases(): RepairCase[] {
  return Object.values(loadRepairState().cases).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function approveRepair(caseId: string, actorId: string, now = new Date().toISOString()): RepairCase {
  return mutateRepairState((state) => {
    const row = state.cases[caseId];
    if (!row) throw new AuthError(404, "REPAIR_NOT_FOUND", "Broken-source case not found.");
    if (row.status === "rejected") throw new AuthError(409, "REPAIR_REJECTED", "Rejected cases cannot be approved.");
    if (row.status === "restored") throw new AuthError(409, "REPAIR_RESTORED", "Restored cases cannot be approved again.");
    row.status = "approved";
    row.approvedAt = now;
    row.approvedBy = actorId;
    row.updatedAt = now;
    row.appliedAction = row.suggestedAction;
    if (row.suggestedAction === "skip_until_restored") {
      state.pauses[row.sourceId] = {
        sourceId: row.sourceId,
        caseId: row.id,
        pausedAt: now,
        reason: `${row.diagnosis}: ${row.lastError}`.slice(0, 300),
        approvedBy: actorId,
      };
    }
    recordSecurity({ type: "repair_approved", userId: actorId, detail: row.sourceId });
    return { ...row };
  });
}

export function rejectRepair(caseId: string, actorId: string, now = new Date().toISOString()): RepairCase {
  return mutateRepairState((state) => {
    const row = state.cases[caseId];
    if (!row) throw new AuthError(404, "REPAIR_NOT_FOUND", "Broken-source case not found.");
    if (row.status !== "proposed") {
      throw new AuthError(409, "REPAIR_NOT_PROPOSED", "Only a proposed sandbox case can be rejected.");
    }
    row.status = "rejected";
    row.rejectedAt = now;
    row.rejectedBy = actorId;
    row.updatedAt = now;
    recordSecurity({ type: "repair_rejected", userId: actorId, detail: row.sourceId });
    return { ...row };
  });
}

export function proposeRepairFromAgent(input: {
  sourceId: string;
  notes: string;
  diagnosis?: RepairDiagnosis;
  actorId: string;
  now?: string;
}): RepairCase {
  const source = getEngineSource(input.sourceId);
  if (!source) throw new AuthError(404, "SOURCE_NOT_FOUND", "Unknown engine source.");
  const health = listSourceRecords().find((row) => row.id === input.sourceId);
  const lastError = (health?.lastError || input.notes || "agent proposal").slice(0, 300);
  const diagnosis: RepairDiagnosis =
    input.diagnosis && (REPAIR_DIAGNOSES as readonly string[]).includes(input.diagnosis)
      ? input.diagnosis
      : diagnoseRepair(lastError);
  const suggestedAction = suggestRepairAction(diagnosis);
  const now = input.now ?? new Date().toISOString();
  const notes = input.notes.trim().slice(0, 800) || researchRepair(source, diagnosis).notes;
  return mutateRepairState((state) => {
    const existing = state.cases[input.sourceId];
    if (existing?.status === "approved") {
      throw new AuthError(409, "REPAIR_APPROVED", "This source already waits for Restore. The agent cannot approve or restore.");
    }
    if (existing?.status === "rejected") {
      throw new AuthError(409, "REPAIR_REJECTED", "Rejected proposals stay out of production.");
    }
    const research = { ...researchRepair(source, diagnosis), notes: `Agent proposal: ${notes}` };
    const row: RepairCase = {
      id: input.sourceId,
      sourceId: input.sourceId,
      status: "proposed",
      diagnosis,
      suggestedAction,
      lastError,
      consecutiveFailures: health?.consecutiveFailures ?? existing?.consecutiveFailures ?? 0,
      research,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    state.cases[input.sourceId] = row;
    recordSecurity({ type: "repair_proposed_by_agent", userId: input.actorId, detail: input.sourceId });
    return { ...row };
  });
}

export function restoreRepair(caseId: string, actorId: string, now = new Date().toISOString()): RepairCase {
  return mutateRepairState((state) => {
    const row = state.cases[caseId];
    if (!row) throw new AuthError(404, "REPAIR_NOT_FOUND", "Broken-source case not found.");
    if (row.status !== "approved") {
      throw new AuthError(409, "REPAIR_NOT_APPROVED", "Without Approve there is no Restore.");
    }
    row.status = "restored";
    row.restoredAt = now;
    row.restoredBy = actorId;
    row.updatedAt = now;
    delete state.pauses[row.sourceId];
    recordSecurity({ type: "repair_restored", userId: actorId, detail: row.sourceId });
    return { ...row };
  });
}

export { getSourcePause };
