import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { AuthError } from "@/lib/auth";
import {
  createOAuthState,
  googleConfigured,
  oauthCookieOptions,
  GOOGLE_OAUTH_COOKIE,
} from "@/lib/google-oauth";
import { clientIp, limitCredentialAttempt } from "@/lib/rate-limit";
import { guardFailed } from "@/lib/request-guard";
import { DESKTOP_COOKIE, isDesktopClient } from "@/lib/site-surface";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = url.searchParams.get("intent") === "register" ? "register" : "login";
  if (!googleConfigured()) {
    const dest = new URL(intent === "register" ? "/register" : "/login", request.url);
    dest.searchParams.set("google", "GOOGLE_NOT_CONFIGURED");
    return NextResponse.redirect(dest);
  }
  const ip = clientIp(request);
  const limited = limitCredentialAttempt(intent === "register" ? "register" : "login", ip, "google");
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Wait and try once.", code: "RATE_LIMIT", version: APP_VERSION },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const desktopCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${DESKTOP_COOKIE}=`))
      ?.slice(DESKTOP_COOKIE.length + 1);
    const desktop =
      url.searchParams.get("desktop") === "1" ||
      isDesktopClient({
        userAgent: request.headers.get("user-agent"),
        desktopCookie,
      });
    const started = createOAuthState({
      intent,
      inviteCode: url.searchParams.get("inviteCode") || "",
      acceptTerms: url.searchParams.get("acceptTerms") === "1",
      acceptPrivacy: url.searchParams.get("acceptPrivacy") === "1",
      next: url.searchParams.get("next") || undefined,
      desktop,
      desktopChallenge: url.searchParams.get("challenge") || "",
    });
    if (intent === "register" && (!started.state.acceptTerms || !started.state.acceptPrivacy || !started.state.inviteCode)) {
      return NextResponse.redirect(new URL("/register?google=invite", request.url));
    }
    const res = NextResponse.redirect(started.authorizeUrl);
    res.cookies.set(GOOGLE_OAUTH_COOKIE, started.cookieValue, oauthCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof AuthError) return guardFailed(err);
    if (err instanceof Error && err.message === "GOOGLE_NOT_CONFIGURED") {
      const dest = new URL(intent === "register" ? "/register" : "/login", request.url);
      dest.searchParams.set("google", "GOOGLE_NOT_CONFIGURED");
      return NextResponse.redirect(dest);
    }
    throw err;
  }
}
