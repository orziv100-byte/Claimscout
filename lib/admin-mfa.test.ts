import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { confirmAdminTotp, enrollAdminTotp, totpNowForTests, verifyAdminTotp } from "./admin-mfa.ts";
import { DEV_INVITE, loginAccount, registerAccount, updateUser } from "./auth.ts";
import { publicUser } from "./auth.ts";
import { requireAdmin } from "./request-guard.ts";
import { SESSION_COOKIE } from "./session-cookie.ts";
import { totpCode, totpStep, verifyTotp } from "./totp.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-mfa-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "admin@example.com";
process.env.NODE_ENV = "test";

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("TOTP accepts the current window and rejects reused or old codes", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const now = Date.parse("2026-09-22T19:00:00.000Z");
  const code = totpCode(secret, totpStep(now));
  const ok = verifyTotp(secret, code, { now });
  assert.equal(ok.ok, true);
  const reused = verifyTotp(secret, code, { now, lastStep: ok.ok ? ok.step : 0 });
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.reason, "reused");
  const old = verifyTotp(secret, "000000", { now });
  assert.equal(old.ok, false);
});

test("admin MFA enroll/confirm, missing MFA blocks admin routes, reused code fails", async () => {
  process.env.POOLINDEX_ADMIN_EMAILS = "root@example.com";
  const created = await registerAccount({
    email: "root@example.com",
    password: "correct-battery-staple",
    displayName: "Root Admin",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  updateUser(created.user.id, { role: "admin", status: "active" }, created.user.id);
  const logged = await loginAccount({ email: "root@example.com", password: "correct-battery-staple" });
  const enrolled = enrollAdminTotp(logged.user.id);
  const secret = new URL(enrolled.otpauth).searchParams.get("secret");
  assert.ok(secret);
  const now = Date.now();
  const code = totpNowForTests(secret, now);
  const confirmed = confirmAdminTotp(logged.user.id, code);
  assert.equal(confirmed.enabled, true);
  assert.equal(confirmed.recoveryCodes.length, 8);
  assert.equal(publicUser(logged.user).totpSecret, undefined);

  const authedReq = new Request("http://127.0.0.1/api/admin/summary", {
    headers: { cookie: `${SESSION_COOKIE}=${logged.cookie}` },
  });
  const blocked = requireAdmin(authedReq);
  assert.equal(blocked instanceof Response, true);
  if (blocked instanceof Response) {
    const body = (await blocked.json()) as { code?: string };
    assert.equal(body.code, "MFA_REQUIRED");
  }

  assert.throws(() => verifyAdminTotp(logged.user.id, logged.session.id, code), /not valid/);
  const nextCode = totpNowForTests(secret, now + 31_000);
  const mfaCookie = verifyAdminTotp(logged.user.id, logged.session.id, nextCode);
  const okReq = new Request("http://127.0.0.1/api/admin/summary", {
    headers: { cookie: `${SESSION_COOKIE}=${logged.cookie}; poolindex_admin_mfa=${mfaCookie}` },
  });
  const allowed = requireAdmin(okReq);
  assert.equal(allowed instanceof Response, false);
});
