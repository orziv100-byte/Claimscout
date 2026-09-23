import { NextResponse } from "next/server";
import { billingStatusForUser } from "@/lib/billing";
import { withEntitlementCookie } from "@/lib/entitlement";
import { isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Use a signed-in session for billing.", code: "AGENT_TOKEN_NO_BILLING" }, { status: 403 });
  }
  const body = billingStatusForUser(authed.user.id);
  return withEntitlementCookie(NextResponse.json(body), { plan: body.plan, wallets: authed.user.wallets });
}
