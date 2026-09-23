import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { listFeedback, publicFeedback, submitFeedback } from "@/lib/feedback";
import { guardFailed, isResponse, rateLimitedResponse, requireUser } from "@/lib/request-guard";
import { limitFeedbackAttempt } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  const rows = listFeedback({ userId: authed.user.id });
  return NextResponse.json({
    version: APP_VERSION,
    feedback: rows.map(publicFeedback),
  });
}

export async function POST(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json(
      { error: "Use a signed-in session to send feedback.", code: "AGENT_TOKEN_NO_FEEDBACK", version: APP_VERSION },
      { status: 403 },
    );
  }
  const limited = limitFeedbackAttempt(authed.user.id);
  if (!limited.ok) return rateLimitedResponse(limited);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const row = submitFeedback({
      userId: authed.user.id,
      type: String(body.type || body.category || ""),
      note: typeof body.note === "string" ? body.note : typeof body.message === "string" ? body.message : "",
      source: typeof body.source === "string" ? body.source : "exe",
      claimId: typeof body.claimId === "string" ? body.claimId : "",
      leadId: typeof body.leadId === "string" ? body.leadId : "",
      url: typeof body.url === "string" ? body.url : "",
      rating: typeof body.rating === "number" ? body.rating : null,
      contactMe: body.contactMe === true,
    });
    return NextResponse.json({ ok: true, feedback: publicFeedback(row), version: APP_VERSION });
  } catch (err) {
    return guardFailed(err);
  }
}
