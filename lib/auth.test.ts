import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { DEV_INVITE, canonicalizeEmail, completeGoogleAuth, createInvite, loginAccount, logoutSession, normalizeInviteCode, publicUser, redeemGoogleDesktopTicket, registerAccount, requestPasswordReset, resetPassword, revokeUserSessions, updateUser, verifyEmailToken, readSessionUser, listUsers } from "./auth.ts";
import { SESSION_COOKIE, parseSessionCookie } from "./session-cookie.ts";
import { listFeedback, submitFeedback, updateFeedbackStatus } from "./feedback.ts";
import { TERMS_VERSION, PRIVACY_VERSION } from "./legal.ts";
import { betaMetrics, readOps, scansAreOpen, updateOps } from "./ops.ts";
import { looksLikeSecretMaterial } from "./secrets-guard.ts";
import { assertSafeToStart, inspectEnv, ProductionEnvError } from "./env.ts";
import { readUserScans, readSecurity, readBetaState } from "./beta-store.ts";
import { trackScan, trackWalletAlert, trackWalletScan } from "./telemetry.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-beta-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "admin@example.com";
process.env.POOLINDEX_BETA_STAGE_CAP = "2";
process.env.NODE_ENV = "test";

before(() => {
  process.env.POOLINDEX_BETA_DIR = dir;
});

