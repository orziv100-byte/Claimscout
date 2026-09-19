import { publicSnapshot, readResourceSnapshot } from "@/lib/resource-guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = readResourceSnapshot();
  const ok = snapshot.level !== "critical";
  return NextResponse.json(
    {
      ok,
      status: snapshot.level,
      resource: publicSnapshot(snapshot),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        ...(ok ? {} : { "Retry-After": "20" }),
      },
    },
  );
}
