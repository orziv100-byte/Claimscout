import { CATALOG } from "@/lib/catalog";
import { checkEligibility, isHexAddress, scanCatalogPools } from "@/lib/onchain";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const poolsOnly = searchParams.get("pools") === "1";

  if (poolsOnly || !address) {
    const pools = await scanCatalogPools();
    return NextResponse.json({ pools });
  }

  if (!isHexAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const checksum = getAddress(address);
  const claims = CATALOG.filter((c) => c.id !== "tornado-avoided");
  const eligibility = [];
  for (const claim of claims) {
    eligibility.push(await checkEligibility(claim.id, checksum));
  }
  return NextResponse.json({ address: checksum, eligibility });
}
