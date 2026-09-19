import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AuthError } from "../auth.ts";
import { betaRoot, withBetaLock } from "../beta-store.ts";
import type { HuntRecord, HuntSummary } from "./types.ts";

const ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

export function huntsRoot(root = betaRoot()): string {
  return join(root, "hunts");
}

export function assertSafeHuntId(id: string): string {
  if (!ID_RE.test(id)) {
    throw new AuthError(400, "INVALID_HUNT_ID", "Hunt id is not valid.");
  }
  return id;
}

export function assertSafeUserId(userId: string): string {
  if (!ID_RE.test(userId)) {
    throw new AuthError(400, "INVALID_USER", "User id is not valid.");
  }
  return userId;
}

function userDir(userId: string, root = betaRoot()): string {
  return join(huntsRoot(root), assertSafeUserId(userId));
}

function huntPath(userId: string, huntId: string, root = betaRoot()): string {
  return join(userDir(userId, root), `${assertSafeHuntId(huntId)}.json`);
}

function ensureUserDir(userId: string, root = betaRoot()): void {
  mkdirSync(userDir(userId, root), { recursive: true });
}

export function withHuntLock<T>(fn: () => T | Promise<T>): Promise<T> {
  return withBetaLock(fn);
}

export function huntSummary(hunt: HuntRecord): HuntSummary {
  return {
    id: hunt.id,
    userId: hunt.userId,
    query: hunt.query,
    mode: hunt.mode,
    status: hunt.status,
    stage: hunt.stage,
    startedAt: hunt.startedAt,
    updatedAt: hunt.updatedAt,
    progress: hunt.progress,
    leadCount: hunt.leads.length,
  };
}

export function saveHunt(hunt: HuntRecord, root = betaRoot()): HuntRecord {
  ensureUserDir(hunt.userId, root);
  const dest = huntPath(hunt.userId, hunt.id, root);
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(hunt)}\n`);
  renameSync(tmp, dest);
  return hunt;
}

export function readHuntFile(userId: string, huntId: string, root = betaRoot()): HuntRecord | null {
  try {
    return JSON.parse(readFileSync(huntPath(userId, huntId, root), "utf8")) as HuntRecord;
  } catch {
    return null;
  }
}

export function loadHuntForUser(userId: string, huntId: string, root = betaRoot()): HuntRecord {
  const hunt = readHuntFile(userId, huntId, root);
  if (!hunt || hunt.userId !== userId) {
    throw new AuthError(404, "HUNT_NOT_FOUND", "Hunt not found.");
  }
  return hunt;
}

export function listUserHunts(userId: string, root = betaRoot()): HuntSummary[] {
  try {
    const names = readdirSync(userDir(userId, root)).filter((name) => name.endsWith(".json"));
    const rows: HuntSummary[] = [];
    for (const name of names) {
      const hunt = readHuntFile(userId, name.replace(/\.json$/, ""), root);
      if (hunt && hunt.userId === userId) rows.push(huntSummary(hunt));
    }
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function listAllHunts(root = betaRoot()): HuntSummary[] {
  try {
    const users = readdirSync(huntsRoot(root), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    const rows: HuntSummary[] = [];
    for (const user of users) {
      rows.push(...listUserHunts(user.name, root));
    }
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function findHuntById(huntId: string, root = betaRoot()): HuntRecord | null {
  try {
    const users = readdirSync(huntsRoot(root), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const user of users) {
      const hunt = readHuntFile(user.name, huntId, root);
      if (hunt) return hunt;
    }
  } catch {
    /* missing root */
  }
  return null;
}

export function latestCompletedHunt(userId: string, query?: string, root = betaRoot()): HuntRecord | null {
  const summaries = listUserHunts(userId, root).filter((row) => row.status === "completed");
  for (const row of summaries) {
    const hunt = readHuntFile(userId, row.id, root);
    if (!hunt) continue;
    if (query && hunt.query.trim().toLowerCase() !== query.trim().toLowerCase()) continue;
    return hunt;
  }
  return null;
}

export function activeHuntForUser(userId: string, root = betaRoot()): HuntSummary | undefined {
  return listUserHunts(userId, root).find((row) => row.status === "running" || row.status === "queued");
}
