import { stageCap } from "./app-info.ts";
import { mutateBetaState, readBetaState, readOutbox, recordSecurity, withBetaLock } from "./beta-store.ts";
import type {
  InviteRecord,
  PublicUser,
  SessionRecord,
  TokenRecord,
  UserRecord,
} from "./beta-types.ts";
import { ACCOUNT_STATUSES, USER_ROLES } from "./beta-types.ts";
import { adminEmails } from "./env.ts";
import { PRIVACY_VERSION, TERMS_VERSION } from "./legal.ts";
import { absoluteMailUrl, sendMail } from "./mail.ts";
import { hashPassword, newId, sha256Base64Url, verifyPassword } from "./password.ts";
import { SecretMaterialError, assertNoSecretMaterial } from "./secrets-guard.ts";
import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  cookieValue,
  parseSessionCookie,
  serializeSession,
} from "./session-cookie.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_RE = /^[\p{L}\p{N} .'_-]{2,40}$/u;
const DEV_INVITE = "closed-beta-dev";

/** Strip copy/paste artifacts so chat/markdown hyphens still match a stored invite. */
export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/^`+|`+$/g, "")
    .replace(/\s+/g, "");
}

function findUsableInvite(state: ReturnType<typeof readBetaState>, raw: string) {
  const needle = normalizeInviteCode(raw).toLowerCase();
  if (!needle) return null;
  return (
    state.invites.find((row) => normalizeInviteCode(row.code).toLowerCase() === needle && !row.disabled) ?? null
  );
}

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function rejectSecrets(value: string, field: string) {
  try {
    assertNoSecretMaterial(value, field);
  } catch (err) {
    if (err instanceof SecretMaterialError) throw new AuthError(400, err.code, err.message);
    throw err;
  }
}

export function publicUser(user: UserRecord): PublicUser {
  const {
    passwordHash: _passwordHash,
    totpSecret: _totpSecret,
    totpRecoveryHashes: _totpRecoveryHashes,
    totpLastStep: _totpLastStep,
    googleSub: _googleSub,
    ...rest
  } = user;
  return { ...rest, googleLinked: Boolean(_googleSub) };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Gmail dots and googlemail.com are the same mailbox. Other domains stay exact. */
export function canonicalizeEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain !== "gmail.com" && domain !== "googlemail.com") return normalized;
  const plus = local.split("+")[0] ?? "";
  return `${plus.replaceAll(".", "")}@gmail.com`;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyScanCounts() {
  return { started: 0, completed: 0, failed: 0 };
}

function ensureDevInvite(state: ReturnType<typeof readBetaState>) {
  if (process.env.NODE_ENV !== "production") {
    if (!state.invites.some((invite) => invite.code === DEV_INVITE)) {
      state.invites.push({
        id: newId(),
        code: DEV_INVITE,
        email: null,
        stage: 1,
        maxUses: 100,
        usedBy: [],
        disabled: false,
        note: "Local/dev Closed Beta invite",
        createdAt: nowIso(),
        createdBy: "system",
      });
    }
  }
  const bootstrap = process.env.POOLINDEX_BOOTSTRAP_INVITE?.trim();
  if (!bootstrap) return;
  if (state.invites.some((invite) => invite.code === bootstrap)) return;
  state.invites.push({
    id: newId(),
    code: bootstrap,
    email: adminEmails()[0] ?? null,
    stage: 1,
    maxUses: 1,
    usedBy: [],
    disabled: false,
    note: "Bootstrap operator invite",
    createdAt: nowIso(),
    createdBy: "system",
  });
}

function findUserByEmail(state: ReturnType<typeof readBetaState>, email: string) {
  const needle = canonicalizeEmail(email);
  if (!needle || !needle.includes("@")) return null;
  return state.users.find((user) => canonicalizeEmail(user.email) === needle) ?? null;
}

function normalizeDisplayName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function findUserByDisplayName(state: ReturnType<typeof readBetaState>, name: string) {
  const needle = normalizeDisplayName(name);
  if (!needle) return null;
  const matches = state.users.filter((user) => normalizeDisplayName(user.displayName) === needle);
  return matches.length === 1 ? matches[0] : null;
}

