import { guardedJson } from "@/lib/api-guard";
import { updateUser } from "@/lib/auth";
import { CATALOG } from "@/lib/catalog";
import { gateWallet, withEntitlementCookie } from "@/lib/entitlement";
import { checkEligibility, isHexAddress, scanCatalogPools } from "@/lib/onchain";
import { limitExpensiveEndpoint } from "@/lib/rate-limit";
import { readResourceSnapshot } from "@/lib/resource-guard";
import { isResponse, rateLimitedResponse, requireScan, requireUser } from "@/lib/request-guard";
import { looksLikeSecretMaterial } from "@/lib/secrets-guard";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const poolsOnly = searchParams.get("pools") === "1";

  if (poolsOnly || !address) {
    const authed = requireUser(request);
    if (isResponse(authed)) return authed;
    const limited = limitExpensiveEndpoint(request, authed.user.id, "onchain");
    if (!limited.ok) return rateLimitedResponse(limited);
    const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
    const res = await guardedJson(
      request,
      "onchain-pools",
      "light",
      async () => ({ pools: await scanCatalogPools() }),
      "onchain:pools",
    );
    return withEntitlementCookie(res, ent);
  }

  const authed = requireScan(request);
  if (isResponse(authed)) return authed;
  const limited = limitExpensiveEndpoint(request, authed.user.id, "onchain");
  if (!limited.ok) return rateLimitedResponse(limited);

  if (looksLikeSecretMaterial(address) || !isHexAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  const gated = gateWallet(ent, getAddress(address));
  if (!gated.ok) {
    return NextResponse.json(gated.body, { status: gated.status });
  }
  if (gated.entitlement.wallets.join(",") !== authed.user.wallets.join(",")) {
    updateUser(authed.user.id, { wallets: gated.entitlement.wallets }, authed.user.id);
  }

  const res = await guardedJson(request, "onchain-eligibility", "heavy", async () => {
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
  }, `onchain:${authed.user.id}:${address.toLowerCase()}`);
  return withEntitlementCookie(res, gated.entitlement);
}
