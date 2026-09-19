import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "poolindex_session";
export const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

export type SessionClaims = {
  uid: string;
  sid: string;
  iat: number;
  exp: number;
};

export function sessionSecret(): string {
  const fromEnv = process.env.POOLINDEX_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "";
  return "dev-only-poolindex-session-secret";
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function serializeSession(claims: SessionClaims, secret = sessionSecret()): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function parseSessionCookie(raw: string | undefined, secret = sessionSecret(), now = Date.now()): SessionClaims | null {
  if (!raw || !secret) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (!claims.uid || !claims.sid || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
    secure: process.env.NODE_ENV === "production" || process.env.POOLINDEX_SECURE_COOKIES === "1",
  };
}
