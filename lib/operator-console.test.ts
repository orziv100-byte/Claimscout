import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { DEV_INVITE, loginAccount, registerAccount, verifyEmailToken } from "./auth.ts";
import { operatorDashboard, operatorSystemFeed, operatorUsers, performOperatorAction } from "./operator-console.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-ops-"));
const prev = process.env.POOLINDEX_BETA_DIR;
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.NODE_ENV = "test";

before(() => {
  process.env.POOLINDEX_BETA_DIR = dir;
});

after(() => {
  if (prev === undefined) delete process.env.POOLINDEX_BETA_DIR;
  else process.env.POOLINDEX_BETA_DIR = prev;
  rmSync(dir, { recursive: true, force: true });
});

test("operator snapshot omits secrets and requires confirmation for destructive actions", async () => {
  const created = await registerAccount({
    email: "ops@example.com",
    password: "correct-battery-staple",
    displayName: "Ops User",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  verifyEmailToken(created.verifyUrl.split("token=")[1]);
  const logged = await loginAccount({ email: "ops@example.com", password: "correct-battery-staple" });
  const dash = JSON.stringify(operatorDashboard());
  assert.match(dash, /"registered":/);
  assert.doesNotMatch(dash, /passwordHash|totpSecret|scrypt\$|PAYPAL_CLIENT_SECRET|poolindex_session/);
  const users = operatorUsers("ops@example.com");
  assert.equal(users[0]?.email, "ops@example.com");
  assert.equal("passwordHash" in (users[0] as object), false);
  const denied = performOperatorAction({ action: "revoke_sessions", userId: logged.user.id, confirm: "nope" });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "CONFIRM_REQUIRED");
  const revoked = performOperatorAction({ action: "revoke_sessions", userId: logged.user.id, confirm: "CONFIRM" });
  assert.equal(revoked.ok, true);
  const refund = performOperatorAction({ action: "refund", subscriptionId: "none", confirm: "REFUND" });
  assert.equal(refund.ok, false);
  assert.equal(refund.code, "NO_CAPTURE");
  const feed = operatorSystemFeed();
  assert.ok(Array.isArray(feed.events));
  const script = readFileSync(new URL("../scripts/internal-download-admin.ts", import.meta.url), "utf8");
  assert.match(script, /127\.0\.0\.1|INTERNAL_ADMIN_BIND/);
  assert.doesNotMatch(script, /0\.0\.0\.0/);
  assert.doesNotMatch(script, /poolindex\.app\/admin/);
  assert.match(script, /A\. User feedback/);
  assert.match(script, /B\. System feedback \/ telemetry/);
});
