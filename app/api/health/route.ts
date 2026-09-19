import { APP_VERSION } from "@/lib/app-info";
import { inspectEnv } from "@/lib/env";
import { readOps } from "@/lib/ops";
import { publicSnapshot, readResourceSnapshot } from "@/lib/resource-guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = readResourceSnapshot();
  const ok = snapshot.level !== "critical";
  const ops = readOps();
  return NextResponse.json(
    {
      ok,
      status: snapshot.level,
      version: APP_VERSION,
      envOk: inspectEnv().ok,
      ops: {
        scansEnabled: ops.scansEnabled,
        maintenanceMode: ops.maintenanceMode,
        betaStage: ops.betaStage,
      },
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
