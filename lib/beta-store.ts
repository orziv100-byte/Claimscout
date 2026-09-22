import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION } from "./app-info.ts";
import type { BetaState, MailMessage, OpsState, ScanRecord, SecurityEvent, TelemetryEvent } from "./beta-types.ts";
import { dualWriteSqlite } from "./db/sqlite.ts";

const DEFAULT_OPS: OpsState = {
  scansEnabled: true,
  maintenanceMode: false,
  betaStage: 1,
  reason: "",
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

const EMPTY: BetaState = {
  users: [],
  invites: [],
  sessions: [],
  tokens: [],
  ops: { ...DEFAULT_OPS },
  feedback: [],
  deletionRequests: [],
  privacyRequests: [],
};

let chain: Promise<unknown> = Promise.resolve();

export function betaRoot(): string {
  return process.env.POOLINDEX_BETA_DIR || join(process.cwd(), "var/beta");
}

function statePath(root = betaRoot()) {
  return join(root, "state.json");
}

function ensureDir(root = betaRoot()) {
  mkdirSync(join(root, "scans"), { recursive: true });
}

export function withBetaLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readBetaState(root = betaRoot()): BetaState {
  ensureDir(root);
  try {
    const parsed = JSON.parse(readFileSync(statePath(root), "utf8")) as BetaState;
    return {
      users: Array.isArray(parsed.users)
        ? parsed.users.map((user) => ({
            ...user,
            deletionRequestedAt: user.deletionRequestedAt ?? null,
            deletionStatus: user.deletionStatus ?? "none",
          }))
        : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      deletionRequests: Array.isArray(parsed.deletionRequests) ? parsed.deletionRequests : [],
      privacyRequests: Array.isArray(parsed.privacyRequests) ? parsed.privacyRequests : [],
      ops: { ...DEFAULT_OPS, ...(parsed.ops ?? {}) },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function writeBetaState(state: BetaState, root = betaRoot()): void {
  ensureDir(root);
  const dest = statePath(root);
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, dest);
  try {
    dualWriteSqlite(state, root);
  } catch {
    appendJsonl("errors.jsonl", { at: new Date().toISOString(), version: APP_VERSION, type: "sqlite_dualwrite_failed" }, root);
  }
}

export function mutateBetaState<T>(fn: (state: BetaState) => T, root = betaRoot()): T {
  const state = readBetaState(root);
  const result = fn(state);
  writeBetaState(state, root);
  return result;
}

export function appendJsonl(file: string, row: unknown, root = betaRoot()): void {
  ensureDir(root);
  const dest = join(root, file);
  writeFileSync(dest, `${JSON.stringify(row)}\n`, { flag: "a" });
}

export function readJsonl<T>(file: string, limit = 500, root = betaRoot()): T[] {
  try {
    const lines = readFileSync(join(root, file), "utf8").trim().split("\n").filter(Boolean);
    const slice = lines.slice(-limit);
    const rows: T[] = [];
    for (const line of slice) {
      try {
        rows.push(JSON.parse(line) as T);
      } catch {
        /* skip damaged line */
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export function recordTelemetry(event: Omit<TelemetryEvent, "at" | "version"> & { version?: string }, root = betaRoot()) {
  appendJsonl(
    "telemetry.jsonl",
    {
      at: new Date().toISOString(),
      version: event.version ?? APP_VERSION,
      ...event,
    } satisfies TelemetryEvent,
    root,
  );
}

export function recordSecurity(event: Omit<SecurityEvent, "at">, root = betaRoot()) {
  appendJsonl("security.jsonl", { at: new Date().toISOString(), ...event } satisfies SecurityEvent, root);
}

export function recordError(event: { type: string; detail: string; userId?: string; code?: string }, root = betaRoot()) {
  appendJsonl(
    "errors.jsonl",
    { at: new Date().toISOString(), version: APP_VERSION, ...event },
    root,
  );
}

export function recordMail(message: Omit<MailMessage, "at">, root = betaRoot()) {
  appendJsonl("outbox.jsonl", { at: new Date().toISOString(), ...message } satisfies MailMessage, root);
}

export function recordUserScan(row: ScanRecord, root = betaRoot()) {
  ensureDir(root);
  const dest = join(root, "scans", `${row.userId}.jsonl`);
  writeFileSync(dest, `${JSON.stringify(row)}\n`, { flag: "a" });
}

export function readUserScans(userId: string, limit = 50, root = betaRoot()): ScanRecord[] {
  return readJsonl<ScanRecord>(join("scans", `${userId}.jsonl`), limit, root);
}

export function readTelemetry(limit = 300, root = betaRoot()): TelemetryEvent[] {
  return readJsonl<TelemetryEvent>("telemetry.jsonl", limit, root);
}

export function readSecurity(limit = 300, root = betaRoot()): SecurityEvent[] {
  return readJsonl<SecurityEvent>("security.jsonl", limit, root);
}

export function readErrors(limit = 200, root = betaRoot()): Record<string, unknown>[] {
  return readJsonl("errors.jsonl", limit, root);
}

export function readOutbox(limit = 50, root = betaRoot()): MailMessage[] {
  return readJsonl<MailMessage>("outbox.jsonl", limit, root);
}
