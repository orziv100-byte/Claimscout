import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PATHNAME_HEADER } from "@/lib/pathname-header";
import { downloadsPaused, isDownloadPagePath, isInstallerDownloadPath, recordDownloadEvent } from "@/lib/download-ops";
import { clientIp } from "@/lib/rate-limit";
import { SESSION_COOKIE, parseSessionCookie } from "@/lib/session-cookie";
import {
  APP_HOME,
  DESKTOP_COOKIE,
  PORTAL_HOME,
  isAppPath,
  isDesktopClient,
  isOperatorAdminPath,
  isPublicWebsitePath,
} from "@/lib/site-surface";

function nextWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function desktopFrom(request: NextRequest): boolean {
  return isDesktopClient({
    userAgent: request.headers.get("user-agent"),
    desktopCookie: request.cookies.get(DESKTOP_COOKIE)?.value,
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const desktop = desktopFrom(request);

  if (isInstallerDownloadPath(pathname) || isDownloadPagePath(pathname)) {
    recordDownloadEvent({
      kind: isInstallerDownloadPath(pathname) ? "file" : "page",
      path: pathname,
      ip: clientIp(request),
    });
    if (isInstallerDownloadPath(pathname) && downloadsPaused()) {
      return new NextResponse("Downloads are paused.", {
        status: 503,
        headers: { "retry-after": "120", "cache-control": "no-store" },
      });
    }
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return nextWithPath(request);
  }

  if (isOperatorAdminPath(pathname)) return nextWithPath(request);

  if (desktop && (pathname === "/" || pathname === "")) {
    return NextResponse.redirect(new URL(APP_HOME, request.url));
  }

  if (isAppPath(pathname) && !desktop) {
    const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
    const dest = new URL(session ? PORTAL_HOME : "/login", request.url);
    if (!session) dest.searchParams.set("next", PORTAL_HOME);
    return NextResponse.redirect(dest);
  }

  if (isPublicWebsitePath(pathname)) return nextWithPath(request);

  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return nextWithPath(request);

  const login = new URL("/login", request.url);
  login.searchParams.set("next", desktop ? pathname || APP_HOME : PORTAL_HOME);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
