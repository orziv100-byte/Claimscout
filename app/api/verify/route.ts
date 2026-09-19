import { guardedJson } from "@/lib/api-guard";
import { isResponse, requireScan } from "@/lib/request-guard";
import { verifyUrl } from "@/lib/verify";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
  const authed = requireScan(request);
  if (isResponse(authed)) return authed;
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  return guardedJson(request, "verify-url", "heavy", () => verifyUrl(url), `verify:${authed.user.id}:${url}`);
}
