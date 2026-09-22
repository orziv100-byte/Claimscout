import { readFileSync } from "node:fs";
import { join } from "node:path";
import { betaRoot } from "../beta-store.ts";
import { newId } from "../password.ts";
import { belowAlertNet } from "./monitor.ts";
import { writeEngineAtomic } from "./paths.ts";
import type { EngineScan } from "./types.ts";

export const MCP_EVENT_TYPES = [
  "finding_added",
  "finding_changed",
  "deadline_approaching",
  "adapter_failed",
  "scan_completed",
] as const;
export type McpEventType = (typeof MCP_EVENT_TYPES)[number];

export type McpEvent = {
  event_id: string;
  type: McpEventType;
  wallet: string;
  created_at: string;
  finding_id?: string;
};

const KEEP = 200;

function eventsPath(userId: string): string {
  return join(betaRoot(), "mcp-events", `${userId}.jsonl`);
}

function appendEvents(userId: string, rows: McpEvent[]): void {
  if (!rows.length) return;
  const dest = eventsPath(userId);
  let lines: string[] = [];
  try {
    lines = readFileSync(dest, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    /* first */
  }
  for (const row of rows) lines.push(JSON.stringify(row));
  if (lines.length > KEEP) lines = lines.slice(-KEEP);
  writeEngineAtomic(dest, `${lines.join("\n")}\n`);
}

export function listMcpEvents(userId: string, since?: string, limit = 50): McpEvent[] {
  let lines: string[] = [];
  try {
    lines = readFileSync(eventsPath(userId), "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
  const sinceAt = since ? Date.parse(since) : NaN;
  const rows: McpEvent[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as McpEvent;
      if (!parsed?.event_id || !parsed.created_at) continue;
      if (Number.isFinite(sinceAt) && Date.parse(parsed.created_at) <= sinceAt) continue;
      rows.push(parsed);
    } catch {
      /* skip */
    }
  }
  return rows.slice(-limit).reverse();
}

export function recordScanMcpEvents(userId: string, scan: EngineScan): void {
  const created_at = new Date().toISOString();
  const byId = new Map(scan.findings.map((row) => [row.id, row]));
  const rows: McpEvent[] = [
    {
      event_id: newId(10),
      type: "scan_completed",
      wallet: scan.address,
      created_at,
    },
  ];
  for (const failure of scan.summary.failures) {
    rows.push({
      event_id: newId(10),
      type: "adapter_failed",
      wallet: scan.address,
      created_at,
      finding_id: failure.sourceId,
    });
  }
  for (const change of scan.changes) {
    if (change.kind === "new_finding") {
      rows.push({
        event_id: newId(10),
        type: "finding_added",
        wallet: scan.address,
        created_at,
        finding_id: change.findingId,
      });
    } else if (change.kind === "status_changed" || change.kind === "amount_changed") {
      const finding = byId.get(change.findingId);
      if (finding && change.kind === "amount_changed" && belowAlertNet(finding)) continue;
      rows.push({
        event_id: newId(10),
        type: "finding_changed",
        wallet: scan.address,
        created_at,
        finding_id: change.findingId,
      });
    }
  }
  for (const finding of scan.findings) {
    if (finding.deadlineStatus === "closing") {
      rows.push({
        event_id: newId(10),
        type: "deadline_approaching",
        wallet: scan.address,
        created_at,
        finding_id: finding.id,
      });
    }
  }
  appendEvents(userId, rows);
}
