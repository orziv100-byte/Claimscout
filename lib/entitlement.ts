import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PLANS, bindWallet, type PlanId } from "./plan";

export const ENTITLEMENT_COOKIE = "poolindex_entitlement";

export type Entitlement = {
  plan: PlanId;
  wallets: string[];
};

export type PublicEntitlement = Entitlement & {
  name: string;
  priceUsd: number;
  maxWallets: number;
  sources: readonly string[];
  reservedSources: readonly string[];
};

function planSecret(): string {
  return process.env.POOLINDEX_PLAN_SECRET || "dev-only-poolindex-plan-secret";
}

function paidKeys(): string[] {
  const fromEnv = (process.env.POOLINDEX_PAID_KEYS || "")
    .split(/[,\s]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  if (process.env.NODE_ENV !== "production") return ["poolindex-pro-demo"];
  return [];
}

function sign(payload: string): string {
  return createHmac("sha256", planSecret()).update(payload).digest("base64url");
}

export function serializeEntitlement(ent: Entitlement): string {
  const payload = Buffer.from(JSON.stringify(ent), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseEntitlement(raw: string | undefined): Entitlement {
  const fallback: Entitlement = { plan: "free", wallets: [] };
  if (!raw) return fallback;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return fallback;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fallback;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Entitlement;
    if (parsed.plan !== "free" && parsed.plan !== "paid") return fallback;
    if (!Array.isArray(parsed.wallets)) return fallback;
    return {
      plan: parsed.plan,
      wallets: parsed.wallets.filter((wallet) => typeof wallet === "string"),
    };
  } catch {
    return fallback;
  }
}

export function entitlementFromRequest(request: Request): Entitlement {
  if (process.env.POOLINDEX_PLAN === "paid") {
    const cookie = cookieValue(request, ENTITLEMENT_COOKIE);
    const parsed = parseEntitlement(cookie);
    return { plan: "paid", wallets: parsed.wallets };
  }
  return parseEntitlement(cookieValue(request, ENTITLEMENT_COOKIE));
}

export function publicEntitlement(ent: Entitlement): PublicEntitlement {
  const def = PLANS[ent.plan];
  return {
    ...ent,
    name: def.name,
    priceUsd: def.priceUsd,
    maxWallets: def.maxWallets,
    sources: def.sources,
    reservedSources: ["reddit", "bitcointalk"],
  };
}

export function activatePaidLicense(ent: Entitlement, license: string): { ok: true; entitlement: Entitlement } | { ok: false } {
  const trimmed = license.trim();
  if (!trimmed) return { ok: false };
  const keys = paidKeys();
  if (keys.length === 0) return { ok: false };
  const presented = Buffer.from(trimmed);
  for (const key of keys) {
    const expected = Buffer.from(key);
    if (presented.length === expected.length && timingSafeEqual(presented, expected)) {
      return { ok: true, entitlement: { plan: "paid", wallets: ent.wallets.slice(0, PLANS.paid.maxWallets) } };
    }
  }
  return { ok: false };
}

export function gateWallet(
  ent: Entitlement,
  checksumAddress: string,
): { ok: true; entitlement: Entitlement } | { ok: false; status: 402; body: Record<string, unknown> } {
  const maxWallets = PLANS[ent.plan].maxWallets;
  const bound = bindWallet(ent.wallets, maxWallets, checksumAddress);
  if (!bound.ok) {
    return {
      ok: false,
      status: 402,
      body: {
        error:
          ent.plan === "free"
            ? "Free checks one wallet. PoolIndex Pro is planned ($40; payment processing unavailable) and unlocks up to five."
            : "PoolIndex Pro includes up to five wallets.",
        code: "WALLET_LIMIT",
        upgradeUrl: "/upgrade",
        maxWallets,
        wallets: bound.wallets,
      },
    };
  }
  return { ok: true, entitlement: { ...ent, wallets: bound.wallets } };
}

export function withEntitlementCookie(res: NextResponse, ent: Entitlement): NextResponse {
  res.cookies.set(ENTITLEMENT_COOKIE, serializeEntitlement(ent), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 180 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
