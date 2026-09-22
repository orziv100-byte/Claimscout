import { guardedJson } from "@/lib/api-guard";
import { updateUser } from "@/lib/auth";
import { parsePublicAddress } from "@/lib/address";
import { getWalletScanJob, startWalletScanJob } from "@/lib/engine";
import { gateWallet, withEntitlementCookie } from "@/lib/entitlement";
import { scanCatalogPools } from "@/lib/onchain";
import { limitExpensiveEndpoint, limitOnchainPoll } from "@/lib/rate-limit";
import { isResponse, rateLimitedResponse, requireScan, requireUser } from "@/lib/request-guard";
import { looksLikeSecretMaterial } from "@/lib/secrets-guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const poolsOnly = searchParams.get("pools") === "1";
  const pollOnly = searchParams.get("poll") === "1";

  if (poolsOnly || !address) {
    const authed = requireUser(request);
    if (isResponse(authed)) return authed;
    const limited = limitExpensiveEndpoint(request, authed.user.id, "onchain", { email: authed.user.email });
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

  if (looksLikeSecretMaterial(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  const parsed = parsePublicAddress(address);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  const checksum = parsed.address;

  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  const gated = gateWallet(ent, checksum, authed.user.email);
  if (!gated.ok) {
    return NextResponse.json(gated.body, { status: gated.status });
  }
  if (gated.entitlement.wallets.join(",") !== authed.user.wallets.join(",")) {
    updateUser(authed.user.id, { wallets: gated.entitlement.wallets }, authed.user.id);
  }

  if (pollOnly) {
    const limited = limitOnchainPoll(request, authed.user.id);
    if (!limited.ok) return rateLimitedResponse(limited);
    const job = getWalletScanJob(checksum, authed.user.id);
    if (!job) {
      return withEntitlementCookie(
        NextResponse.json({ address: checksum, status: "idle" }, { status: 200 }),
        gated.entitlement,
      );
    }
    const status = job.status === "running" ? 202 : 200;
    return withEntitlementCookie(NextResponse.json(job, { status }), gated.entitlement);
  }

  const existing = getWalletScanJob(checksum, authed.user.id);
  if (!existing || existing.status !== "running") {
    const limited = limitExpensiveEndpoint(request, authed.user.id, "onchain", { email: authed.user.email });
    if (!limited.ok) return rateLimitedResponse(limited);
  }

  const job = startWalletScanJob(checksum, { userId: authed.user.id });
  const status = job.status === "running" ? 202 : job.status === "failed" ? 503 : 200;
  return withEntitlementCookie(NextResponse.json(job, { status }), gated.entitlement);
}
