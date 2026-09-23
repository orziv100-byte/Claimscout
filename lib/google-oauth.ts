import { createHash, randomBytes } from "node:crypto";
import { publicOrigin } from "./mail.ts";
import { parseSessionCookie, serializeSession, sessionSecret } from "./session-cookie.ts";
import { websitePostLoginPath } from "./site-surface.ts";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_OAUTH_COOKIE = "poolindex_google_oauth";
export const DESKTOP_PROTOCOL = "poolindex";
export const DESKTOP_CALLBACK_PATH = "oauth/callback";

export type GoogleOAuthIntent = "login" | "register";

export type GoogleOAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  intent: GoogleOAuthIntent;
  inviteCode: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  next: string;
  desktop: boolean;
  challengeHash: string;
  iat: number;
  exp: number;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export function googleClientId(env: NodeJS.ProcessEnv = process.env): string {
  return env.GOOGLE_CLIENT_ID?.trim() || "";
}

function googleClientSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.GOOGLE_CLIENT_SECRET?.trim() || "";
}

export function googleConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(googleClientId(env) && googleClientSecret(env));
}

export function googleRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const origin = publicOrigin(env) || "https://poolindex.app";
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function isAllowedGoogleRedirectUri(uri: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return uri === googleRedirectUri(env);
}

export function sanitizeNextPath(raw: string | null | undefined, desktop = false): string {
  return websitePostLoginPath(raw, desktop);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function newPkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function hashDesktopChallenge(challenge: string): string {
  return createHash("sha256").update(challenge).digest("base64url");
}

export function createOAuthState(input: {
  intent: GoogleOAuthIntent;
  inviteCode?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  next?: string;
  desktop?: boolean;
  desktopChallenge?: string;
}): { cookieValue: string; authorizeUrl: string; state: GoogleOAuthState } {
  if (!googleConfigured()) {
    throw new Error("GOOGLE_NOT_CONFIGURED");
  }
  const pkce = newPkcePair();
  const state: GoogleOAuthState = {
    state: b64url(randomBytes(24)),
    nonce: b64url(randomBytes(24)),
    verifier: pkce.verifier,
    intent: input.intent,
    inviteCode: (input.inviteCode || "").trim(),
    acceptTerms: input.acceptTerms === true,
    acceptPrivacy: input.acceptPrivacy === true,
    next: sanitizeNextPath(input.next, input.desktop === true),
    desktop: input.desktop === true,
    challengeHash: input.desktopChallenge ? hashDesktopChallenge(input.desktopChallenge) : "",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const cookieValue = serializeSession(
    { uid: "google-oauth", sid: JSON.stringify(state), iat: state.iat, exp: state.exp },
    sessionSecret(),
  );
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: state.state,
    nonce: state.nonce,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { cookieValue, authorizeUrl: `${GOOGLE_AUTH_URL}?${params}`, state };
}

export function readSignedOAuthState(raw: string | undefined): GoogleOAuthState | null {
  const claims = parseSessionCookie(raw);
  if (!claims || claims.uid !== "google-oauth") return null;
  try {
    const parsed = JSON.parse(claims.sid) as GoogleOAuthState;
    if (!parsed.state || !parsed.verifier || parsed.exp * 1000 <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function oauthCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
    secure: process.env.NODE_ENV === "production" || process.env.POOLINDEX_SECURE_COOKIES === "1",
  };
}

export async function exchangeGoogleCode(code: string, verifier: string, env: NodeJS.ProcessEnv = process.env): Promise<GoogleProfile> {
  const redirectUri = googleRedirectUri(env);
  if (!isAllowedGoogleRedirectUri(redirectUri, env)) {
    throw new Error("GOOGLE_REDIRECT_DENIED");
  }
  const body = new URLSearchParams({
    code,
    client_id: googleClientId(env),
    client_secret: googleClientSecret(env),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) throw new Error("GOOGLE_TOKEN_FAILED");
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenJson.access_token?.trim();
  if (!accessToken) throw new Error("GOOGLE_TOKEN_FAILED");
  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!infoRes.ok) throw new Error("GOOGLE_USERINFO_FAILED");
  const info = (await infoRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    given_name?: string;
  };
  const sub = info.sub?.trim() || "";
  const email = (info.email || "").trim().toLowerCase();
  const emailVerified = info.email_verified === true || info.email_verified === "true";
  const name = (info.name || info.given_name || "").trim();
  if (!sub || !email) throw new Error("GOOGLE_PROFILE_INVALID");
  return { sub, email, emailVerified, name };
}

export function desktopCallbackUrl(ticket: string): string {
  return `${DESKTOP_PROTOCOL}://${DESKTOP_CALLBACK_PATH}?ticket=${encodeURIComponent(ticket)}`;
}
