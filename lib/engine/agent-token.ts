import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { betaRoot, withBetaLock } from "../beta-store.ts";
import { getUserById } from "../auth.ts";
import type { UserRecord } from "../beta-types.ts";
import { sha256Base64Url } from "../password.ts";
import { writeEngineAtomic } from "./paths.ts";

const TOKEN_PREFIX = "piagt";

export const MCP_SCOPES = ["read:scans", "read:catalog", "read:events"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export type AgentTokenRecord = {
  id: string;
  userId: string;
  name: string;
  hash: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
};

type TokenStore = { tokens: Record<string, AgentTokenRecord> };

function storePath(): string {
  return join(betaRoot(), "agent-tokens.json");
}

function loadStore(): TokenStore {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), "utf8")) as TokenStore;
    if (parsed?.tokens && typeof parsed.tokens === "object") return parsed;
  } catch {
    /* miss */
  }
  return { tokens: {} };
}

function saveStore(store: TokenStore): void {
  writeEngineAtomic(storePath(), `${JSON.stringify(store, null, 2)}\n`);
}

export function isMcpScope(value: string): value is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(value);
}

export function normalizeMcpScopes(scopes: string[]): McpScope[] {
  const read = [...new Set(scopes.filter(isMcpScope))];
  if (read.length) return read;
  if (scopes.length) return [...MCP_SCOPES];
  return [...MCP_SCOPES];
}

export function defaultMcpScopes(): McpScope[] {
  return [...MCP_SCOPES];
}

export function publicAgentToken(row: AgentTokenRecord) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: normalizeMcpScopes(row.scopes),
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    writeProduction: false as const,
  };
}

export async function createAgentToken(input: {
  user: UserRecord;
  name: string;
}): Promise<{ token: string; record: ReturnType<typeof publicAgentToken> }> {
  const name = input.name.trim().slice(0, 80) || "Connect your agent (read-only)";
  const id = randomBytes(9).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const token = `${TOKEN_PREFIX}_${id}_${secret}`;
  const record: AgentTokenRecord = {
    id,
    userId: input.user.id,
    name,
    hash: sha256Base64Url(token),
    prefix: `${TOKEN_PREFIX}_${id}`,
    scopes: defaultMcpScopes(),
    createdAt: new Date().toISOString(),
  };
  await withBetaLock(() => {
    const store = loadStore();
    store.tokens[id] = record;
    saveStore(store);
  });
  return { token, record: publicAgentToken(record) };
}

export function listAgentTokens(userId: string) {
  return Object.values(loadStore().tokens)
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicAgentToken);
}

export async function revokeAgentToken(userId: string, id: string): Promise<ReturnType<typeof publicAgentToken> | null> {
  return withBetaLock(() => {
    const store = loadStore();
    const row = store.tokens[id];
    if (!row || row.userId !== userId) return null;
    row.revokedAt = new Date().toISOString();
    saveStore(store);
    return publicAgentToken(row);
  });
}

export function extractAgentTokenSecret(authorization: string | null): string | null {
  if (!authorization) return null;
  let value = authorization.trim();
  value = value.replace(/^(Bearer\s+)+/i, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value.startsWith(`${TOKEN_PREFIX}_`)) return null;
  return value;
}

export function readAgentToken(request: Request): { user: UserRecord; token: AgentTokenRecord } | null {
  const raw = extractAgentTokenSecret(request.headers.get("authorization"));
  if (!raw) return null;
  const store = loadStore();
  for (const row of Object.values(store.tokens)) {
    if (row.revokedAt) continue;
    if (sha256Base64Url(raw) !== row.hash) continue;
    const user = getUserById(row.userId);
    if (!user) return null;
    if (user.status !== "active" || user.deletionStatus === "completed") return null;
    return { user, token: row };
  }
  return null;
}

export function scopesFromToken(token: AgentTokenRecord): readonly McpScope[] {
  return normalizeMcpScopes(token.scopes);
}

export async function touchAgentTokenUsed(id: string): Promise<void> {
  await withBetaLock(() => {
    const store = loadStore();
    const row = store.tokens[id];
    if (!row || row.revokedAt) return;
    row.lastUsedAt = new Date().toISOString();
    saveStore(store);
  });
}
