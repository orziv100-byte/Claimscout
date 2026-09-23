import { NextResponse } from "next/server";
import { completeGoogleAuth } from "@/lib/auth";
import {
  GOOGLE_OAUTH_COOKIE,
  desktopCallbackUrl,
  exchangeGoogleCode,
  oauthCookieOptions,
  readSignedOAuthState,
} from "@/lib/google-oauth";
import { cookieValue } from "@/lib/session-cookie";
import { attachSessionCookie, guardFailed } from "@/lib/request-guard";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failRedirect(request: Request, code: string) {
  const dest = new URL("/login", request.url);
  dest.searchParams.set("google", code);
  const res = NextResponse.redirect(dest);
  res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) return failRedirect(request, "denied");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const stored = readSignedOAuthState(cookieValue(request, GOOGLE_OAUTH_COOKIE));
  if (!code || !stored || stored.state !== state) return failRedirect(request, "state");
  try {
    const profile = await exchangeGoogleCode(code, stored.verifier);
    const finished = await completeGoogleAuth({
      sub: profile.sub,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      intent: stored.intent,
      inviteCode: stored.inviteCode,
      acceptTerms: stored.acceptTerms,
      acceptPrivacy: stored.acceptPrivacy,
      ip: clientIp(request),
      desktop: stored.desktop,
      challengeHash: stored.challengeHash,
    });
    if (stored.desktop && finished.desktopTicket) {
      const res = NextResponse.redirect(desktopCallbackUrl(finished.desktopTicket));
      res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
      return res;
    }
    const res = attachSessionCookie(NextResponse.redirect(new URL(stored.next, request.url)), finished.cookie);
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
    return res;
  } catch (error) {
    const failed = guardFailed(error);
    if (failed.status === 500) throw error;
    const dest = new URL("/login", request.url);
    dest.searchParams.set("google", "failed");
    const json = (await failed.json().catch(() => ({}))) as { code?: string };
    if (json.code) dest.searchParams.set("google", json.code);
    const res = NextResponse.redirect(dest);
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
    return res;
  }
}
