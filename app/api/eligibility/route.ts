import { guardedJson } from "@/lib/api-guard";
import { entitlementFromRequest, gateWallet, withEntitlementCookie } from "@/lib/entitlement";
import { checkEligibility, isHexAddress } from "@/lib/onchain";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

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

  const checksum = getAddress(address);
  const gated = gateWallet(entitlementFromRequest(request), checksum);
  if (!gated.ok) {
    return NextResponse.json(gated.body, { status: gated.status });
  }

  const res = await guardedJson(
    request,
    "eligibility",
    "light",
    () => checkEligibility(claimId, checksum),
    `eligibility:${claimId}:${checksum.toLowerCase()}`,
  );
  return withEntitlementCookie(res, gated.entitlement);
}
