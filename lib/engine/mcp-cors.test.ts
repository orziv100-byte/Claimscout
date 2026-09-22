import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isChatGptWorkOrigin,
  isMcpAllowedOrigin,
  mcpCorsHeaders,
  mcpOriginDenied,
} from "./mcp-cors.ts";

function mcpRequest(headers: Record<string, string>) {
  return new Request("https://poolindex.app/api/mcp", { method: "POST", headers });
}

test("ChatGPT Work HTTPS origins are allowed MCP clients", () => {
  assert.equal(isChatGptWorkOrigin("https://chatgpt.com"), true);
  assert.equal(isChatGptWorkOrigin("https://www.chatgpt.com"), true);
  assert.equal(isChatGptWorkOrigin("https://chat.openai.com"), true);
  assert.equal(isChatGptWorkOrigin("https://workspace.chatgpt.com"), true);
  assert.equal(isChatGptWorkOrigin("http://chatgpt.com"), false);
  assert.equal(isChatGptWorkOrigin("https://evil.com"), false);
  assert.equal(isChatGptWorkOrigin("https://openai.com"), false);
  assert.equal(isChatGptWorkOrigin("https://chatgpt.com.evil.example"), false);
});

test("MCP allows ChatGPT Work, same-origin, and native clients with no Origin", () => {
  const chatgpt = mcpRequest({
    origin: "https://chatgpt.com",
    host: "poolindex.app",
  });
  assert.equal(mcpOriginDenied(chatgpt), false);
  assert.equal(isMcpAllowedOrigin("https://chatgpt.com", chatgpt), true);

  const same = mcpRequest({
    origin: "https://poolindex.app",
    host: "poolindex.app",
  });
  assert.equal(mcpOriginDenied(same), false);

  const native = mcpRequest({ host: "poolindex.app" });
  assert.equal(mcpOriginDenied(native), false);

  const evil = mcpRequest({
    origin: "https://evil.example",
    host: "poolindex.app",
  });
  assert.equal(mcpOriginDenied(evil), true);
});

test("MCP CORS headers are reflected only for allowed browser origins", () => {
  const chatgpt = mcpRequest({
    origin: "https://chatgpt.com",
    host: "poolindex.app",
  });
  const allowed = mcpCorsHeaders(chatgpt);
  assert.equal(allowed["Access-Control-Allow-Origin"], "https://chatgpt.com");
  assert.equal(allowed["Access-Control-Allow-Credentials"], "true");
  assert.match(allowed["Access-Control-Allow-Headers"] ?? "", /Authorization/);
  assert.equal(allowed["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
  assert.equal(allowed.Vary, "Origin");
  assert.equal(Object.hasOwn(allowed, "Access-Control-Allow-Origin") && allowed["Access-Control-Allow-Origin"] === "*", false);

  const evil = mcpRequest({
    origin: "https://evil.example",
    host: "poolindex.app",
  });
  assert.deepEqual(mcpCorsHeaders(evil), {});

  const native = mcpRequest({ host: "poolindex.app" });
  assert.deepEqual(mcpCorsHeaders(native), {});
});
