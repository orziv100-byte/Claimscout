/**
 * CORS and Origin checks for the Streamable HTTP MCP endpoint only.
 * Other API routes keep cookie CSRF (same-origin). MCP is Bearer-authenticated
 * and is called by browser clients such as ChatGPT Work.
 */

const MCP_ALLOWED_HEADERS = [
  "Accept",
  "Authorization",
  "Content-Type",
  "Last-Event-ID",
  "MCP-Protocol-Version",
  "Mcp-Session-Id",
].join(", ");

const MCP_EXPOSE_HEADERS = "Last-Event-ID, MCP-Protocol-Version, Mcp-Session-Id";

export function isChatGptWorkOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "chatgpt.com" || host === "www.chatgpt.com") return true;
    if (host === "chat.openai.com" || host === "www.chat.openai.com") return true;
    return host.endsWith(".chatgpt.com");
  } catch {
    return false;
  }
}

function requestHost(request: Request): string | null {
  return request.headers.get("x-forwarded-host") || request.headers.get("host");
}

export function isMcpAllowedOrigin(origin: string, request: Request): boolean {
  if (isChatGptWorkOrigin(origin)) return true;
  const host = requestHost(request);
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Native MCP clients omit Origin. Browser clients must be ChatGPT Work or same-origin. */
export function mcpOriginDenied(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return !isMcpAllowedOrigin(origin, request);
}

export function mcpCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !isMcpAllowedOrigin(origin, request)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": MCP_ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": MCP_EXPOSE_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
