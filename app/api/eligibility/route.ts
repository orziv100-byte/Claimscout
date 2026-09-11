import { checkEligibility, isHexAddress } from "@/lib/onchain";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const claimId = searchParams.get("claimId");
  const address = searchParams.get("address");
  if (!claimId || !address) {
    return NextResponse.json({ error: "claimId and address are required" }, { status: 400 });
  }
  if (!isHexAddress(address)) {
    return NextResponse.json({ error: "address must be a 0x-prefixed 20-byte hex string" }, { status: 400 });
  }

  const result = await checkEligibility(claimId, getAddress(address));
  return NextResponse.json(result);
}
