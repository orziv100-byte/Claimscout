import { publicStatusBody } from "@/lib/health";
import { readOps } from "@/lib/ops";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const ops = readOps();
  return NextResponse.json(publicStatusBody(ops.maintenanceMode), {
    headers: { "Cache-Control": "no-store" },
  });
}
