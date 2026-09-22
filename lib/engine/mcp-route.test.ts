import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { DEV_INVITE, getUserById, registerAccount, updateUser } from "../auth.ts";
import { formatIsraelDate, formatIsraelDateTime } from "../labels.ts";
import { sha256Base64Url } from "../password.ts";
import { createAgentToken, extractAgentTokenSecret, readAgentToken } from "./agent-token.ts";
import { handleMcp, handleMcpOptions } from "./mcp-http.ts";
import { listMcpCalls } from "./mcp-log.ts";

const betaDir = mkdtempSync(join(tmpdir(), "poolindex-mcp-route-"));
process.env.POOLINDEX_BETA_DIR = betaDir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_BETA_STAGE_CAP = "50";
process.env.NODE_ENV = "test";

after(() => {
  rmSync(betaDir, { recursive: true, force: true });
});

function rpc(method: string, extra: Record<string, unknown> = {}) {
  return { jsonrpc: "2.0", id: 1, method, ...extra };
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  return handleMcp(
    new Request("https://poolindex.app/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", host: "poolindex.app", ...headers },
      body: JSON.stringify(body),
    }),
    body as Record<string, unknown>,
  );
}

async function activeUser() {
  const registered = await registerAccount({
    email: `mcp-cors-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    password: "correct horse battery staple",
    displayName: "McpCors",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  updateUser(registered.user.id, { status: "active" });
  return registered.user;
}

test("ChatGPT Work preflight does not require a token", () => {
  const preflight = handleMcpOptions(
    new Request("https://poolindex.app/api/mcp", {
      method: "OPTIONS",
      headers: {
        origin: "https://chatgpt.com",
        host: "poolindex.app",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type, mcp-protocol-version",
      },
    }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "https://chatgpt.com");
  assert.match(preflight.headers.get("Access-Control-Allow-Headers") ?? "", /Authorization/i);
});

test("initialize and tools/list require a Bearer agent token", async () => {
  const init = await post(rpc("initialize"), { origin: "https://chatgpt.com" });
  assert.equal(init.status, 401);
  assert.equal(init.headers.get("Access-Control-Allow-Origin"), "https://chatgpt.com");

  const list = await post(rpc("tools/list"), { origin: "https://chatgpt.com" });
  assert.equal(list.status, 401);

  const user = await activeUser();
  const created = await createAgentToken({ user, name: "Connect your agent (read-only)" });
  const authedInit = await post(rpc("initialize"), {
    origin: "https://chatgpt.com",
    authorization: `Bearer ${created.token}`,
  });
  assert.equal(authedInit.status, 200);
  const initJson = (await authedInit.json()) as { result?: { serverInfo?: { name?: string } } };
  assert.equal(initJson.result?.serverInfo?.name, "poolindex");

  const authedList = await post(rpc("tools/list"), {
    origin: "https://chatgpt.com",
    authorization: `Bearer ${created.token}`,
  });
  assert.equal(authedList.status, 200);
  const listJson = (await authedList.json()) as { result?: { tools?: { name: string }[] } };
  assert.equal(listJson.result?.tools?.some((row) => row.name === "get_coverage"), true);

  const calls = listMcpCalls(user.id);
  assert.equal(calls.some((row) => row.tool === "initialize" && row.ok), true);
  assert.equal(calls.some((row) => row.tool === "tools/list" && row.ok), true);
});

test("unknown Origin is still blocked and does not receive CORS reflection", async () => {
  const res = await post(rpc("initialize"), { origin: "https://evil.example" });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  const json = (await res.json()) as { error?: { message?: string } };
  assert.equal(json.error?.message, "Cross-origin request blocked.");
});

test("tokens whose id contains underscore still authenticate tools/call", async () => {
  const user = await activeUser();
  const id = "pat__55pPcy_";
  const secret = "s3cretvaluehex";
  const token = `piagt_${id}_${secret}`;
  writeFileSync(
    join(betaDir, "agent-tokens.json"),
    `${JSON.stringify({
      tokens: {
        [id]: {
          id,
          userId: user.id,
          name: "underscore-id",
          hash: sha256Base64Url(token),
          prefix: `piagt_${id}`,
          scopes: ["read:scans", "read:catalog", "read:events"],
          createdAt: new Date().toISOString(),
        },
      },
    }, null, 2)}\n`,
  );

  const splitWouldFail = token.split("_")[1];
  assert.notEqual(splitWouldFail, id);

  const request = new Request("https://poolindex.app/api/mcp", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(readAgentToken(request)?.token.id, id);

  const quoted = new Request("https://poolindex.app/api/mcp", {
    headers: { authorization: token },
  });
  assert.equal(readAgentToken(quoted)?.token.id, id);

  const authed = await post(
    { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "get_coverage", arguments: {} } },
    { origin: "https://chatgpt.com", authorization: `Bearer ${token}` },
  );
  assert.equal(authed.status, 200);
  const authedJson = (await authed.json()) as {
    result?: { isError?: boolean; structuredContent?: { checked?: unknown } };
    error?: { message?: string };
  };
  assert.equal(authedJson.error, undefined);
  assert.equal(authedJson.result?.structuredContent?.checked != null, true);
  assert.equal(listMcpCalls(user.id).some((row) => row.tool === "get_coverage" && row.ok), true);
});

test("valid token + unbound address is WALLET_LIMIT 402, not missing-token 401", async () => {
  const user = await activeUser();
  updateUser(user.id, { wallets: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"] }, user.id);
  const stored = getUserById(user.id);
  if (!stored) throw new Error("user missing");
  const created = await createAgentToken({ user: stored, name: "Connect your agent (read-only)" });
  const other = "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe";
  const headers = { authorization: `Bearer ${created.token}` };

  const unbound = await post(
    {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "get_findings", arguments: { address: other } },
    },
    headers,
  );
  assert.equal(unbound.status, 402);
  assert.equal(unbound.headers.get("WWW-Authenticate"), null);
  const unboundJson = (await unbound.json()) as {
    error?: { code?: number; message?: string; data?: { code?: string; httpStatus?: number } };
  };
  assert.equal(unboundJson.error?.code, -32002);
  assert.equal(unboundJson.error?.data?.code, "WALLET_LIMIT");
  assert.equal(unboundJson.error?.data?.httpStatus, 402);
  assert.match(unboundJson.error?.message ?? "", /not on your account/i);
  assert.doesNotMatch(unboundJson.error?.message ?? "", /Connect your agent/i);

  const noToken = await post({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: { name: "get_findings", arguments: { address: other } },
  });
  assert.equal(noToken.status, 401);
  assert.match(noToken.headers.get("WWW-Authenticate") ?? "", /Bearer/);
  const noTokenJson = (await noToken.json()) as {
    error?: { code?: number; message?: string; data?: { code?: string } };
  };
  assert.equal(noTokenJson.error?.code, -32001);
  assert.equal(noTokenJson.error?.data?.code, "UNAUTHENTICATED");
  assert.match(noTokenJson.error?.message ?? "", /Connect your agent/i);
});

test("extractAgentTokenSecret accepts Bearer, double Bearer, and quoted values", () => {
  assert.equal(extractAgentTokenSecret(null), null);
  assert.equal(extractAgentTokenSecret("Bearer piagt_ab_cd"), "piagt_ab_cd");
  assert.equal(extractAgentTokenSecret("Bearer Bearer piagt_ab_cd"), "piagt_ab_cd");
  assert.equal(extractAgentTokenSecret("piagt_ab_cd"), "piagt_ab_cd");
  assert.equal(extractAgentTokenSecret('"piagt_ab_cd"'), "piagt_ab_cd");
  assert.equal(extractAgentTokenSecret("Basic nope"), null);
});

test("Israel date formatting does not show the UTC calendar day", () => {
  assert.equal(formatIsraelDate("2026-09-21T23:48:00.000Z"), "2026-09-22");
  assert.equal(formatIsraelDateTime("2026-09-21T23:48:00.000Z").startsWith("2026-09-22"), true);
});
