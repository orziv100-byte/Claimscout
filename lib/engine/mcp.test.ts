import assert from "node:assert/strict";
import { test } from "node:test";
import {
  jsonRpcError,
  jsonRpcResult,
  mcpInitializeResult,
  mcpToolCallArgs,
  mcpTools,
  readMcpMethod,
} from "./mcp.ts";
import { MCP_TOOL_NAMES } from "./mcp-tools.ts";
import { walletChangeIsNotifiable } from "../browser-notify.ts";

test("MCP lists only read-only tools and tells clients not to follow untrusted text", () => {
  const tools = mcpTools();
  assert.deepEqual(
    tools.map((row) => row.name),
    [...MCP_TOOL_NAMES],
  );
  assert.equal(tools.some((row) => row.name === "request_scan"), false);
  assert.equal(tools.some((row) => row.name === "wallet.scan"), false);
  for (const tool of tools) {
    assert.match(tool.description, /untrusted/i);
    assert.match(tool.description, /Read-only/i);
    assert.match(tool.description, /seed/i);
    assert.equal(JSON.stringify(tool).includes("secret"), false);
  }
  const init = mcpInitializeResult();
  assert.equal(init.capabilities.tools != null, true);
  assert.match(init.instructions ?? "", /read-only/i);
  assert.match(init.instructions ?? "", /does not call a language model/i);
  assert.doesNotMatch(init.instructions ?? "", /Native Agent|llm_unconfigured/i);
});

test("MCP tool call requires a known read-only tool", () => {
  const bad = mcpToolCallArgs({ method: "tools/call", params: { name: "request_scan" } });
  assert.equal("error" in bad, true);
  if ("error" in bad) assert.match(bad.error, /Unknown tool/i);
  const write = mcpToolCallArgs({ method: "tools/call", params: { name: "wallet.scan" } });
  assert.equal("error" in write, true);
  const ok = mcpToolCallArgs({
    method: "tools/call",
    params: { name: "get_findings", arguments: { address: "0x0000000000000000000000000000000000000001" } },
  });
  assert.equal("error" in ok, false);
  if (!("error" in ok)) {
    assert.equal(ok.name, "get_findings");
    assert.equal(ok.arguments.address, "0x0000000000000000000000000000000000000001");
  }
  const asString = mcpToolCallArgs({
    method: "tools/call",
    params: { name: "get_findings", arguments: JSON.stringify({ address: "0x0000000000000000000000000000000000000001" }) },
  });
  assert.equal("error" in asString, false);
  if (!("error" in asString)) {
    assert.equal(asString.arguments.address, "0x0000000000000000000000000000000000000001");
  }
});

test("MCP JSON-RPC envelope keeps initialize separate from tools", () => {
  assert.equal(readMcpMethod({ method: "initialize" }, new URL("https://poolindex.app/api/mcp")), "initialize");
  assert.equal(readMcpMethod({ method: "tools/list" }, new URL("https://poolindex.app/api/mcp")), "tools/list");
  assert.deepEqual(jsonRpcResult(1, { ok: true }), { jsonrpc: "2.0", id: 1, result: { ok: true } });
  assert.equal(jsonRpcError(1, -32601, "no").error.code, -32601);
});

test("desktop notify skips baseline-only scans", () => {
  assert.equal(walletChangeIsNotifiable([{ kind: "baseline" }]), false);
  assert.equal(walletChangeIsNotifiable([{ kind: "new_finding" }]), true);
  assert.equal(walletChangeIsNotifiable([]), false);
});
