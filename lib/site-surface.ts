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
  "/eula",
  "/disclaimer",
  "/accessibility",
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
  "/safety",
  "/claims",
  "/desktop",
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
  return value === "1";
}

export function isDesktopClient(input: { userAgent?: string | null; desktopCookie?: string | null }): boolean {
  return isDesktopCookie(input.desktopCookie) || isDesktopUserAgent(input.userAgent);
}

/** Website logins land on the download portal. Desktop may keep in-app destinations. */
export function websitePostLoginPath(raw: string | null | undefined, desktop = false): string {
  const fallback = desktop ? APP_HOME : PORTAL_HOME;
  const value = (raw || fallback).trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const path = normalizePathname(value) || fallback;
  if (desktop) return path.startsWith("/") ? path : fallback;
  if (isAppPath(path) || isOperatorAdminPath(path)) return PORTAL_HOME;
  if (isPublicWebsitePath(path) || isPortalPath(path)) return path;
  return PORTAL_HOME;
}
