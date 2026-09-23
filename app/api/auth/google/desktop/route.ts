import { NextResponse } from "next/server";
import { redeemGoogleDesktopTicket } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/google-oauth";
import { attachSessionCookie, guardFailed } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket") || "";
  const challenge = url.searchParams.get("challenge") || "";
  const next = sanitizeNextPath(url.searchParams.get("next"), true);
  try {
    const redeemed = redeemGoogleDesktopTicket(ticket, challenge);
    return attachSessionCookie(NextResponse.redirect(new URL(next, request.url)), redeemed.cookie);
  } catch (err) {
    const failed = guardFailed(err);
    if (failed.status === 500) throw err;
    const dest = new URL("/login", request.url);
    dest.searchParams.set("google", "desktop");
    return NextResponse.redirect(dest);
  }
}
