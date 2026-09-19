import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { loadHuntForUser } from "@/lib/intelligence/store";
import { guardFailed, isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  const url = new URL(request.url);
  const huntId = url.searchParams.get("huntId") || url.searchParams.get("id") || "";
  const leadId = url.searchParams.get("leadId") || "";
  if (!huntId) {
    return NextResponse.json({ error: "Hunt id required.", code: "HUNT_ID_REQUIRED", version: APP_VERSION }, { status: 400 });
  }
  try {
    const hunt = loadHuntForUser(authed.user.id, huntId);
    const leads = leadId ? hunt.leads.filter((lead) => lead.id === leadId) : hunt.leads;
    return NextResponse.json({ version: APP_VERSION, huntId: hunt.id, leads });
  } catch (err) {
    return guardFailed(err);
  }
}
