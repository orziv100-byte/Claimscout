import { APP_VERSION } from "../app-info.ts";
import { isMcpTool, MCP_TOOL_DEFINITIONS, mcpToolHelp } from "./mcp-tools.ts";
import { UNTRUSTED_FIELD_NOTICE } from "./mcp-untrusted.ts";

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export function mcpTools() {
  return MCP_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function mcpInitializeResult() {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: "poolindex", version: APP_VERSION },
    instructions: `PoolIndex MCP is read-only. Authenticate tools/call with a Bearer piagt_ token from Account → Connect your agent (read-only). Scopes: read:scans, read:catalog, read:events. You pay for your own LLM. PoolIndex does not call a language model. No signing, no transactions, no seeds. ${UNTRUSTED_FIELD_NOTICE} ${mcpToolHelp()}`,
  };
}

export function readMcpMethod(body: Record<string, unknown>, url: URL): string {
  if (typeof body.method === "string") return body.method;
  return url.searchParams.get("method") ?? "";
}

export function readMcpId(body: Record<string, unknown>): string | number | null {
  if (typeof body.id === "string" || typeof body.id === "number") return body.id;
  return null;
}

export function mcpToolCallArgs(
  body: Record<string, unknown>,
): { name: string; arguments: Record<string, unknown> } | { error: string } {
  const params = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
  const name = typeof params.name === "string" ? params.name : typeof body.name === "string" ? body.name : "";
  let args: Record<string, unknown> = {};
  const rawArgs = params.arguments ?? params.input ?? body.arguments;
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    args = rawArgs as Record<string, unknown>;
  } else if (typeof rawArgs === "string" && rawArgs.trim()) {
    try {
      const parsed = JSON.parse(rawArgs) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      args = {};
    }
  }
  if (typeof args.address !== "string" && typeof params.address === "string") {
    args = { ...args, address: params.address };
  }
  if (!name) return { error: `Missing tool name. ${mcpToolHelp()}` };
  if (!isMcpTool(name)) return { error: `Unknown tool “${name}”. ${mcpToolHelp()}` };
  return { name, arguments: args };
}

export function jsonRpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

export function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: Record<string, unknown>,
) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: data ? { code, message, data } : { code, message },
  };
}

export const MCP_TOOL_NAMES = MCP_TOOL_DEFINITIONS.map((row) => row.name);
