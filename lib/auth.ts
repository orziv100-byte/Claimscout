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
import { sendMail } from "./mail.ts";
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
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
  const needle = normalizeEmail(email);
  return state.users.find((user) => user.email === needle) ?? null;
}

function isAdminEmail(email: string) {
  return adminEmails().includes(normalizeEmail(email));
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
    const inviteCode = input.inviteCode.trim();
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
      const invite = state.invites.find((row) => row.code === inviteCode && !row.disabled);
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
      recordSecurity({ type: "register", userId: user.id, email: user.email });
      return { user: publicUser(user), verifyUrl, email: user.email };
    });
    await sendMail({
      to: created.email,
      subject: "Verify your Poolindex Beta account",
      text: `Welcome to Poolindex Closed Beta. Verify your email: ${created.verifyUrl}`,
      url: created.verifyUrl,
      purpose: "verify_email",
    });
    return { user: created.user, verifyUrl: created.verifyUrl };
  });
}

export async function loginAccount(input: {
  email: string;
  password: string;
  ip?: string;
}): Promise<{ user: PublicUser; cookie: string; session: SessionRecord }> {
  return withBetaLock(async () => {
    const email = normalizeEmail(input.email);
    const state = readBetaState();
    const user = findUserByEmail(state, email);
    const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !passwordOk) {
      recordSecurity({ type: "login_failure", email, ip: input.ip, detail: "invalid_credentials" });
      throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    if (user.status === "disabled" || user.status === "suspended") {
      recordSecurity({ type: "login_blocked", userId: user.id, email, ip: input.ip, detail: user.status });
      throw new AuthError(403, "ACCOUNT_DISABLED", "This account is not allowed to sign in.");
    }

    return mutateBetaState((next) => {
      const live = next.users.find((row) => row.id === user.id);
      if (!live) throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      live.lastLoginAt = nowIso();
      const session: SessionRecord = {
        id: newId(),
        userId: live.id,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString(),
        revokedAt: null,
      };
      next.sessions.push(session);
      const cookie = serializeSession({
        uid: live.id,
        sid: session.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.parse(session.expiresAt) / 1000),
      });
      recordSecurity({ type: "login_success", userId: live.id, email: live.email, ip: input.ip });
      return { user: publicUser(live), cookie, session };
    });
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
    await sendMail({
      to: user.email,
      subject: "Reset your Poolindex password",
      text: `Reset your password (valid for 1 hour): ${resetUrl}`,
      url: resetUrl,
      purpose: "reset_password",
    });
    recordSecurity({ type: "password_reset_requested", userId: user.id, email: user.email });
    const reveal = process.env.NODE_ENV !== "production" || process.env.POOLINDEX_REVEAL_MAIL === "1";
    return reveal ? { sent: true as const, resetUrl } : { sent: true as const };
  });
}

export async function resetPassword(rawToken: string, password: string): Promise<PublicUser> {
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
    recordSecurity({ type: "password_reset", userId: user.id, email: user.email });
    return publicUser(user);
  });
}

export function readSessionUser(request: Request): { user: UserRecord; session: SessionRecord } | null {
  const claims = parseSessionCookie(cookieValue(request, SESSION_COOKIE));
  if (!claims) return null;
  const state = readBetaState();
  const session = state.sessions.find((row) => row.id === claims.sid && row.userId === claims.uid) ?? null;
  if (!session || session.revokedAt) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) return null;
  const user = state.users.find((row) => row.id === claims.uid) ?? null;
  if (!user) return null;
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
      code: input.code?.trim() || `cs-${newId(6)}`,
      email: input.email ? normalizeEmail(input.email) : null,
      stage: input.stage ?? state.ops.betaStage,
      maxUses: input.maxUses && input.maxUses > 0 ? input.maxUses : 1,
      usedBy: [],
      disabled: false,
      note: input.note?.trim() ?? "",
      createdAt: nowIso(),
      createdBy: input.createdBy,
    };
    if (state.invites.some((row) => row.code === invite.code)) {
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
