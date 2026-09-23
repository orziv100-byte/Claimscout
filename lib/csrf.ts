const PUBLIC_HOSTS = new Set(["poolindex.app", "www.poolindex.app"]);

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Hostname only — strip ports, schemes, and comma-separated forwarded lists. */
export function requestHostname(raw: string | null | undefined): string {
  if (!raw) return "";
  const first = raw.split(",")[0].trim().toLowerCase();
  if (!first) return "";
  try {
    const url = new URL(first.includes("://") ? first : `https://${first}`);
    return url.hostname.toLowerCase();
  } catch {
    return first.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1").replace(/:\d+$/, "");
  }
}

export function sameOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  const clientHost =
    requestHostname(request.headers.get("origin")) || requestHostname(request.headers.get("referer"));
  const serverHost =
    requestHostname(request.headers.get("x-forwarded-host")) || requestHostname(request.headers.get("host"));
  if (!clientHost) return false;
  if (serverHost && clientHost === serverHost) return true;
  if (PUBLIC_HOSTS.has(clientHost) && (PUBLIC_HOSTS.has(serverHost) || isLoopbackHost(serverHost))) return true;
  return false;
}