beforeEach(async () => {
  rmSync(dir, { recursive: true, force: true });
  process.env.POOLINDEX_BETA_DIR = dir;
  process.env.POOLINDEX_BETA_STAGE_CAP = "2";
  process.env.POOLINDEX_ADMIN_EMAILS = "admin@example.com";
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function register(email: string, extras: Partial<Parameters<typeof registerAccount>[0]> = {}) {
  return registerAccount({
    email,
    password: "correct-battery-staple",
    displayName: email.split("@")[0].replace(/[^\w]/g, "aa").slice(0, 20) || "User",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
    ...extras,
  });
}

test("invite-only registration hashes passwords and stores terms acceptance", async () => {
  await assert.rejects(
    () =>
      registerAccount({
        email: "a@example.com",
        password: "correct-battery-staple",
        displayName: "Ada",
        inviteCode: "nope",
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    /invitation/,
  );
  await assert.rejects(
    () =>
      registerAccount({
        email: "a@example.com",
        password: "correct-battery-staple",
        displayName: "Ada",
        inviteCode: DEV_INVITE,
        acceptTerms: false,
        acceptPrivacy: true,
      }),
    /Terms/,
  );
  const { user } = await register("ada@example.com", { displayName: "Ada Lovelace" });
  assert.equal(user.email, "ada@example.com");
  assert.equal(user.status, "pending_verification");
  assert.equal(user.plan, "free");
  assert.equal(user.termsVersion, TERMS_VERSION);
  assert.equal(user.privacyVersion, PRIVACY_VERSION);
  assert.ok(user.acceptedAt);
  assert.equal("passwordHash" in user, false);
  const stored = listUsers().find((row) => row.id === user.id);
  assert.ok(stored);
  assert.equal("passwordHash" in stored, false);
});

test("registration accepts copy-pasted invite codes with markdown, case, and unicode hyphens", async () => {
  process.env.POOLINDEX_BETA_STAGE_CAP = "5";
  const invite = createInvite({ createdBy: "admin", note: "paste-normalize" });
  assert.equal(normalizeInviteCode(` \`${invite.code.replace("-", "\u2011")}\` `).toLowerCase(), invite.code.toLowerCase());
  const created = await registerAccount({
    email: "paste-invite@example.com",
    password: "correct-battery-staple",
    displayName: "Paste Invite",
    inviteCode: ` \`${invite.code.replace("-", "\u2011")}\` `,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  assert.equal(created.user.inviteCode, invite.code);
  await assert.rejects(
    () =>
      registerAccount({
        email: "other-paste@example.com",
        password: "correct-battery-staple",
        displayName: "Other Paste",
        inviteCode: invite.code,
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    /already been used/,
  );
});

test("email verification, login, logout, and password reset", async () => {
  const created = await register("ada@example.com", { displayName: "Ada Lovelace" });
  const verified = verifyEmailToken(created.verifyUrl.split("token=")[1]);
  assert.equal(verified.status, "active");
  assert.ok(verified.emailVerifiedAt);

  const logged = await loginAccount({ email: "ada@example.com", password: "correct-battery-staple" });
  const claims = parseSessionCookie(logged.cookie);
  assert.ok(claims);
  assert.equal(claims.uid, logged.user.id);

  const request = new Request("http://127.0.0.1/api/auth/me", { headers: { cookie: `${SESSION_COOKIE}=${logged.cookie}` } });
  const session = readSessionUser(request);
  assert.ok(session);
  assert.equal(session.user.email, "ada@example.com");
  const bearerReq = new Request("http://127.0.0.1/api/auth/me", {
    headers: { authorization: `Bearer ${logged.cookie}` },
  });
  assert.equal(readSessionUser(bearerReq)?.user.email, "ada@example.com");

  logoutSession(request);
  assert.equal(readSessionUser(request), null);

  await loginAccount({ email: "ada@example.com", password: "correct-battery-staple" });
  const forgot = await requestPasswordReset("ada@example.com");
  assert.ok(forgot.resetUrl);
  const stale = await requestPasswordReset("ada@example.com");
  assert.ok(stale.resetUrl);
  await assert.rejects(
    () => resetPassword(forgot.resetUrl!.split("token=")[1], "new-battery-staple"),
    /not valid|already used/,
  );
  const afterReset = await resetPassword(stale.resetUrl.split("token=")[1], "new-battery-staple");
  assert.equal(afterReset.user.id, logged.user.id);
  assert.ok(afterReset.cookie);
  await assert.rejects(() => loginAccount({ email: "ada@example.com", password: "correct-battery-staple" }), /Invalid email or password/);
  const relogin = await loginAccount({ email: "ada@example.com", password: "new-battery-staple" });
  assert.equal(relogin.user.id, logged.user.id);
});

test("register verify login keeps the same user record and password hash", async () => {
  process.env.POOLINDEX_BETA_STAGE_CAP = "5";
  const created = await register("hash-stay@example.com", { displayName: "Hash Stay" });
  const before = readBetaState().users.find((row) => row.id === created.user.id);
  assert.ok(before?.passwordHash?.startsWith("scrypt$"));
  const hash = before!.passwordHash;
  assert.equal(before!.status, "pending_verification");
  assert.equal(
    readSecurity(20).some((row) => row.type === "register" && String(row.detail || "").startsWith("pwlen=")),
    true,
  );
  const verified = verifyEmailToken(created.verifyUrl.split("token=")[1]);
  assert.equal(verified.id, created.user.id);
  const afterVerify = readBetaState().users.find((row) => row.id === created.user.id);
  assert.equal(afterVerify?.passwordHash, hash);
  assert.equal(afterVerify?.status, "active");
  await assert.rejects(() => loginAccount({ email: "hash-stay@example.com", password: "" }), /Enter your password/);
  await assert.rejects(() => loginAccount({ email: "hash-stay@example.com", password: "wrong-password-1" }), /Invalid email or password/);
  const logged = await loginAccount({ email: "Hash-Stay@example.com", password: "correct-battery-staple" });
  assert.equal(logged.user.id, created.user.id);
  assert.ok(logged.cookie);
  const afterLogin = readBetaState().users.find((row) => row.id === created.user.id);
  assert.equal(afterLogin?.passwordHash, hash);
  logoutSession(
    new Request("http://127.0.0.1/api/auth/me", { headers: { cookie: `${SESSION_COOKIE}=${logged.cookie}` } }),
  );
  const again = await loginAccount({ email: "hash-stay@example.com", password: "correct-battery-staple" });
  assert.equal(again.user.id, created.user.id);
  assert.equal(readBetaState().users.find((row) => row.id === created.user.id)?.passwordHash, hash);
});

test("login accepts username as well as email, and duplicate usernames cannot register", async () => {
  const created = await register("ada@example.com", { displayName: "Ada Lovelace" });
  verifyEmailToken(created.verifyUrl.split("token=")[1]);
  const byName = await loginAccount({ email: "Ada Lovelace", password: "correct-battery-staple" });
  assert.equal(byName.user.email, "ada@example.com");
  const byCase = await loginAccount({ email: "ada lovelace", password: "correct-battery-staple" });
  assert.equal(byCase.user.id, byName.user.id);
  await assert.rejects(
    () => register("other@example.com", { displayName: "Ada Lovelace" }),
    /username is already taken/,
  );
  await assert.rejects(
    () => loginAccount({ email: "nobody", password: "correct-battery-staple" }),
    /Invalid email or password/,
  );
});

test("login matches Gmail aliases, records unknown vs bad password, and session revoke forces re-auth", async () => {
  assert.equal(canonicalizeEmail("Ada.Lovelace+tag@GoogleMail.com"), "adalovelace@gmail.com");
  const created = await register("ada.lovelace@gmail.com", { displayName: "Gmail Ada" });
  verifyEmailToken(created.verifyUrl.split("token=")[1]);
  const aliased = await loginAccount({ email: "AdaLovelace@googlemail.com", password: "correct-battery-staple" });
  assert.equal(aliased.user.id, created.user.id);
  await assert.rejects(
    () => loginAccount({ email: "ada.lovelace@gmail.com", password: "wrong-password-1" }),
    /Invalid email or password/,
  );
  await assert.rejects(
    () => loginAccount({ email: "otherbox@gmail.com", password: "correct-battery-staple" }),
    /Invalid email or password/,
  );
  const events = readSecurity(20);
  assert.equal(events.some((row) => String(row.detail || "").startsWith("bad_password:")), true);
  assert.equal(events.some((row) => String(row.detail || "").startsWith("unknown_account:")), true);
  const cookieReq = new Request("http://127.0.0.1/api/auth/me", {
    headers: { cookie: `${SESSION_COOKIE}=${aliased.cookie}` },
  });
  assert.equal(readSessionUser(cookieReq)?.user.id, created.user.id);
  const revoked = revokeUserSessions(created.user.id, "operator");
  assert.ok(revoked >= 1);
  assert.equal(readSessionUser(cookieReq), null);
  const again = await loginAccount({ email: "ada.lovelace@gmail.com", password: "correct-battery-staple" });
  assert.equal(again.user.id, created.user.id);
});

test("invalid credentials, expired sessions, and disabled accounts", async () => {
  const created = await register("ada@example.com", { displayName: "Ada Lovelace" });
  verifyEmailToken(created.verifyUrl.split("token=")[1]);
  await assert.rejects(() => loginAccount({ email: "ada@example.com", password: "wrong-password-1" }), /Invalid email or password/);

  const logged = await loginAccount({ email: "ada@example.com", password: "correct-battery-staple" });
  const expired = parseSessionCookie(logged.cookie, undefined, Date.now() + 8 * 24 * 60 * 60 * 1000);
  assert.equal(expired, null);

  updateUser(created.user.id, { status: "disabled" }, "admin");
  await assert.rejects(() => loginAccount({ email: "ada@example.com", password: "correct-battery-staple" }), /not allowed/);
});

test("user A cannot see user B wallets, scans, or feedback", async () => {
  process.env.POOLINDEX_BETA_STAGE_CAP = "5";
  const a = await register("a@example.com", { displayName: "User A" });
  const b = await register("b@example.com", { displayName: "User B" });
  verifyEmailToken(a.verifyUrl.split("token=")[1]);
  verifyEmailToken(b.verifyUrl.split("token=")[1]);
  updateUser(a.user.id, { wallets: ["0x1111111111111111111111111111111111111111"] }, a.user.id);
  updateUser(b.user.id, { wallets: ["0x2222222222222222222222222222222222222222"] }, b.user.id);
  const liveA = listUsers().find((row) => row.id === a.user.id);
  const liveB = listUsers().find((row) => row.id === b.user.id);
  assert.deepEqual(liveA?.wallets, ["0x1111111111111111111111111111111111111111"]);
  assert.deepEqual(liveB?.wallets, ["0x2222222222222222222222222222222222222222"]);
  assert.ok(!liveB?.wallets.includes(liveA!.wallets[0]));

  trackScan(liveA as never, { query: "uniswap", sources: ["catalog"], status: "completed", itemCount: 1 });
  trackScan(liveB as never, { query: "secret-to-b", sources: ["github"], status: "completed", itemCount: 2 });
  const scansA = readUserScans(a.user.id);
  const scansB = readUserScans(b.user.id);
  assert.equal(scansA.some((row) => row.query === "secret-to-b"), false);
  assert.equal(scansB.some((row) => row.query === "uniswap"), false);
  assert.equal(betaMetrics().funnel.walletScanCompleted, 0);

  submitFeedback({ userId: a.user.id, type: "useful", note: "helped me", source: "catalog", claimId: "uni" });
  submitFeedback({ userId: b.user.id, type: "broken_link", note: "dead page", source: "github" });
  const onlyA = listFeedback({ userId: a.user.id });
  const onlyB = listFeedback({ userId: b.user.id });
  assert.equal(onlyA.length, 1);
  assert.equal(onlyB.length, 1);
  assert.equal(onlyA[0].note, "helped me");
  assert.equal(onlyB[0].userId, b.user.id);
  assert.equal(onlyA.some((row) => row.userId === b.user.id), false);
});

test("closed beta funnel counts wallet bind through verified return use", async () => {
  process.env.POOLINDEX_BETA_STAGE_CAP = "5";
  const created = await register("funnel@example.com", { displayName: "Funnel" });
  verifyEmailToken(created.verifyUrl.split("token=")[1]);
  updateUser(created.user.id, { wallets: ["0x1111111111111111111111111111111111111111"], status: "active" }, created.user.id);
  const live = listUsers().find((row) => row.id === created.user.id);
  assert.ok(live);
  trackWalletScan(live, { status: "started" });
  trackWalletScan(live, {
    status: "completed",
    potentialFindings: 2,
    verifiedFindings: 1,
    sourcesChecked: 42,
  });
  trackWalletScan(live, {
    status: "completed",
    potentialFindings: 2,
    verifiedFindings: 1,
    sourcesChecked: 42,
    alerted: true,
  });
  trackWalletAlert(live.id, 1);
  const metrics = betaMetrics();
  assert.equal(metrics.funnel.walletBound, 1);
  assert.equal(metrics.funnel.walletScanStarted, 1);
  assert.equal(metrics.funnel.walletScanCompleted, 1);
  assert.equal(metrics.funnel.withPotential, 1);
  assert.equal(metrics.funnel.withVerified, 1);
  assert.equal(metrics.funnel.alerted, 1);
  assert.equal(metrics.funnel.returning, 1);
  assert.equal(metrics.funnel.totals.completed, 2);
  assert.equal(metrics.telemetry.walletAlert, 1);
  assert.equal(metrics.funnel.cap, 50);
});

test("admin role is env-gated and kill switch pauses scans without deleting users", async () => {
  const admin = await register("admin@example.com", { displayName: "Operator" });
  const user = await register("tester@example.com", { displayName: "Tester" });
  assert.equal(admin.user.role, "admin");
  assert.equal(user.user.role, "user");
  assert.equal(scansAreOpen(), true);
  const ops = updateOps({ scansEnabled: false, maintenanceMode: true, reason: "load shed" }, admin.user.id);
  assert.equal(ops.scansEnabled, false);
  assert.equal(ops.maintenanceMode, true);
  assert.equal(scansAreOpen(), false);
  assert.equal(listUsers().length, 2);
  updateOps({ scansEnabled: true, maintenanceMode: false, reason: "" }, admin.user.id);
  assert.equal(scansAreOpen(), true);
});

test("login promotes a matching ADMIN_EMAILS account that registered as user", async () => {
  process.env.POOLINDEX_ADMIN_EMAILS = "other@example.com";
  await register("later-admin@example.com", { displayName: "Later Admin" });
  assert.equal(listUsers().find((row) => row.email === "later-admin@example.com")?.role, "user");
  process.env.POOLINDEX_ADMIN_EMAILS = "later-admin@example.com";
  const logged = await loginAccount({ email: "later-admin@example.com", password: "correct-battery-staple" });
  assert.equal(logged.user.role, "admin");
});

test("login demotes an admin whose email left ADMIN_EMAILS and leaves TOTP fields", async () => {
  process.env.POOLINDEX_ADMIN_EMAILS = "keep-admin@example.com";
  const created = await register("keep-admin@example.com", { displayName: "Keep Admin" });
  assert.equal(created.user.role, "admin");
  process.env.POOLINDEX_ADMIN_EMAILS = "other-admin@example.com";
  const logged = await loginAccount({ email: "keep-admin@example.com", password: "correct-battery-staple" });
  assert.equal(logged.user.role, "user");
  assert.equal(Boolean(logged.user.totpEnabled), false);
});

test("a different ADMIN_EMAILS mailbox does not rewrite the registered email or block password login", async () => {
  process.env.POOLINDEX_ADMIN_EMAILS = "ops-console@gmail.com";
  const created = await register("shortbox@gmail.com", { displayName: "Short Box" });
  verifyEmailToken(created.verifyUrl.split("token=")[1]);
  process.env.POOLINDEX_ADMIN_EMAILS = "longeradminx@gmail.com";
  const logged = await loginAccount({ email: "shortbox@gmail.com", password: "correct-battery-staple" });
  assert.equal(logged.user.email, "shortbox@gmail.com");
  assert.equal(logged.user.role, "user");
  const live = listUsers().find((row) => row.id === created.user.id);
  assert.equal(live?.email, "shortbox@gmail.com");
  updateUser(created.user.id, { email: "longeradminx@gmail.com" } as never, "operator");
  assert.equal(listUsers().find((row) => row.id === created.user.id)?.email, "shortbox@gmail.com");
});

test("beta stage cap blocks extra registrations", async () => {
  process.env.POOLINDEX_BETA_STAGE_CAP = "1";
  await register("one@example.com", { displayName: "One" });
  await assert.rejects(() => register("two@example.com", { displayName: "Two" }), /full/);
});

test("feedback workflow and secret material rejection", async () => {
  const created = await register("ada@example.com", { displayName: "Ada Lovelace" });
  const row = submitFeedback({
    userId: created.user.id,
    type: "report_problem",
    note: "timeout",
    source: "wayback",
    url: "https://example.com/claim",
  });
  assert.equal(row.status, "new");
  assert.equal(row.urlHost, "example.com");
  const updated = updateFeedbackStatus(row.id, "investigating", created.user.id);
  assert.equal(updated.status, "investigating");
  assert.equal(looksLikeSecretMaterial("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"), true);
  assert.equal(looksLikeSecretMaterial("0x1111111111111111111111111111111111111111"), false);
  await assert.rejects(
    () =>
      registerAccount({
        email: "seed@example.com",
        password: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        displayName: "Seed",
        inviteCode: DEV_INVITE,
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    /private keys/,
  );
});

test("production env validation and invite creation", async () => {
  const report = inspectEnv({ NODE_ENV: "production" });
  assert.equal(report.ok, false);
  assert.ok(report.missing.includes("POOLINDEX_SESSION_SECRET"));
  const wellKnown = inspectEnv({
    NODE_ENV: "production",
    POOLINDEX_SESSION_SECRET: "dev-only-poolindex-session-secret",
    POOLINDEX_PLAN_SECRET: "dev-only-poolindex-plan-secret",
    POOLINDEX_ADMIN_EMAILS: "admin@example.com",
  });
  assert.equal(wellKnown.ok, false);
  assert.ok(wellKnown.missing.includes("POOLINDEX_PLAN_SECRET"));
  const lockedUnset = inspectEnv({ NODE_ENV: undefined });
  assert.equal(lockedUnset.publicRuntime, true);
  assert.equal(lockedUnset.ok, false);
  const demoKeys = inspectEnv({
    NODE_ENV: "production",
    POOLINDEX_SESSION_SECRET: "prod-session",
    POOLINDEX_PLAN_SECRET: "prod-plan",
    POOLINDEX_ADMIN_EMAILS: "admin@example.com",
    POOLINDEX_PAID_KEYS: "poolindex-pro-demo",
  });
  assert.equal(demoKeys.ok, false);
  assert.ok(demoKeys.missing.includes("POOLINDEX_PAID_KEYS"));
  const ok = inspectEnv({
    NODE_ENV: "production",
    POOLINDEX_SESSION_SECRET: "prod-session",
    POOLINDEX_PLAN_SECRET: "prod-plan",
    POOLINDEX_ADMIN_EMAILS: "admin@example.com",
  });
  assert.equal(ok.ok, true);
  assert.throws(
    () =>
      assertSafeToStart({
        NODE_ENV: "production",
        POOLINDEX_SESSION_SECRET: "dev-only-poolindex-session-secret",
        POOLINDEX_PLAN_SECRET: "prod-plan",
        POOLINDEX_ADMIN_EMAILS: "admin@example.com",
      }),
    ProductionEnvError,
  );
  const started = assertSafeToStart({
    NODE_ENV: "production",
    POOLINDEX_SESSION_SECRET: "prod-session",
    POOLINDEX_PLAN_SECRET: "prod-plan",
    POOLINDEX_ADMIN_EMAILS: "admin@example.com",
  });
  assert.equal(started.ok, true);
  const invite = createInvite({ createdBy: "admin", email: "guest@example.com", maxUses: 1, note: "stage1" });
  const guest = await register("guest@example.com", { displayName: "Guest", inviteCode: invite.code });
  assert.equal(guest.user.inviteCode, invite.code);
  const metrics = betaMetrics();
  assert.equal(metrics.users.registered >= 1, true);
  assert.equal(readOps().betaStage, 1);
});

test("unknown account status is rejected rather than cast", async () => {
  const created = await register("ada@example.com", { displayName: "Ada Lovelace" });
  assert.throws(
    () => updateUser(created.user.id, { status: "vip" as never }, "admin"),
    /Unknown account status/,
  );
  const live = listUsers().find((row) => row.id === created.user.id);
  assert.equal(live?.status, "pending_verification");
});

test("Google registration, login, invite, and safe email linking", async () => {
  await assert.rejects(
    () =>
      completeGoogleAuth({
        sub: "sub-1",
        email: "neo@example.com",
        emailVerified: false,
        name: "Neo",
        intent: "register",
        inviteCode: DEV_INVITE,
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    /did not verify/,
  );
  await assert.rejects(
    () =>
      completeGoogleAuth({
        sub: "sub-1",
        email: "neo@example.com",
        emailVerified: true,
        name: "Neo",
        intent: "login",
        inviteCode: "",
        acceptTerms: false,
        acceptPrivacy: false,
      }),
    /invitation first/,
  );
  await assert.rejects(
    () =>
      completeGoogleAuth({
        sub: "sub-1",
        email: "neo@example.com",
        emailVerified: true,
        name: "Neo",
        intent: "register",
        inviteCode: "nope",
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    /invitation/,
  );
  const created = await completeGoogleAuth({
    sub: "sub-1",
    email: "neo@example.com",
    emailVerified: true,
    name: "Neo",
    intent: "register",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  assert.equal(created.user.email, "neo@example.com");
  assert.equal(created.user.status, "active");
  assert.equal(created.user.googleLinked, true);
  assert.equal("googleSub" in created.user, false);
  await assert.rejects(
    () => loginAccount({ email: "neo@example.com", password: "correct-battery-staple" }),
    /Google Sign-In/,
  );
  const again = await completeGoogleAuth({
    sub: "sub-1",
    email: "neo@example.com",
    emailVerified: true,
    name: "Neo",
    intent: "login",
    inviteCode: "",
    acceptTerms: false,
    acceptPrivacy: false,
  });
  assert.equal(again.user.id, created.user.id);

  const passwordUser = await register("ada@example.com", { displayName: "Ada Lovelace" });
  await assert.rejects(
    () =>
      completeGoogleAuth({
        sub: "sub-ada",
        email: "ada@example.com",
        emailVerified: true,
        name: "Ada",
        intent: "login",
        inviteCode: "",
        acceptTerms: false,
        acceptPrivacy: false,
      }),
    /Verify this PoolIndex email first/,
  );
  verifyEmailToken(passwordUser.verifyUrl.split("token=")[1]);
  await updateUser(passwordUser.user.id, { wallets: ["0x1111111111111111111111111111111111111111"] }, "admin");
  const linked = await completeGoogleAuth({
    sub: "sub-ada",
    email: "ada@example.com",
    emailVerified: true,
    name: "Ada",
    intent: "login",
    inviteCode: "",
    acceptTerms: false,
    acceptPrivacy: false,
  });
  assert.equal(linked.user.id, passwordUser.user.id);
  assert.equal(linked.user.googleLinked, true);
  assert.deepEqual(linked.user.wallets, ["0x1111111111111111111111111111111111111111"]);
  const passwordStillWorks = await loginAccount({ email: "ada@example.com", password: "correct-battery-staple" });
  assert.equal(passwordStillWorks.user.id, passwordUser.user.id);
  await assert.rejects(
    () =>
      completeGoogleAuth({
        sub: "sub-other",
        email: "ada@example.com",
        emailVerified: true,
        name: "Ada",
        intent: "login",
        inviteCode: "",
        acceptTerms: false,
        acceptPrivacy: false,
      }),
    /different Google account/,
  );
});

test("desktop Google ticket is one-time and challenge-bound", async () => {
  const started = await completeGoogleAuth({
    sub: "sub-desk",
    email: "desk@example.com",
    emailVerified: true,
    name: "Desk",
    intent: "register",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
    desktop: true,
    challengeHash: require("node:crypto").createHash("sha256").update("challenge-1").digest("base64url"),
  });
  assert.ok(started.desktopTicket);
  const redeemed = redeemGoogleDesktopTicket(started.desktopTicket!, "challenge-1");
  assert.equal(redeemed.user.email, "desk@example.com");
  assert.throws(() => redeemGoogleDesktopTicket(started.desktopTicket!, "challenge-1"), /already used/);
  assert.throws(() => redeemGoogleDesktopTicket(started.desktopTicket!, "wrong"), /not valid/);
});
