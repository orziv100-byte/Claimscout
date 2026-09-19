import { guardedJson } from "@/lib/api-guard";
import {
  activatePaidLicense,
  entitlementFromRequest,
  publicEntitlement,
  withEntitlementCookie,
} from "@/lib/entitlement";
import { PLANS, bindWallet } from "@/lib/plan";
import { isHexAddress } from "@/lib/address";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ent = entitlementFromRequest(request);
  return withEntitlementCookie(NextResponse.json(publicEntitlement(ent)), ent);
}

export async function POST(request: Request) {
  const ent = entitlementFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { license?: string; address?: string };

  if (typeof body.license === "string") {
    const activated = activatePaidLicense(ent, body.license);
    if (!activated.ok) {
      return NextResponse.json(
        { error: "That Scout+ key is not valid.", code: "INVALID_LICENSE" },
        { status: 403 },
      );
    }
    return withEntitlementCookie(
      NextResponse.json({ ...publicEntitlement(activated.entitlement), activated: true }),
      activated.entitlement,
    );
  }

  if (typeof body.address === "string") {
    if (!isHexAddress(body.address)) {
      return NextResponse.json({ error: "address must be a 0x-prefixed 20-byte hex string" }, { status: 400 });
    }
    const checksum = getAddress(body.address);
    const max = PLANS[ent.plan].maxWallets;
    const bound = bindWallet(ent.wallets, max, checksum);
    if (!bound.ok) {
      return NextResponse.json(
        {
          error:
            ent.plan === "free"
              ? "Free checks one wallet. Scout+ ($40) unlocks up to five."
              : "Scout+ includes up to five wallets.",
          code: bound.code,
          upgradeUrl: "/upgrade",
          maxWallets: max,
          wallets: bound.wallets,
        },
        { status: 402 },
      );
    }
    const next = { ...ent, wallets: bound.wallets };
    return withEntitlementCookie(NextResponse.json({ ...publicEntitlement(next), added: bound.added }), next);
  }

  return guardedJson(request, "plan-read", "light", async () => publicEntitlement(ent), "plan:read");
}
