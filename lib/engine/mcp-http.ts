import { NextResponse } from "next/server";
import { touchAgentTokenUsed } from "./agent-token.ts";
import { asMcpToolError, McpToolError } from "./mcp-access.ts";
import { mcpCorsHeaders, mcpOriginDenied } from "./mcp-cors.ts";
import { recordMcpCall } from "./mcp-log.ts";
import {
  jsonRpcError,
  jsonRpcResult,
  mcpInitializeResult,
  mcpToolCallArgs,
  mcpTools,
  readMcpId,
  readMcpMethod,
} from "./mcp.ts";
import { executeMcpTool } from "./mcp-runtime.ts";
import { isResponse, requireAgentToken, type Authed } from "../request-guard.ts";
import { rateLimit } from "../rate-limit.ts";

const MCP_PER_MINUTE = 30;

function jsonRpcResponse(request: Request, payload: unknown, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", ...mcpCorsHeaders(request), ...extraHeaders },
  });
}

function originBlocked(request: Request, id: string | number | null) {
  return jsonRpcResponse(request, jsonRpcError(id, -32001, "Cross-origin request blocked."), 403);
}

function messageFromResponse(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string") {
    return (payload as { error: string }).error;
  }
  return fallback;
}

function jsonRpcAppError(
  request: Request,
  id: string | number | null,
  toolErr: McpToolError,
) {
  const rpcCode =
    toolErr.status === 404
      ? -32004
      : toolErr.status === 402
        ? -32002
        : toolErr.status === 403
          ? -32003
          : toolErr.status === 400
            ? -32602
            : -32000;
  const data: Record<string, unknown> = {
    httpStatus: toolErr.status,
    code: toolErr.code,
    ...toolErr.extra,
  };
  // Application 402 matches /api/onchain. JSON-RPC code is -32002 with
  // data.code WALLET_LIMIT — never reuse -32001 / "Connect your agent".
  const httpStatus = toolErr.status === 402 ? 402 : 200;
  return jsonRpcResponse(request, jsonRpcError(id, rpcCode, toolErr.message, data), httpStatus);
}

function logCall(authed: Authed, tool: string, ok: boolean, status?: number, wallet?: string) {
  if (!authed.tokenId) return;
  recordMcpCall(authed.user.id, {
    at: new Date().toISOString(),
    tool,
    wallet,
    tokenId: authed.tokenId,
    ok,
    status,
  });
}

async function requireMcpAuth(request: Request, id: string | number | null) {
  const authed = requireAgentToken(request);
  if (isResponse(authed)) {
    const payload = (await authed.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      error: jsonRpcResponse(
        request,
        jsonRpcError(id, -32001, messageFromResponse(payload, "Sign in required."), {
          httpStatus: authed.status,
          code: typeof payload.code === "string" ? payload.code : "UNAUTHENTICATED",
        }),
        authed.status,
        authed.status === 401 ? { "WWW-Authenticate": 'Bearer realm="poolindex-mcp"' } : undefined,
      ),
    };
  }
  if (authed.authKind !== "agent_token" || !authed.tokenId) {
    return {
      error: jsonRpcResponse(
        request,
        jsonRpcError(
          id,
          -32001,
          "Connect your agent with a read-only MCP token (Authorization: Bearer piagt_…). Create it on Account.",
          { httpStatus: 401, code: "UNAUTHENTICATED" },
        ),
        401,
        { "WWW-Authenticate": 'Bearer realm="poolindex-mcp"' },
      ),
    };
  }
  const limited = rateLimit(`mcp:token:${authed.tokenId}`, MCP_PER_MINUTE, 60_000);
  if (!limited.ok) {
    return {
      error: jsonRpcResponse(
        request,
        jsonRpcError(
          id,
          -32029,
          "Too many MCP requests for this token. Wait, then try once — do not retry in a loop.",
        ),
        429,
        { "Retry-After": String(limited.retryAfterSec) },
      ),
    };
  }
  return { authed };
}

export async function handleMcp(request: Request, body: Record<string, unknown>) {
  const url = new URL(request.url);
  const method = readMcpMethod(body, url);
  const id = readMcpId(body);

  if (mcpOriginDenied(request)) {
    return originBlocked(request, id);
  }

  const auth = await requireMcpAuth(request, id);
  if ("error" in auth) return auth.error;
  const { authed } = auth;

  if (!method || method === "initialize") {
    logCall(authed, "initialize", true);
    void touchAgentTokenUsed(authed.tokenId!);
    return jsonRpcResponse(request, jsonRpcResult(id, mcpInitializeResult()));
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return jsonRpcResponse(request, jsonRpcResult(id, {}));
  }
  if (method === "tools/list") {
    logCall(authed, "tools/list", true);
    void touchAgentTokenUsed(authed.tokenId!);
    return jsonRpcResponse(request, jsonRpcResult(id, { tools: mcpTools() }));
  }

  if (method !== "tools/call") {
    return jsonRpcResponse(
      request,
      jsonRpcError(id, -32601, `Unknown method. ${mcpInitializeResult().instructions}`),
      400,
    );
  }

  const parsed = mcpToolCallArgs(body);
  if ("error" in parsed) {
    logCall(authed, "tools/call", false, 400);
    return jsonRpcResponse(request, jsonRpcError(id, -32601, parsed.error), 400);
  }

  const wallet = typeof parsed.arguments.address === "string" ? parsed.arguments.address : undefined;
  try {
    const payload = await executeMcpTool({
      name: parsed.name,
      args: parsed.arguments,
      user: authed.user,
      scopes: authed.scopes ?? [],
    });
    logCall(authed, parsed.name, true, undefined, wallet);
    void touchAgentTokenUsed(authed.tokenId!);
    return jsonRpcResponse(
      request,
      jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
        isError: false,
      }),
    );
  } catch (err) {
    const toolErr = asMcpToolError(err);
    if (toolErr) {
      logCall(authed, parsed.name, false, toolErr.status, wallet);
      return jsonRpcAppError(request, id, toolErr);
    }
    const message = err instanceof Error ? err.message : "Tool failed";
    logCall(authed, parsed.name, false, 500, wallet);
    return jsonRpcResponse(request, jsonRpcError(id, -32000, message, { httpStatus: 500, code: "TOOL_FAILED" }), 500);
  }
}

export function handleMcpOptions(request: Request) {
  if (mcpOriginDenied(request)) {
    return originBlocked(request, null);
  }
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", ...mcpCorsHeaders(request) },
  });
}
