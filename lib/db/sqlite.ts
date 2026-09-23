import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BetaState, UserRecord } from "../beta-types.ts";

export type BetaCounts = {
  users: number;
  wallets: number;
  sessions: number;
  invites: number;
  tokens: number;
  feedback: number;
  deletionRequests: number;
  privacyRequests: number;
};

export type MigrateReport = {
  sqlitePath: string;
  json: BetaCounts;
  sqlite: BetaCounts;
  match: boolean;
};

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  role TEXT NOT NULL,
  plan TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  email_verified_at TEXT,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  last_scan_at TEXT,
  first_scan_at TEXT,
  scan_counts_json TEXT NOT NULL,
  monitor_enabled INTEGER,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  totp_recovery_hashes_json TEXT,
  totp_last_step INTEGER,
  google_sub TEXT,
  deletion_requested_at TEXT,
  deletion_status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (user_id, address)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  stage INTEGER NOT NULL,
  max_uses INTEGER NOT NULL,
  used_by_json TEXT NOT NULL,
  disabled INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS ops (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  scans_enabled INTEGER NOT NULL,
  maintenance_mode INTEGER NOT NULL,
  beta_stage INTEGER NOT NULL,
  reason TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS privacy_requests (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS paypal_webhook_receipts (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);
`;

const openDbs = new Map<string, DatabaseSync>();

export function sqliteFile(root: string): string {
  return join(root, "poolindex.sqlite");
}

export function countBetaState(state: BetaState): BetaCounts {
  return {
    users: state.users.length,
    wallets: state.users.reduce((n, user) => n + user.wallets.length, 0),
    sessions: state.sessions.length,
    invites: state.invites.length,
    tokens: state.tokens.length,
    feedback: state.feedback.length,
    deletionRequests: state.deletionRequests.length,
    privacyRequests: state.privacyRequests.length,
  };
}

export function countsMatch(a: BetaCounts, b: BetaCounts): boolean {
  return (
    a.users === b.users &&
    a.wallets === b.wallets &&
    a.sessions === b.sessions &&
    a.invites === b.invites &&
    a.tokens === b.tokens &&
    a.feedback === b.feedback &&
    a.deletionRequests === b.deletionRequests &&
    a.privacyRequests === b.privacyRequests
  );
}

export function openSqlite(path: string): DatabaseSync {
  const existing = openDbs.get(path);
  if (existing) return existing;
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  try {
    db.exec("ALTER TABLE users ADD COLUMN google_sub TEXT");
  } catch {
    /* already present on new schema */
  }
  openDbs.set(path, db);
  return db;
}

export function closeSqlite(path: string): void {
  const db = openDbs.get(path);
  if (!db) return;
  db.close();
  openDbs.delete(path);
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function replaceSqliteFromState(state: BetaState, path: string): void {
  const db = openSqlite(path);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM wallets");
    db.exec("DELETE FROM sessions");
    db.exec("DELETE FROM invites");
    db.exec("DELETE FROM tokens");
    db.exec("DELETE FROM feedback");
    db.exec("DELETE FROM deletion_requests");
    db.exec("DELETE FROM privacy_requests");
    db.exec("DELETE FROM subscriptions");
    db.exec("DELETE FROM paypal_webhook_receipts");
    db.exec("DELETE FROM users");
    db.exec("DELETE FROM ops");
    const insertUser = db.prepare(
      `INSERT INTO users (
        id, email, display_name, password_hash, status, role, plan, invite_code,
        email_verified_at, terms_version, privacy_version, accepted_at, created_at,
        last_login_at, last_scan_at, first_scan_at, scan_counts_json, monitor_enabled,
        totp_secret, totp_enabled, totp_recovery_hashes_json, totp_last_step, google_sub,
        deletion_requested_at, deletion_status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const insertWallet = db.prepare("INSERT INTO wallets (user_id, address, position) VALUES (?,?,?)");
    for (const user of state.users) {
      insertUser.run(
        user.id,
        user.email,
        user.displayName,
        user.passwordHash,
        user.status,
        user.role,
        user.plan,
        user.inviteCode,
        user.emailVerifiedAt,
        user.termsVersion,
        user.privacyVersion,
        user.acceptedAt,
        user.createdAt,
        user.lastLoginAt,
        user.lastScanAt,
        user.firstScanAt,
        json(user.scanCounts),
        user.monitorEnabled == null ? null : user.monitorEnabled ? 1 : 0,
        user.totpSecret ?? null,
        user.totpEnabled ? 1 : 0,
        user.totpRecoveryHashes ? json(user.totpRecoveryHashes) : null,
        user.totpLastStep ?? null,
        user.googleSub ?? null,
        user.deletionRequestedAt,
        user.deletionStatus,
      );
      user.wallets.forEach((address, position) => insertWallet.run(user.id, address, position));
    }
    const insertSession = db.prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at, revoked_at) VALUES (?,?,?,?,?)",
    );
    for (const session of state.sessions) {
      insertSession.run(session.id, session.userId, session.createdAt, session.expiresAt, session.revokedAt);
    }
    const insertInvite = db.prepare(
      `INSERT INTO invites (id, code, email, stage, max_uses, used_by_json, disabled, note, created_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const invite of state.invites) {
      insertInvite.run(
        invite.id,
        invite.code,
        invite.email,
        invite.stage,
        invite.maxUses,
        json(invite.usedBy),
        invite.disabled ? 1 : 0,
        invite.note,
        invite.createdAt,
        invite.createdBy,
      );
    }
    const insertToken = db.prepare(
      "INSERT INTO tokens (id, type, user_id, hash, expires_at, used_at) VALUES (?,?,?,?,?,?)",
    );
    for (const token of state.tokens) {
      insertToken.run(token.id, token.type, token.userId, token.hash, token.expiresAt, token.usedAt);
    }
    db.prepare(
      `INSERT INTO ops (id, scans_enabled, maintenance_mode, beta_stage, reason, updated_at, updated_by)
       VALUES (1,?,?,?,?,?,?)`,
    ).run(
      state.ops.scansEnabled ? 1 : 0,
      state.ops.maintenanceMode ? 1 : 0,
      state.ops.betaStage,
      state.ops.reason,
      state.ops.updatedAt,
      state.ops.updatedBy,
    );
    const insertJson = db.prepare("INSERT INTO feedback (id, payload_json) VALUES (?,?)");
    for (const row of state.feedback) insertJson.run(row.id, json(row));
    const insertDel = db.prepare("INSERT INTO deletion_requests (id, payload_json) VALUES (?,?)");
    for (const row of state.deletionRequests) insertDel.run(row.id, json(row));
    const insertPriv = db.prepare("INSERT INTO privacy_requests (id, payload_json) VALUES (?,?)");
    for (const row of state.privacyRequests) insertPriv.run(row.id, json(row));
    const insertSub = db.prepare("INSERT INTO subscriptions (id, payload_json) VALUES (?,?)");
    for (const row of state.subscriptions ?? []) insertSub.run(row.id, json(row));
    const insertHook = db.prepare("INSERT INTO paypal_webhook_receipts (id, payload_json) VALUES (?,?)");
    for (const row of state.paypalWebhookReceipts ?? []) insertHook.run(row.id, json(row));
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema','1')").run();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('written_at', ?)").run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function strNull(value: unknown): string | null {
  return value == null ? null : str(value);
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function tableJson<T>(db: DatabaseSync, table: string): T[] {
  try {
    return (db.prepare(`SELECT payload_json FROM ${table}`).all() as { payload_json: string }[]).map((row) =>
      parseJson(row.payload_json, {} as T),
    );
  } catch {
    return [];
  }
}

export function readStateFromSqlite(path: string): BetaState {
  const db = openSqlite(path);
  const usersRaw = db.prepare("SELECT * FROM users").all() as Record<string, unknown>[];
  const wallets = db.prepare("SELECT user_id, address, position FROM wallets ORDER BY position").all() as {
    user_id: string;
    address: string;
    position: number;
  }[];
  const byUser = new Map<string, string[]>();
  for (const row of wallets) {
    const list = byUser.get(str(row.user_id)) ?? [];
    list.push(str(row.address));
    byUser.set(str(row.user_id), list);
  }
  const users: UserRecord[] = usersRaw.map((row) => ({
    id: str(row.id),
    email: str(row.email),
    displayName: str(row.display_name),
    passwordHash: str(row.password_hash),
    status: row.status as UserRecord["status"],
    role: row.role as UserRecord["role"],
    plan: row.plan as UserRecord["plan"],
    wallets: byUser.get(str(row.id)) ?? [],
    inviteCode: str(row.invite_code),
    emailVerifiedAt: strNull(row.email_verified_at),
    termsVersion: str(row.terms_version),
    privacyVersion: str(row.privacy_version),
    acceptedAt: str(row.accepted_at),
    createdAt: str(row.created_at),
    lastLoginAt: strNull(row.last_login_at),
    lastScanAt: strNull(row.last_scan_at),
    firstScanAt: strNull(row.first_scan_at),
    scanCounts: parseJson(str(row.scan_counts_json), { started: 0, completed: 0, failed: 0 }),
    monitorEnabled: row.monitor_enabled == null ? undefined : Number(row.monitor_enabled) === 1,
    totpSecret: strNull(row.totp_secret) ?? undefined,
    totpEnabled: Number(row.totp_enabled) === 1,
    totpRecoveryHashes: row.totp_recovery_hashes_json
      ? parseJson<string[]>(str(row.totp_recovery_hashes_json), [])
      : undefined,
    totpLastStep: row.totp_last_step == null ? undefined : num(row.totp_last_step),
    googleSub: strNull(row.google_sub) ?? undefined,
    deletionRequestedAt: strNull(row.deletion_requested_at),
    deletionStatus: (row.deletion_status as UserRecord["deletionStatus"]) ?? "none",
  }));
  const opsRow = db.prepare("SELECT * FROM ops WHERE id = 1").get() as Record<string, unknown> | undefined;
  return {
    users,
    sessions: (db.prepare("SELECT * FROM sessions").all() as Record<string, unknown>[]).map((row) => ({
      id: str(row.id),
      userId: str(row.user_id),
      createdAt: str(row.created_at),
      expiresAt: str(row.expires_at),
      revokedAt: strNull(row.revoked_at),
    })),
    invites: (db.prepare("SELECT * FROM invites").all() as Record<string, unknown>[]).map((row) => ({
      id: str(row.id),
      code: str(row.code),
      email: strNull(row.email),
      stage: num(row.stage) as 1 | 2 | 3,
      maxUses: num(row.max_uses),
      usedBy: parseJson<string[]>(str(row.used_by_json), []),
      disabled: Number(row.disabled) === 1,
      note: str(row.note),
      createdAt: str(row.created_at),
      createdBy: str(row.created_by),
    })),
    tokens: (db.prepare("SELECT * FROM tokens").all() as Record<string, unknown>[]).map((row) => ({
      id: str(row.id),
      type: row.type as "verify_email" | "reset_password",
      userId: str(row.user_id),
      hash: str(row.hash),
      expiresAt: str(row.expires_at),
      usedAt: strNull(row.used_at),
    })),
    ops: opsRow
      ? {
          scansEnabled: Number(opsRow.scans_enabled) === 1,
          maintenanceMode: Number(opsRow.maintenance_mode) === 1,
          betaStage: num(opsRow.beta_stage) as 1 | 2 | 3,
          reason: str(opsRow.reason),
          updatedAt: str(opsRow.updated_at),
          updatedBy: strNull(opsRow.updated_by),
        }
      : {
          scansEnabled: true,
          maintenanceMode: false,
          betaStage: 1,
          reason: "",
          updatedAt: new Date(0).toISOString(),
          updatedBy: null,
        },
    feedback: (db.prepare("SELECT payload_json FROM feedback").all() as { payload_json: string }[]).map((row) =>
      parseJson(row.payload_json, {} as BetaState["feedback"][number]),
    ),
    deletionRequests: (db.prepare("SELECT payload_json FROM deletion_requests").all() as { payload_json: string }[]).map(
      (row) => parseJson(row.payload_json, {} as BetaState["deletionRequests"][number]),
    ),
    privacyRequests: (db.prepare("SELECT payload_json FROM privacy_requests").all() as { payload_json: string }[]).map(
      (row) => parseJson(row.payload_json, {} as BetaState["privacyRequests"][number]),
    ),
    subscriptions: tableJson<BetaState["subscriptions"][number]>(db, "subscriptions"),
    paypalWebhookReceipts: tableJson<BetaState["paypalWebhookReceipts"][number]>(db, "paypal_webhook_receipts"),
  };
}

export function migrateStateToSqlite(state: BetaState, sqlitePath: string): MigrateReport {
  const json = countBetaState(state);
  replaceSqliteFromState(state, sqlitePath);
  const sqliteState = readStateFromSqlite(sqlitePath);
  const sqlite = countBetaState(sqliteState);
  return { sqlitePath, json, sqlite, match: countsMatch(json, sqlite) };
}

export function dualWriteSqlite(state: BetaState, root: string): void {
  const path = sqliteFile(root);
  if (!existsSync(path) && process.env.POOLINDEX_SQLITE_DUALWRITE !== "1") return;
  replaceSqliteFromState(state, path);
}
