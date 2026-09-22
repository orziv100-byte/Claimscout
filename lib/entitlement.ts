import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DEV_PAID_LICENSE, DEV_PLAN_SECRET, isLocalDevRuntime } from "./env.ts";
import { PLANS, bindWallet, maxWalletsFor, walletLimitMessage, type PlanId } from "./plan";

export const ENTITLEMENT_COOKIE = "poolindex_entitlement";

export type Entitlement = {
  plan: PlanId;
  wallets: string[];
};

export type PublicEntitlement = Entitlement & {
  name: string;
  priceUsd: number;
  yearlyUsd: number;
  maxWallets: number;
  sources: readonly string[];
  reservedSources: readonly string[];
};

function planSecret(): string | null {
  const fromEnv = process.env.POOLINDEX_PLAN_SECRET?.trim() ?? "";
  if (fromEnv && fromEnv !== DEV_PLAN_SECRET) return fromEnv;
  if (isLocalDevRuntime()) return DEV_PLAN_SECRET;
  return null;
}

function paidKeys(): string[] {
  const fromEnv = (process.env.POOLINDEX_PAID_KEYS || "")
    .split(/[,\s]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  if (isLocalDevRuntime()) return [DEV_PAID_LICENSE];
  return [];
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function serializeEntitlement(ent: Entitlement): string {
  const secret = planSecret();
  const safe: Entitlement = secret ? ent : { plan: "free", wallets: ent.wallets.slice(0, PLANS.free.maxWallets) };
  const payload = Buffer.from(JSON.stringify(safe), "utf8").toString("base64url");
  if (!secret) return `${payload}.invalid`;
  return `${payload}.${sign(payload, secret)}`;
}

export function parseEntitlement(raw: string | undefined): Entitlement {
  const fallback: Entitlement = { plan: "free", wallets: [] };
  const secret = planSecret();
  if (!raw || !secret) return fallback;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return fallback;
  const expected = sign(payload, secret);
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

export function publicEntitlement(ent: Entitlement, email?: string | null): PublicEntitlement {
  const def = PLANS[ent.plan];
  return {
    ...ent,
    name: def.name,
    priceUsd: def.priceUsd,
    yearlyUsd: def.yearlyUsd,
    maxWallets: maxWalletsFor(ent.plan, email),
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
  email?: string | null,
): { ok: true; entitlement: Entitlement } | { ok: false; status: 402; body: Record<string, unknown> } {
  const maxWallets = maxWalletsFor(ent.plan, email);
  const bound = bindWallet(ent.wallets, maxWallets, checksumAddress, { replaceAtCap: maxWallets === 1 });
  if (!bound.ok) {
    return {
      ok: false,
      status: 402,
      body: {
        error: walletLimitMessage(ent.plan, email),
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
