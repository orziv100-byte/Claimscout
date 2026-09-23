import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { billingStatusForUser, startSandboxCheckout } from "@/lib/billing";
import { checkoutAllowed, refuseCheckout } from "@/lib/payments";
import { PaypalApiError } from "@/lib/paypal-api";
import { limitBillingAttempt, rateLimitHeaders } from "@/lib/rate-limit";
import { isResponse, requireUser } from "@/lib/request-guard";
import { withEntitlementCookie } from "@/lib/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function billingError(err: unknown) {
  if (err instanceof PaypalApiError) {
    return NextResponse.json(
      { ok: false, error: err.message, code: err.code, version: APP_VERSION },
      { status: err.status },
    );
  }
  throw err;
}

export async function GET(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Use a signed-in session for billing.", code: "AGENT_TOKEN_NO_BILLING" }, { status: 403 });
  }
  const body = billingStatusForUser(authed.user.id);
  const ent = { plan: body.plan, wallets: authed.user.wallets };
  return withEntitlementCookie(NextResponse.json(body), ent);
}

export async function POST(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Use a signed-in session for billing.", code: "AGENT_TOKEN_NO_BILLING" }, { status: 403 });
  }
  if (!checkoutAllowed()) {
    const refused = refuseCheckout();
    return NextResponse.json(refused, { status: refused.status });
  }
  const limited = limitBillingAttempt(authed.user.id);
  if (!limited.ok) {
    const headers = rateLimitHeaders(limited);
    return NextResponse.json(headers.body, { status: headers.status, headers: headers.headers });
  }
  const body = (await request.json().catch(() => ({}))) as { interval?: string };
  const interval = body.interval === "year" ? "year" : body.interval === "month" ? "month" : "";
  if (!interval) {
    return NextResponse.json({ error: "Choose monthly or yearly.", code: "INVALID_INTERVAL", version: APP_VERSION }, { status: 400 });
  }
  try {
    const started = await startSandboxCheckout({ userId: authed.user.id, interval });
    return NextResponse.json({
      ok: true,
      approvalUrl: started.approvalUrl,
      interval,
      subscription: started.subscription,
      version: APP_VERSION,
    });
  } catch (err) {
    return billingError(err);
  }
}
