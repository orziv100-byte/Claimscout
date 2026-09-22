import { readFileSync } from "node:fs";
import { join } from "node:path";
import { betaRoot } from "../beta-store.ts";
import { writeEngineAtomic } from "./paths.ts";

export type McpCallLog = {
  at: string;
  tool: string;
  wallet?: string;
  tokenId?: string;
  ok: boolean;
  status?: number;
};

const KEEP = 200;

function logPath(userId: string): string {
  return join(betaRoot(), "mcp-calls", `${userId}.jsonl`);
}

export function recordMcpCall(userId: string, row: McpCallLog): void {
  const dest = logPath(userId);
  let lines: string[] = [];
  try {
    lines = readFileSync(dest, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    /* first */
  }
  lines.push(JSON.stringify(row));
  if (lines.length > KEEP) lines = lines.slice(-KEEP);
  writeEngineAtomic(dest, `${lines.join("\n")}\n`);
}

export function listMcpCalls(userId: string, limit = 50): McpCallLog[] {
  let lines: string[] = [];
  try {
    lines = readFileSync(logPath(userId), "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
  const rows: McpCallLog[] = [];
  for (const line of lines.slice(-limit).reverse()) {
    try {
      const parsed = JSON.parse(line) as McpCallLog;
      if (parsed?.at && parsed.tool) rows.push(parsed);
    } catch {
      /* skip */
    }
  }
  return rows;
}