function findUserByLogin(state: ReturnType<typeof readBetaState>, identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  if (raw.includes("@")) return findUserByEmail(state, raw);
  return findUserByDisplayName(state, raw);
}

function isAdminEmail(email: string) {
  return adminEmails().includes(normalizeEmail(email));
}

/** Align role with POOLINDEX_ADMIN_EMAILS. Never rewrite the registered email. TOTP fields are not touched. */
function syncAdminRole(user: UserRecord): boolean {
  const registeredEmail = user.email;
  const shouldBeAdmin = isAdminEmail(user.email);
  const nextRole: UserRecord["role"] = shouldBeAdmin ? "admin" : "user";
  if (user.email !== registeredEmail) {
    throw new Error("syncAdminRole must not change email");
  }
  if (user.role === nextRole) return false;
  user.role = nextRole;
  return true;
}

function liveUserCount(state: ReturnType<typeof readBetaState>) {
  return state.users.filter((user) => user.status !== "disabled").length;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  inviteCode: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}): Promise<{ user: PublicUser; verifyUrl: string }> {
  return withBetaLock(async () => {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim();
    const inviteCode = normalizeInviteCode(input.inviteCode);
    if (!EMAIL_RE.test(email)) throw new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
    if (!DISPLAY_RE.test(displayName)) {
      throw new AuthError(400, "INVALID_NAME", "Display name must be 2–40 letters, numbers, or simple punctuation.");
    }
    if (input.password.length < 10 || input.password.length > 200) {
      throw new AuthError(400, "INVALID_PASSWORD", "Password must be 10–200 characters.");
    }
    rejectSecrets(input.password, "password");
    rejectSecrets(displayName, "display name");
    if (!input.acceptTerms || !input.acceptPrivacy) {
      throw new AuthError(400, "TERMS_REQUIRED", "You must accept the Terms of Use and Privacy Notice.");
    }
    if (!inviteCode) throw new AuthError(403, "INVITE_REQUIRED", "A valid Closed Beta invitation is required.");

    const passwordHash = await hashPassword(input.password);

    const created = mutateBetaState((state) => {
      ensureDevInvite(state);
      if (findUserByEmail(state, email)) {
        throw new AuthError(409, "EMAIL_EXISTS", "An account with that email already exists.");
      }
      if (findUserByDisplayName(state, displayName)) {
        throw new AuthError(409, "NAME_EXISTS", "That username is already taken.");
      }
      const invite = findUsableInvite(state, inviteCode);
      if (!invite) throw new AuthError(403, "INVALID_INVITE", "That invitation code is not valid.");
      if (invite.email && invite.email !== email) {
        throw new AuthError(403, "INVITE_EMAIL_MISMATCH", "That invitation is assigned to a different email.");
      }
      if (invite.usedBy.length >= invite.maxUses) {
        throw new AuthError(403, "INVITE_USED", "That invitation has already been used.");
      }
      const cap = stageCap(state.ops.betaStage);
      if (liveUserCount(state) >= cap) {
        throw new AuthError(403, "BETA_CAP", `Stage ${state.ops.betaStage} is full (${cap} users).`);
      }

      const user: UserRecord = {
        id: newId(),
        email,
        displayName,
        passwordHash,
        status: "pending_verification",
        role: isAdminEmail(email) ? "admin" : "user",
        plan: "free",
        wallets: [],
        inviteCode: invite.code,
        emailVerifiedAt: null,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: nowIso(),
        createdAt: nowIso(),
        lastLoginAt: null,
        lastScanAt: null,
        firstScanAt: null,
        scanCounts: emptyScanCounts(),
        deletionRequestedAt: null,
        deletionStatus: "none",
      };
      state.users.push(user);
      invite.usedBy.push(user.id);

      const raw = newId(24);
      const token: TokenRecord = {
        id: newId(),
        type: "verify_email",
        userId: user.id,
        hash: sha256Base64Url(raw),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null,
      };
      state.tokens.push(token);
      const verifyUrl = `/verify?token=${encodeURIComponent(raw)}`;
      recordSecurity({ type: "register", userId: user.id, email: user.email, detail: `pwlen=${input.password.length}` });
      return { user: publicUser(user), verifyUrl, email: user.email };
    });
    const verifyLink = absoluteMailUrl(created.verifyUrl);
    await sendMail({
      to: created.email,
      subject: "Verify your PoolIndex Beta account",
      text: `Welcome to PoolIndex Closed Beta.\n\nVerify your email (link expires in 24 hours):\n${verifyLink}\n\nIf you did not create this account, you can ignore this message.`,
      url: verifyLink,
      purpose: "verify_email",
    });
    return { user: created.user, verifyUrl: created.verifyUrl };
  });
}

