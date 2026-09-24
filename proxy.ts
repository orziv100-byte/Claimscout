import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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

function desktopFrom(request: NextRequest): boolean {
  return isDesktopClient({
    userAgent: request.headers.get("user-agent"),
    desktopCookie: request.cookies.get(DESKTOP_COOKIE)?.value,
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const desktop = desktopFrom(request);

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/downloads/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (isOperatorAdminPath(pathname)) return NextResponse.next();

  if (desktop && (pathname === "/" || pathname === "")) {
    return NextResponse.redirect(new URL(APP_HOME, request.url));
  }

  if (isAppPath(pathname) && !desktop) {
    const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
    const dest = new URL(session ? PORTAL_HOME : "/login", request.url);
    if (!session) dest.searchParams.set("next", PORTAL_HOME);
    return NextResponse.redirect(dest);
  }

  if (isPublicWebsitePath(pathname)) return NextResponse.next();

  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", desktop ? pathname || APP_HOME : PORTAL_HOME);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|zip|exe)$).*)"],
};
