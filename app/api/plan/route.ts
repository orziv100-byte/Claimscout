import { guardedJson } from "@/lib/api-guard";
import { updateUser } from "@/lib/auth";
import {
  activatePaidLicense,
  publicEntitlement,
  withEntitlementCookie,
} from "@/lib/entitlement";
import { PLANS, bindWallet } from "@/lib/plan";
import { isHexAddress } from "@/lib/address";
import { looksLikeSecretMaterial } from "@/lib/secrets-guard";
import { getAddress } from "viem";
import { NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  return withEntitlementCookie(NextResponse.json(publicEntitlement(ent)), ent);
}

export async function POST(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  const body = (await request.json().catch(() => ({}))) as { license?: string; address?: string };

  if (typeof body.license === "string") {
    const activated = activatePaidLicense(ent, body.license);
    if (!activated.ok) {
      return NextResponse.json(
        { error: "That PoolIndex Pro key is not valid.", code: "INVALID_LICENSE" },
        { status: 403 },
      );
    }
    const user = updateUser(authed.user.id, { plan: "paid", wallets: activated.entitlement.wallets }, authed.user.id);
    const next = { plan: user.plan, wallets: user.wallets };
    return withEntitlementCookie(
      NextResponse.json({ ...publicEntitlement(next), activated: true }),
      next,
    );
  }

  if (typeof body.address === "string") {
    if (looksLikeSecretMaterial(body.address) || !isHexAddress(body.address)) {
      return NextResponse.json(
        { error: "Enter a public 0x address. Seed phrases and private keys are rejected.", code: "SECRET_MATERIAL_REJECTED" },
        { status: 400 },
      );
    }
    const checksum = getAddress(body.address);
    const max = PLANS[ent.plan].maxWallets;
    const bound = bindWallet(ent.wallets, max, checksum);
    if (!bound.ok) {
      return NextResponse.json(
        {
          error:
            ent.plan === "free"
              ? "Free checks one wallet. PoolIndex Pro is planned ($40; payment processing unavailable) and unlocks up to five."
              : "PoolIndex Pro includes up to five wallets.",
          code: bound.code,
          upgradeUrl: "/upgrade",
          maxWallets: max,
          wallets: bound.wallets,
        },
        { status: 402 },
      );
    }
    const user = updateUser(authed.user.id, { wallets: bound.wallets }, authed.user.id);
    const next = { plan: user.plan, wallets: user.wallets };
    return withEntitlementCookie(NextResponse.json({ ...publicEntitlement(next), added: bound.added }), next);
  }

  return guardedJson(request, "plan-read", "light", async () => publicEntitlement(ent), `plan:${authed.user.id}`);
}
