import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthError } from "./auth.ts";
import { mutateBetaState } from "./beta-store.ts";
import { sha256Base64Url } from "./password.ts";
import { recordSecurity } from "./beta-store.ts";
import { cookieValue, sessionSecret } from "./session-cookie.ts";
import { generateRecoveryCodes, generateTotpSecret, otpauthUrl, totpCode, verifyTotp } from "./totp.ts";

export const ADMIN_MFA_COOKIE = "poolindex_admin_mfa";
const MFA_TTL_SEC = 12 * 60 * 60;

export function enrollAdminTotp(userId: string): { otpauth: string; enrolled: false } {
  return mutateBetaState((state) => {
    const user = state.users.find((row) => row.id === userId);
    if (!user || user.role !== "admin") throw new AuthError(403, "FORBIDDEN", "Admin access required.");
    if (user.totpEnabled) throw new AuthError(409, "MFA_ALREADY_ENABLED", "Admin MFA is already enabled.");
    user.totpSecret = generateTotpSecret();
    user.totpEnabled = false;
    user.totpRecoveryHashes = [];
    user.totpLastStep = undefined;
    recordSecurity({ type: "admin_mfa_enroll_started", userId: user.id });
    return { otpauth: otpauthUrl(user.email, user.totpSecret), enrolled: false as const };
  });
}

export function confirmAdminTotp(userId: string, code: string): { recoveryCodes: string[]; enabled: true } {
  return mutateBetaState((state) => {
    const user = state.users.find((row) => row.id === userId);
    if (!user || user.role !== "admin") throw new AuthError(403, "FORBIDDEN", "Admin access required.");
    if (!user.totpSecret) throw new AuthError(400, "MFA_NOT_STARTED", "Start MFA enrollment first.");
    const check = verifyTotp(user.totpSecret, code, { lastStep: user.totpLastStep });
    if (!check.ok) {
      throw new AuthError(401, check.reason === "reused" ? "MFA_REUSED" : "MFA_INVALID", "That authenticator code is not valid.");
    }
    const recoveryCodes = generateRecoveryCodes();
    user.totpEnabled = true;
    user.totpLastStep = check.step;
    user.totpRecoveryHashes = recoveryCodes.map((code) => sha256Base64Url(code));
    recordSecurity({ type: "admin_mfa_enabled", userId: user.id });
    return { recoveryCodes, enabled: true as const };
  });
}

export function verifyAdminTotp(userId: string, sid: string, code: string): string {
  return mutateBetaState((state) => {
    const user = state.users.find((row) => row.id === userId);
    if (!user || user.role !== "admin") throw new AuthError(403, "FORBIDDEN", "Admin access required.");
    if (!user.totpEnabled || !user.totpSecret) throw new AuthError(400, "MFA_NOT_ENABLED", "Admin MFA is not enabled.");
    const trimmed = code.trim();
    const totp = verifyTotp(user.totpSecret, trimmed, { lastStep: user.totpLastStep });
    if (totp.ok) {
      user.totpLastStep = totp.step;
      recordSecurity({ type: "admin_mfa_ok", userId: user.id });
      return serializeAdminMfa({ uid: user.id, sid, exp: Math.floor(Date.now() / 1000) + MFA_TTL_SEC });
    }
    const hash = sha256Base64Url(trimmed);
    const idx = user.totpRecoveryHashes?.findIndex((row) => row === hash) ?? -1;
    if (idx >= 0) {
      user.totpRecoveryHashes = (user.totpRecoveryHashes ?? []).filter((_, i) => i !== idx);
      recordSecurity({ type: "admin_mfa_recovery", userId: user.id });
      return serializeAdminMfa({ uid: user.id, sid, exp: Math.floor(Date.now() / 1000) + MFA_TTL_SEC });
    }
    recordSecurity({ type: "admin_mfa_fail", userId: user.id });
    throw new AuthError(401, totp.reason === "reused" ? "MFA_REUSED" : "MFA_INVALID", "That authenticator code is not valid.");
  });
}

export type AdminMfaClaims = { uid: string; sid: string; exp: number };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function serializeAdminMfa(claims: AdminMfaClaims, secret = sessionSecret()): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function parseAdminMfaCookie(raw: string | undefined, secret = sessionSecret(), now = Date.now()): AdminMfaClaims | null {
  if (!raw || !secret) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminMfaClaims;
    if (!claims.uid || !claims.sid || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function adminMfaSatisfied(request: Request, userId: string, sessionId?: string): boolean {
  const claims = parseAdminMfaCookie(cookieValue(request, ADMIN_MFA_COOKIE));
  if (!claims || claims.uid !== userId) return false;
  if (sessionId && claims.sid !== sessionId) return false;
  return true;
}

/** Test helper — never called from HTTP handlers. */
export function totpNowForTests(secret: string, now = Date.now()): string {
  return totpCode(secret, Math.floor(now / 1000 / 30));
}
