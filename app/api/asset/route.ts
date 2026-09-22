import { guardedJson } from "@/lib/api-guard";
import { parsePublicAddress } from "@/lib/address";
import { buildAssetBrief } from "@/lib/engine/asset-brief";
import { gateWallet, withEntitlementCookie } from "@/lib/entitlement";
import { limitExpensiveEndpoint } from "@/lib/rate-limit";
import { isResponse, rateLimitedResponse, requireScan } from "@/lib/request-guard";
import { looksLikeSecretMaterial } from "@/lib/secrets-guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  const authed = requireScan(request);
  if (isResponse(authed)) return authed;
  const limited = limitExpensiveEndpoint(request, authed.user.id, "verify", { email: authed.user.email });
  if (!limited.ok) return rateLimitedResponse(limited);

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") ?? "";
  const sourceId = searchParams.get("source") ?? "";
  if (looksLikeSecretMaterial(address) || looksLikeSecretMaterial(sourceId)) {
    return NextResponse.json(
      { error: "Enter a public 0x address and an engine source id.", code: "SECRET_MATERIAL_REJECTED" },
      { status: 400 },
    );
  }
  const parsed = parsePublicAddress(address);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, code: "INVALID_ADDRESS" }, { status: 400 });
  }
  if (!/^[a-z0-9-]{3,80}$/i.test(sourceId)) {
    return NextResponse.json({ error: "Unknown source id.", code: "INVALID_SOURCE" }, { status: 400 });
  }

  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  const gated = gateWallet(ent, parsed.address, authed.user.email);
  if (!gated.ok) {
    return NextResponse.json(gated.body, { status: gated.status });
  }

  const res = await guardedJson(
    request,
    "asset-brief",
    "light",
    () => buildAssetBrief(parsed.address, sourceId),
    `asset:${authed.user.id}:${parsed.address.toLowerCase()}:${sourceId}`,
  );
  if (!res.ok) return withEntitlementCookie(res, gated.entitlement);
  const body = (await res.json()) as { error?: string };
  if (body.error) {
    return withEntitlementCookie(NextResponse.json(body, { status: 404 }), gated.entitlement);
  }
  return withEntitlementCookie(NextResponse.json(body), gated.entitlement);
}