function issueSession(state: ReturnType<typeof readBetaState>, user: UserRecord): { session: SessionRecord; cookie: string } {
  const session: SessionRecord = {
    id: newId(),
    userId: user.id,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString(),
    revokedAt: null,
  };
  state.sessions.push(session);
  const cookie = serializeSession({
    uid: user.id,
    sid: session.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.parse(session.expiresAt) / 1000),
  });
  return { session, cookie };
}

export async function loginAccount(input: {
  email: string;
  password: string;
  ip?: string;
}): Promise<{ user: PublicUser; cookie: string; session: SessionRecord }> {
  return withBetaLock(async () => {
    const identifier = input.email.trim();
    const state = readBetaState();
    const user = findUserByLogin(state, identifier);
    const email = user?.email || (identifier.includes("@") ? normalizeEmail(identifier) : "");
    if (user && !user.passwordHash) {
      recordSecurity({ type: "login_failure", email, ip: input.ip, detail: "google_only" });
      throw new AuthError(401, "GOOGLE_ONLY", "This account uses Google Sign-In. Use Continue with Google.");
    }
    if (!input.password) {
      recordSecurity({
        type: "login_failure",
        email,
        ip: input.ip,
        userId: user?.id,
        detail: `empty_password:hash=${user?.passwordHash ? 1 : 0}`,
      });
      throw new AuthError(400, "PASSWORD_REQUIRED", "Enter your password.");
    }
    const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !passwordOk) {
      recordSecurity({
        type: "login_failure",
        email,
        ip: input.ip,
        userId: user?.id,
        detail: user ? `bad_password:len=${input.password.length}:hash=1` : `unknown_account:len=${input.password.length}`,
      });
      throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    if (user.status === "disabled" || user.status === "suspended") {
      recordSecurity({ type: "login_blocked", userId: user.id, email, ip: input.ip, detail: user.status });
      throw new AuthError(403, "ACCOUNT_DISABLED", "This account is not allowed to sign in.");
    }

    return mutateBetaState((next) => {
      const live = next.users.find((row) => row.id === user.id);
      if (!live) throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      if (syncAdminRole(live)) recordSecurity({ type: "admin_role_synced", userId: live.id });
      live.lastLoginAt = nowIso();
      const issued = issueSession(next, live);
      recordSecurity({ type: "login_success", userId: live.id, email: live.email, ip: input.ip });
      return { user: publicUser(live), cookie: issued.cookie, session: issued.session };
    });
  });
}

export type GoogleAuthInput = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  intent: "login" | "register";
  inviteCode: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  ip?: string;
  desktop?: boolean;
  challengeHash?: string;
};

