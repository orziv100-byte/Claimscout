import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { createPrivacyRequest } from "@/lib/deletion";
import { guardFailed, isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  const body = (await request.json().catch(() => ({}))) as { type?: string; message?: string };
  try {
    const row = createPrivacyRequest({
      userId: authed.user.id,
      type: typeof body.type === "string" ? body.type : "",
      message: typeof body.message === "string" ? body.message : "",
    });
    return NextResponse.json({
      ok: true,
      version: APP_VERSION,
      request: { id: row.id, type: row.type, status: row.status, createdAt: row.createdAt },
    });
  } catch (err) {
    return guardFailed(err);
  }
}
