import { publicHealthBody } from "@/lib/health";
import { readResourceSnapshot } from "@/lib/resource-guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = readResourceSnapshot();
  const body = publicHealthBody(snapshot.level);
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      ...(body.ok ? {} : { "Retry-After": "20" }),
    },
  });
}
