import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { DEV_INVITE, getUserById, registerAccount, updateUser } from "../auth.ts";
import { createAgentToken, readAgentToken, revokeAgentToken } from "./agent-token.ts";
import { McpToolError } from "./mcp-access.ts";
import { executeMcpTool } from "./mcp-runtime.ts";
import { saveScan } from "./state.ts";
import type { EngineScan } from "./types.ts";
import type { Address } from "viem";

const engineDir = mkdtempSync(join(tmpdir(), "poolindex-mcp-"));
const betaDir = mkdtempSync(join(tmpdir(), "poolindex-mcp-beta-"));
process.env.POOLINDEX_ENGINE_DIR = engineDir;
process.env.POOLINDEX_BETA_DIR = betaDir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_BETA_STAGE_CAP = "50";
process.env.NODE_ENV = "test";

const ADDRESS = "0x0000000000000000000000000000000000000001" as Address;

function scanFixture(): EngineScan {
  return {
    address: ADDRESS,
    scannedAt: "2026-09-21T00:00:00.000Z",
    profile: {
      address: ADDRESS,
      chains: [{ chainId: 1, chainLabel: "Ethereum", native: "1", symbol: "ETH", txCount: 2 }],
      tokens: [],
      protocols: ["uniswap"],
      contracts: [],
      relevantSourceIds: ["airdrop-uni-merkle"],
    },
    findings: [
      {
        id: "airdrop-uni-merkle:1",
        sourceId: "airdrop-uni-merkle",
        catalogId: "uniswap-uni-airdrop",
        category: "airdrop",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        eligibility: "ineligible",
        title: "UNI airdrop",
        detail: "Address is not in the official Uniswap merkle chunks, so it is not eligible for that distribution.",
        officialUrl: "https://app.uniswap.org/",
        sourceStatus: "ok",
      },
      {
        id: "native-eth:1",
        sourceId: "native-eth",
        category: "native_balance",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        title: "ETH balance",
        detail: "1 ETH",
        amount: "1",
        symbol: "ETH",
        sourceStatus: "ok",
      },
    ],
    counters: { sourcesChecked: 2, sourcesFailed: 0, chainsChecked: 1, relevantSources: 2, potentialFindings: 2, verifiedFindings: 1 },
    summary: { adaptersChecked: 2, adaptersSucceeded: 2, adaptersFailed: 0, failures: [], verified: 1, uncertain: 1, rejected: 0 },
    changes: [{ kind: "new_finding", findingId: "airdrop-uni-merkle:1", summary: "New finding: UNI airdrop" }],
  };
}

async function userWithWallet() {
  const registered = await registerAccount({
    email: `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    password: "correct horse battery staple",
    displayName: "Mcp",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  updateUser(registered.user.id, { status: "active", wallets: [ADDRESS] }, registered.user.id);
  const user = getUserById(registered.user.id);
  if (!user) throw new Error("user missing");
  user.emailVerifiedAt = new Date().toISOString();
  return user;
}

beforeEach(() => {
  process.env.POOLINDEX_ENGINE_DIR = engineDir;
  process.env.POOLINDEX_BETA_DIR = betaDir;
});

after(() => {
  rmSync(engineDir, { recursive: true, force: true });
  rmSync(betaDir, { recursive: true, force: true });
});

test("unbound address returns 402 and seeds are rejected", async () => {
  const user = await userWithWallet();
  user.wallets = [];
  await assert.rejects(
    () =>
      executeMcpTool({
        name: "get_findings",
        args: { address: ADDRESS },
        user,
        scopes: ["read:scans", "read:catalog", "read:events"],
      }),
    (err: unknown) => {
      assert.ok(err instanceof McpToolError);
      assert.equal(err.status, 402);
      assert.match(err.message, /not on your account/i);
      return true;
    },
  );
  await assert.rejects(
    () =>
      executeMcpTool({
        name: "get_findings",
        args: { address: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" },
        user,
        scopes: ["read:scans", "read:catalog", "read:events"],
      }),
    (err: unknown) => {
      assert.ok(err instanceof McpToolError);
      assert.equal(err.status, 400);
      assert.match(err.message, /seed|private key/i);
      return true;
    },
  );
});

test("unknown tools and missing scopes are rejected; read tokens cannot write", async () => {
  const user = await userWithWallet();
  await assert.rejects(
    () => executeMcpTool({ name: "request_scan", args: { address: ADDRESS }, user, scopes: ["read:scans", "read:catalog", "read:events"] }),
    (err: unknown) => {
      assert.ok(err instanceof McpToolError);
      assert.match(err.message, /Unknown tool/i);
      return true;
    },
  );
  await assert.rejects(
    () => executeMcpTool({ name: "get_findings", args: { address: ADDRESS }, user, scopes: ["read:catalog"] }),
    (err: unknown) => {
      assert.ok(err instanceof McpToolError);
      assert.equal(err.status, 403);
      assert.match(err.message, /read:scans/);
      return true;
    },
  );
});

test("get_findings matches stored scan statuses and never marks a balance claimable", async () => {
  const user = await userWithWallet();
  saveScan(scanFixture());
  const payload = (await executeMcpTool({
    name: "get_findings",
    args: { address: ADDRESS },
    user,
    scopes: ["read:scans", "read:catalog", "read:events"],
  })) as { findings: { id: string; type: string; status: string }[] };
  const airdrop = payload.findings.find((row) => row.id === "airdrop-uni-merkle:1");
  const balance = payload.findings.find((row) => row.type === "balance");
  assert.equal(airdrop?.status, "not_eligible");
  assert.ok(balance);
  assert.equal(balance.status, "holding");
  assert.notEqual(balance.status, "verified_claimable");
});

test("revoking a token blocks it immediately and scopes stay read-only", async () => {
  const user = await userWithWallet();
  const created = await createAgentToken({ user, name: "Connect your agent (read-only)" });
  assert.deepEqual(created.record.scopes, ["read:scans", "read:catalog", "read:events"]);
  const request = new Request("https://poolindex.app/api/mcp", {
    headers: { authorization: `Bearer ${created.token}` },
  });
  assert.equal(readAgentToken(request)?.token.id, created.record.id);
  await revokeAgentToken(user.id, created.record.id);
  assert.equal(readAgentToken(request), null);
});
