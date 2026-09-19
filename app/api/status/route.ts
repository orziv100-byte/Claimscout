import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { inspectEnv } from "@/lib/env";
import { readOps } from "@/lib/ops";

export const runtime = "nodejs";

export async function GET() {
  const ops = readOps();
  return NextResponse.json({
    version: APP_VERSION,
    maintenanceMode: ops.maintenanceMode,
    scansEnabled: ops.scansEnabled,
    betaStage: ops.betaStage,
    envOk: inspectEnv().ok,
  });
}