function displayFromGoogle(name: string, email: string): string {
  const trimmed = name.trim().slice(0, 40);
  if (DISPLAY_RE.test(trimmed)) return trimmed;
  const local = email.split("@")[0].replace(/[^\p{L}\p{N} ._'-]/gu, " ").trim().slice(0, 40);
  if (DISPLAY_RE.test(local)) return local;
  return "Google user";
}

function consumeInviteForNewUser(
  state: ReturnType<typeof readBetaState>,
  email: string,
  inviteCode: string,
): string {
  ensureDevInvite(state);
  if (!inviteCode) throw new AuthError(403, "INVITE_REQUIRED", "A valid Closed Beta invitation is required.");
  const invite = findUsableInvite(state, inviteCode);
  if (!invite) throw new AuthError(403, "INVALID_INVITE", "That invitation code is not valid.");
  if (invite.email && invite.email !== email) {
    throw new AuthError(403, "INVITE_EMAIL_MISMATCH", "That invitation is assigned to a different email.");
  }
  if (invite.usedBy.length >= invite.maxUses) {
    throw new AuthError(403, "INVITE_USED", "That invitation has already been used.");
  }
  const cap = stageCap(state.ops.betaStage);
  if (liveUserCount(state) >= cap) {
    throw new AuthError(403, "BETA_CAP", `Stage ${state.ops.betaStage} is full (${cap} users).`);
  }
  return invite.code;
}

export async function completeGoogleAuth(input: GoogleAuthInput): Promise<{
  user: PublicUser;
  cookie: string;
  desktopTicket?: string;
}> {
  if (!input.emailVerified) {
    throw new AuthError(403, "GOOGLE_EMAIL_UNVERIFIED", "Google did not verify that email address.");
  }
  const email = normalizeEmail(input.email);
  const sub = input.sub.trim();
  if (!sub || !EMAIL_RE.test(email)) {
    throw new AuthError(400, "GOOGLE_PROFILE_INVALID", "Google did not return a usable account.");
  }

  return withBetaLock(async () => {
    return mutateBetaState((state) => {
      const bySub = state.users.find((row) => row.googleSub === sub) ?? null;
      const byEmail = findUserByEmail(state, email);
      let live = bySub;

      if (bySub && byEmail && bySub.id !== byEmail.id) {
        throw new AuthError(409, "GOOGLE_ACCOUNT_CONFLICT", "That Google account cannot be linked.");
      }
      if (bySub && bySub.email !== email) {
        throw new AuthError(409, "GOOGLE_ACCOUNT_CONFLICT", "That Google account cannot be linked.");
      }

      if (!live && byEmail) {
        if (byEmail.googleSub && byEmail.googleSub !== sub) {
          throw new AuthError(409, "GOOGLE_ACCOUNT_CONFLICT", "That email is already linked to a different Google account.");
        }
        if (!byEmail.googleSub) {
          if (!byEmail.emailVerifiedAt) {
            throw new AuthError(
              403,
              "LINK_REQUIRES_VERIFIED_EMAIL",
              "Verify this PoolIndex email first, then use Continue with Google to link.",
            );
          }
          byEmail.googleSub = sub;
          recordSecurity({ type: "google_linked", userId: byEmail.id, email: byEmail.email });
        }
        live = byEmail;
      }

      if (!live) {
        if (input.intent !== "register") {
          throw new AuthError(403, "GOOGLE_ACCOUNT_NOT_FOUND", "No PoolIndex account for that Google email. Register with an invitation first.");
        }
        if (!input.acceptTerms || !input.acceptPrivacy) {
          throw new AuthError(400, "TERMS_REQUIRED", "You must accept the Terms of Use and Privacy Notice.");
        }
        const inviteCode = consumeInviteForNewUser(state, email, input.inviteCode);
        const invite = state.invites.find((row) => row.code === inviteCode);
        const user: UserRecord = {
          id: newId(),
          email,
          displayName: displayFromGoogle(input.name, email),
          passwordHash: "",
          status: "active",
          role: isAdminEmail(email) ? "admin" : "user",
          plan: "free",
          wallets: [],
          inviteCode,
          emailVerifiedAt: nowIso(),
          googleSub: sub,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          acceptedAt: nowIso(),
          createdAt: nowIso(),
          lastLoginAt: null,
          lastScanAt: null,
          firstScanAt: null,
          scanCounts: emptyScanCounts(),
          deletionRequestedAt: null,
          deletionStatus: "none",
        };
        state.users.push(user);
        invite?.usedBy.push(user.id);
        recordSecurity({ type: "register", userId: user.id, email: user.email, detail: "google" });
        live = user;
      }

      if (live.status === "disabled" || live.status === "suspended") {
        recordSecurity({ type: "login_blocked", userId: live.id, email: live.email, ip: input.ip, detail: live.status });
        throw new AuthError(403, "ACCOUNT_DISABLED", "This account is not allowed to sign in.");
      }
      if (syncAdminRole(live)) recordSecurity({ type: "admin_role_synced", userId: live.id });
      live.lastLoginAt = nowIso();
      if (live.status === "pending_verification" && live.googleSub === sub) {
        live.status = "active";
        live.emailVerifiedAt = live.emailVerifiedAt || nowIso();
      }
      const issued = issueSession(state, live);
      recordSecurity({ type: "login_success", userId: live.id, email: live.email, ip: input.ip, detail: "google" });

      let desktopTicket: string | undefined;
      if (input.desktop) {
        desktopTicket = newId(24);
        const material = `${desktopTicket}.${input.challengeHash || ""}`;
        state.tokens.push({
          id: newId(),
          type: "google_desktop",
          userId: live.id,
          hash: sha256Base64Url(material),
          expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
          usedAt: null,
        });
      }
      return { user: publicUser(live), cookie: issued.cookie, desktopTicket };
    });
  });
}

export function redeemGoogleDesktopTicket(ticket: string, challenge: string): { cookie: string; user: PublicUser } {
  const material = `${ticket}.${sha256Base64Url(challenge)}`;
  const hash = sha256Base64Url(material);
  return mutateBetaState((state) => {
    const token = state.tokens.find((row) => row.type === "google_desktop" && row.hash === hash);
    if (!token) throw new AuthError(401, "INVALID_TOKEN", "That desktop sign-in ticket is not valid.");
    if (token.usedAt) throw new AuthError(400, "TOKEN_USED", "That desktop sign-in ticket was already used.");
    if (Date.parse(token.expiresAt) <= Date.now()) throw new AuthError(400, "TOKEN_EXPIRED", "That desktop sign-in ticket has expired.");
    const live = state.users.find((row) => row.id === token.userId);
    if (!live) throw new AuthError(401, "INVALID_TOKEN", "That desktop sign-in ticket is not valid.");
    token.usedAt = nowIso();
    const issued = issueSession(state, live);
    return { cookie: issued.cookie, user: publicUser(live) };
  });
}

export function logoutSession(request: Request): void {
  const claims = parseSessionCookie(cookieValue(request, SESSION_COOKIE));
  if (!claims) return;
  mutateBetaState((state) => {
    const session = state.sessions.find((row) => row.id === claims.sid);
    if (session && !session.revokedAt) session.revokedAt = nowIso();
  });
  recordSecurity({ type: "logout", userId: claims.uid });
}

export function verifyEmailToken(rawToken: string): PublicUser {
  const hash = sha256Base64Url(rawToken.trim());
  return mutateBetaState((state) => {
    const token = state.tokens.find((row) => row.type === "verify_email" && row.hash === hash);
    if (!token) throw new AuthError(400, "INVALID_TOKEN", "That verification link is not valid.");
    if (token.usedAt) throw new AuthError(400, "TOKEN_USED", "That verification link was already used.");
    if (Date.parse(token.expiresAt) <= Date.now()) throw new AuthError(400, "TOKEN_EXPIRED", "That verification link has expired.");
    const user = state.users.find((row) => row.id === token.userId);
    if (!user) throw new AuthError(400, "INVALID_TOKEN", "That verification link is not valid.");
    token.usedAt = nowIso();
    user.emailVerifiedAt = nowIso();
    if (user.status === "pending_verification") user.status = "active";
    recordSecurity({ type: "email_verified", userId: user.id, email: user.email });
    return publicUser(user);
  });
}

export async function requestPasswordReset(emailRaw: string): Promise<{ sent: true; resetUrl?: string }> {
  const email = normalizeEmail(emailRaw);
  if (!EMAIL_RE.test(email)) return { sent: true };
  return withBetaLock(async () => {
    const state = readBetaState();
    const user = findUserByEmail(state, email);
    if (!user || user.status === "disabled") return { sent: true as const };
    const raw = newId(24);
    mutateBetaState((next) => {
      const stamp = nowIso();
      for (const token of next.tokens) {
        if (token.type === "reset_password" && token.userId === user.id && !token.usedAt) {
          token.usedAt = stamp;
        }
      }
      next.tokens.push({
        id: newId(),
        type: "reset_password",
        userId: user.id,
        hash: sha256Base64Url(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        usedAt: null,
      });
    });
    const resetUrl = `/reset?token=${encodeURIComponent(raw)}`;
    const resetLink = absoluteMailUrl(resetUrl);
    await sendMail({
      to: user.email,
      subject: "Reset your PoolIndex password",
      text: `Reset your PoolIndex password (link expires in 1 hour):\n${resetLink}\n\nIf you did not request this, you can ignore this message.`,
      url: resetLink,
      purpose: "reset_password",
    });
    recordSecurity({ type: "password_reset_requested", userId: user.id, email: user.email });
    const reveal = process.env.NODE_ENV !== "production" || process.env.POOLINDEX_REVEAL_MAIL === "1";
    return reveal ? { sent: true as const, resetUrl } : { sent: true as const };
  });
}

export async function resetPassword(rawToken: string, password: string): Promise<{ user: PublicUser; cookie: string }> {
  if (password.length < 10 || password.length > 200) {
    throw new AuthError(400, "INVALID_PASSWORD", "Password must be 10–200 characters.");
  }
  rejectSecrets(password, "password");
  const hash = sha256Base64Url(rawToken.trim());
  const passwordHash = await hashPassword(password);
  return mutateBetaState((state) => {
    const token = state.tokens.find((row) => row.type === "reset_password" && row.hash === hash);
    if (!token) throw new AuthError(400, "INVALID_TOKEN", "That reset link is not valid.");
    if (token.usedAt) throw new AuthError(400, "TOKEN_USED", "That reset link was already used.");
    if (Date.parse(token.expiresAt) <= Date.now()) throw new AuthError(400, "TOKEN_EXPIRED", "That reset link has expired.");
    const user = state.users.find((row) => row.id === token.userId);
    if (!user) throw new AuthError(400, "INVALID_TOKEN", "That reset link is not valid.");
    token.usedAt = nowIso();
    user.passwordHash = passwordHash;
    for (const session of state.sessions) {
      if (session.userId === user.id && !session.revokedAt) session.revokedAt = nowIso();
    }
    const issued = issueSession(state, user);
    user.lastLoginAt = nowIso();
    recordSecurity({ type: "password_reset", userId: user.id, email: user.email });
    return { user: publicUser(user), cookie: issued.cookie };
  });
}

export function readSessionUser(request: Request): { user: UserRecord; session: SessionRecord } | null {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)/i)?.[1];
  const claims = parseSessionCookie(cookieValue(request, SESSION_COOKIE)) ?? parseSessionCookie(bearer);
  if (!claims) return null;
  const state = readBetaState();
  const session = state.sessions.find((row) => row.id === claims.sid && row.userId === claims.uid) ?? null;
  if (!session || session.revokedAt) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) return null;
  const user = state.users.find((row) => row.id === claims.uid) ?? null;
  if (!user) return null;
  const shouldBeAdmin = isAdminEmail(user.email);
  const outOfSync = shouldBeAdmin ? user.role !== "admin" : user.role === "admin";
  if (outOfSync) {
    const aligned = mutateBetaState((next) => {
      const live = next.users.find((row) => row.id === user.id) ?? null;
      if (live && syncAdminRole(live)) recordSecurity({ type: "admin_role_synced", userId: live.id });
      return live;
    });
    if (aligned) return { user: aligned, session };
  }
  return { user, session };
}

