export const WEBSITE_HOME = "/";
export const PORTAL_HOME = "/download";
export const APP_HOME = "/app";
export const DESKTOP_COOKIE = "poolindex_desktop";
export const DESKTOP_UA_TOKEN = "PoolIndexDesktop";

const PUBLIC_WEBSITE_PREFIXES = [
  "/download",
  "/downloads",
  "/login",
  "/register",
  "/forgot",
  "/reset",
  "/verify",
  "/terms",
  "/privacy",
  "/accessibility",
  "/safety",
  "/desktop",
  "/upgrade",
];

const PORTAL_PREFIXES = ["/account", "/upgrade", "/download"];

const APP_PREFIXES = [
  "/app",
  "/wallet",
  "/discover",
  "/hunts",
  "/catalog",
  "/connect",
  "/coverage",
  "/claims",
];

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return "";
  const path = pathname.split("?")[0] || "";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function isPublicWebsitePath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname);
  if (path === "/" || path === "") return true;
  return matchesPrefix(path, PUBLIC_WEBSITE_PREFIXES);
}

export function isPortalPath(pathname: string | null | undefined): boolean {
  return matchesPrefix(normalizePathname(pathname), PORTAL_PREFIXES);
}

export function isAppPath(pathname: string | null | undefined): boolean {
  return matchesPrefix(normalizePathname(pathname), APP_PREFIXES);
}

export function isOperatorAdminPath(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname);
  return path === "/admin" || path.startsWith("/admin/");
}

export function isDesktopUserAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent || "";
  return ua.includes(DESKTOP_UA_TOKEN) || /\bElectron\//.test(ua);
}

export function isDesktopCookie(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}

export function isDesktopClient(input: { userAgent?: string | null; desktopCookie?: string | null }): boolean {
  return isDesktopCookie(input.desktopCookie) || isDesktopUserAgent(input.userAgent);
}

export function isDesktopRequest(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const desktopCookie = /(?:^|;\s*)poolindex_desktop=1(?:;|$)/.test(cookieHeader) ? "1" : null;
  return isDesktopClient({ userAgent: request.headers.get("user-agent"), desktopCookie });
}

/** Direct operator hits to loopback. Cloudflare tunnel sets x-forwarded-* and must not match. */
export function isLoopbackOperator(request: Request): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") return false;
  if (request.headers.get("x-forwarded-host") || request.headers.get("x-forwarded-for")) return false;
  return true;
}

export function isScanClientAllowed(request: Request): boolean {
  return isDesktopRequest(request) || isLoopbackOperator(request);
}

export function isBrowserDesktopClient(): boolean {
  if (typeof navigator === "undefined") return false;
  const cookie = typeof document !== "undefined" ? document.cookie : "";
  const desktopCookie = /(?:^|;\s*)poolindex_desktop=1(?:;|$)/.test(cookie) ? "1" : null;
  return isDesktopClient({ userAgent: navigator.userAgent, desktopCookie });
}

/** Website logins land on the download portal. Desktop may keep in-app destinations. */
export function websitePostLoginPath(raw: string | null | undefined, desktop = false): string {
  const fallback = desktop ? APP_HOME : PORTAL_HOME;
  const value = (raw || fallback).trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const path = normalizePathname(value) || fallback;
  if (desktop) return path.startsWith("/") ? path : fallback;
  if (isAppPath(path) || isOperatorAdminPath(path)) return PORTAL_HOME;
  if (["/login", "/register", "/forgot", "/reset", "/verify"].includes(path)) return PORTAL_HOME;
  if (isPublicWebsitePath(path) || isPortalPath(path)) return path;
  return PORTAL_HOME;
}
