import { guardedJson } from "@/lib/api-guard";
import { gateWallet, withEntitlementCookie } from "@/lib/entitlement";
import { checkEligibility, isHexAddress } from "@/lib/onchain";
import { limitExpensiveEndpoint } from "@/lib/rate-limit";
import { isResponse, rateLimitedResponse, requireScan } from "@/lib/request-guard";
import { looksLikeSecretMaterial } from "@/lib/secrets-guard";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
  const authed = requireScan(request);
  if (isResponse(authed)) return authed;
  const limited = limitExpensiveEndpoint(request, authed.user.id, "onchain", { email: authed.user.email });
  if (!limited.ok) return rateLimitedResponse(limited);

  const { searchParams } = new URL(request.url);
  const claimId = searchParams.get("claimId");
  const address = searchParams.get("address");
  if (!claimId || !address) {
    return NextResponse.json({ error: "claimId and address are required" }, { status: 400 });
  }
  if (looksLikeSecretMaterial(address) || !isHexAddress(address)) {
    return NextResponse.json({ error: "address must be a 0x-prefixed 20-byte hex string" }, { status: 400 });
  }

  const checksum = getAddress(address);
  const gated = gateWallet({ plan: authed.user.plan, wallets: authed.user.wallets }, checksum, authed.user.email);
  if (!gated.ok) {
    return NextResponse.json(gated.body, { status: gated.status });
  }
  // Do not bind scanned addresses onto the account record. Desktop keeps wallets locally.

  const res = await guardedJson(
    request,
    "eligibility",
    "light",
    () => checkEligibility(claimId, checksum),
    `eligibility:${authed.user.id}:${claimId}:${checksum.toLowerCase()}`,
  );
  return withEntitlementCookie(res, gated.entitlement);
}