export function getUserById(id: string): UserRecord | null {
  return readBetaState().users.find((user) => user.id === id) ?? null;
}

export function listUsers(): PublicUser[] {
  return readBetaState().users.map(publicUser);
}

export function createInvite(input: {
  createdBy: string;
  email?: string;
  stage?: 1 | 2 | 3;
  maxUses?: number;
  note?: string;
  code?: string;
}): InviteRecord {
  return mutateBetaState((state) => {
    const invite: InviteRecord = {
      id: newId(),
      code: normalizeInviteCode(input.code?.trim() || `cs-${newId(6)}`),
      email: input.email ? normalizeEmail(input.email) : null,
      stage: input.stage ?? state.ops.betaStage,
      maxUses: input.maxUses && input.maxUses > 0 ? input.maxUses : 1,
      usedBy: [],
      disabled: false,
      note: input.note?.trim() ?? "",
      createdAt: nowIso(),
      createdBy: input.createdBy,
    };
    if (state.invites.some((row) => normalizeInviteCode(row.code).toLowerCase() === invite.code.toLowerCase())) {
      throw new AuthError(409, "INVITE_EXISTS", "That invitation code already exists.");
    }
    state.invites.push(invite);
    recordSecurity({ type: "invite_created", userId: input.createdBy, detail: invite.code });
    return invite;
  });
}

