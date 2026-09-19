export function sameOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}
