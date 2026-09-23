import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { handlePaypalWebhookRequest } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await handlePaypalWebhookRequest(request);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code, version: APP_VERSION },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, duplicate: result.duplicate === true, version: APP_VERSION });
}