export function listInvites(): InviteRecord[] {
  return mutateBetaState((state) => {
    ensureDevInvite(state);
    return [...state.invites];
  });
}

export function revokeUserSessions(userId: string, actorId: string): number {
  return mutateBetaState((state) => {
    let revoked = 0;
    const stamp = nowIso();
    for (const session of state.sessions) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = stamp;
        revoked += 1;
      }
    }
    recordSecurity({ type: "sessions_revoked", userId: actorId, detail: `${userId}:${revoked}` });
    return revoked;
  });
}

export function updateUser(
  id: string,
  patch: Partial<Pick<UserRecord, "status" | "role" | "plan" | "wallets" | "displayName">> & {
    scanCounts?: UserRecord["scanCounts"];
    lastScanAt?: string | null;
    firstScanAt?: string | null;
  },
  actorId?: string,
): PublicUser {
  return mutateBetaState((state) => {
    const user = state.users.find((row) => row.id === id);
    if (!user) throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
    if (patch.status !== undefined) {
      if (!(ACCOUNT_STATUSES as readonly string[]).includes(patch.status)) {
        throw new AuthError(400, "INVALID_STATUS", "Unknown account status.");
      }
      user.status = patch.status;
      if (patch.status === "disabled" || patch.status === "suspended") {
        for (const session of state.sessions) {
          if (session.userId === user.id && !session.revokedAt) session.revokedAt = nowIso();
        }
      }
    }
    if (patch.role !== undefined) {
      if (!(USER_ROLES as readonly string[]).includes(patch.role)) {
        throw new AuthError(400, "INVALID_ROLE", "Unknown role.");
      }
      user.role = patch.role;
    }
    if (patch.plan !== undefined) {
      if (patch.plan !== "free" && patch.plan !== "paid") {
        throw new AuthError(400, "INVALID_PLAN", "Unknown plan.");
      }
      user.plan = patch.plan;
    }
    if (patch.wallets) user.wallets = patch.wallets;
    if (patch.displayName) user.displayName = patch.displayName;
    if (patch.scanCounts) user.scanCounts = patch.scanCounts;
    if (patch.lastScanAt !== undefined) user.lastScanAt = patch.lastScanAt;
    if (patch.firstScanAt !== undefined) user.firstScanAt = patch.firstScanAt;
    recordSecurity({
      type: "user_updated",
      userId: actorId,
      detail: `${id}:${Object.keys(patch).join(",")}`,
    });
    return publicUser(user);
  });
}

export function lastMailTo(email: string) {
  const rows = readOutbox(200);
  return [...rows].reverse().find((row) => row.to === normalizeEmail(email)) ?? null;
}

export { DEV_INVITE, SESSION_COOKIE };
