import { NextResponse } from "next/server";
import { checkoutAllowed, refuseCheckout } from "@/lib/payments";
import { requireUser, isResponse } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  if (!checkoutAllowed()) {
    const refused = refuseCheckout();
    return NextResponse.json(refused, { status: refused.status });
  }
  const refused = refuseCheckout();
  return NextResponse.json(refused, { status: refused.status });
}

export async function GET() {
  const refused = refuseCheckout();
  return NextResponse.json(refused, { status: refused.status });
}
