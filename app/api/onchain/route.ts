import { guardedJson } from "@/lib/api-guard";
import { CATALOG } from "@/lib/catalog";
import { checkEligibility, isHexAddress, scanCatalogPools } from "@/lib/onchain";
import { readResourceSnapshot } from "@/lib/resource-guard";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const poolsOnly = searchParams.get("pools") === "1";

  if (address && !isHexAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const kind = poolsOnly || !address ? "light" : "heavy";
  const name = poolsOnly || !address ? "onchain-pools" : "onchain-eligibility";
  const coalesceKey = poolsOnly || !address ? "onchain:pools" : `onchain:${address.toLowerCase()}`;

  return guardedJson(request, name, kind, async () => {
    if (poolsOnly || !address) {
      return { pools: await scanCatalogPools() };
    }

    const checksum = getAddress(address);
    const claims = CATALOG.filter((c) => c.id !== "tornado-avoided");
    const eligibility = [];
    for (const claim of claims) {
      const snap = readResourceSnapshot();
      if (snap.level === "critical") {
        eligibility.push({
          claimId: claim.id,
          address: checksum,
          status: "unknown" as const,
          detail: `Eligibility scan stopped to protect this machine: ${snap.message}`,
        });
        break;
      }
      eligibility.push(await checkEligibility(claim.id, checksum));
    }
    return { address: checksum, eligibility };
  }, coalesceKey);
}
