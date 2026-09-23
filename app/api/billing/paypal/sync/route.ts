import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { billingStatusForUser, syncUserSubscription } from "@/lib/billing";
import { withEntitlementCookie } from "@/lib/entitlement";
import { PaypalApiError } from "@/lib/paypal-api";
import { limitBillingAttempt, rateLimitHeaders } from "@/lib/rate-limit";
import { isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Use a signed-in session for billing.", code: "AGENT_TOKEN_NO_BILLING" }, { status: 403 });
  }
  const limited = limitBillingAttempt(authed.user.id);
  if (!limited.ok) {
    const headers = rateLimitHeaders(limited);
    return NextResponse.json(headers.body, { status: headers.status, headers: headers.headers });
  }
  try {
    await syncUserSubscription(authed.user.id);
    const latest = billingStatusForUser(authed.user.id);
    return withEntitlementCookie(
      NextResponse.json({ ...latest, synced: true, version: APP_VERSION }),
      { plan: latest.plan, wallets: authed.user.wallets },
    );
  } catch (err) {
    if (err instanceof PaypalApiError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code, version: APP_VERSION }, { status: err.status });
    }
    throw err;
  }
}
