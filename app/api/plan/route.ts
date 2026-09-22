import { guardedJson } from "@/lib/api-guard";
import { updateUser } from "@/lib/auth";
import {
  activatePaidLicense,
  publicEntitlement,
  withEntitlementCookie,
} from "@/lib/entitlement";
import { bindWallet, isUnlimitedWalletAccount, maxWalletsFor, walletLimitMessage } from "@/lib/plan";
import { parsePublicAddress } from "@/lib/address";
import { looksLikeSecretMaterial } from "@/lib/secrets-guard";
import { NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  return withEntitlementCookie(NextResponse.json(publicEntitlement(ent, authed.user.email)), ent);
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
    const user = updateUser(
      authed.user.id,
      {
        plan: "paid",
        wallets: isUnlimitedWalletAccount(authed.user.email)
          ? ent.wallets
          : activated.entitlement.wallets,
      },
      authed.user.id,
    );
    const next = { plan: user.plan, wallets: user.wallets };
    return withEntitlementCookie(
      NextResponse.json({ ...publicEntitlement(next, user.email), activated: true }),
      next,
    );
  }

  if (typeof body.address === "string") {
    if (looksLikeSecretMaterial(body.address)) {
      return NextResponse.json(
        { error: "Enter a public 0x address. Seed phrases and private keys are rejected.", code: "SECRET_MATERIAL_REJECTED" },
        { status: 400 },
      );
    }
    const parsed = parsePublicAddress(body.address);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, code: "INVALID_ADDRESS" },
        { status: 400 },
      );
    }
    const checksum = parsed.address;
    const max = maxWalletsFor(ent.plan, authed.user.email);
    const bound = bindWallet(ent.wallets, max, checksum, { replaceAtCap: max === 1 });
    if (!bound.ok) {
      return NextResponse.json(
        {
          error: walletLimitMessage(ent.plan, authed.user.email),
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
    return withEntitlementCookie(NextResponse.json({ ...publicEntitlement(next, user.email), added: bound.added }), next);
  }

  return guardedJson(request, "plan-read", "light", async () => publicEntitlement(ent, authed.user.email), `plan:${authed.user.id}`);
}
