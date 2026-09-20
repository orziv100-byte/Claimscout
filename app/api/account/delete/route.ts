import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { requestAccountDeletion } from "@/lib/deletion";
import { guardFailed, isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  const body = (await request.json().catch(() => ({}))) as { password?: string; confirm?: string };
  try {
    const row = await requestAccountDeletion({
      userId: authed.user.id,
      password: typeof body.password === "string" ? body.password : "",
      confirm: typeof body.confirm === "string" ? body.confirm : "",
    });
    return NextResponse.json({
      ok: true,
      version: APP_VERSION,
      request: { id: row.id, status: row.status, requestedAt: row.requestedAt },
    });
  } catch (err) {
    return guardFailed(err);
  }
}
