import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { listFeedback, publicFeedback, submitFeedback } from "@/lib/feedback";
import { guardFailed, isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const row = submitFeedback({
      userId: authed.user.id,
      type: String(body.type || ""),
      note: typeof body.note === "string" ? body.note : "",
      source: typeof body.source === "string" ? body.source : "",
      claimId: typeof body.claimId === "string" ? body.claimId : "",
      leadId: typeof body.leadId === "string" ? body.leadId : "",
      url: typeof body.url === "string" ? body.url : "",
    });
    return NextResponse.json({ ok: true, feedback: publicFeedback(row), version: APP_VERSION });
  } catch (err) {
    return guardFailed(err);
  }
}
