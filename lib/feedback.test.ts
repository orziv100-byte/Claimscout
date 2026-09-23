import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { DEV_INVITE, registerAccount } from "./auth.ts";
import { readBetaState } from "./beta-store.ts";
import { listFeedback, normalizeFeedbackStatus, submitFeedback, updateFeedbackStatus } from "./feedback.ts";
import { betaMetrics } from "./ops.ts";
import { looksLikeSecretMaterial } from "./secrets-guard.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-feedback-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "feedback-admin@example.com";
process.env.NODE_ENV = "test";

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("EXE beta feedback stores user, category, rating, and starts as new", async () => {
  const created = await registerAccount({
    email: "beta@example.com",
    password: "correct-battery-staple",
    displayName: "Beta User",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  const row = submitFeedback({
    userId: created.user.id,
    type: "bug",
    note: "Scan froze on wallet check",
    rating: 2,
    contactMe: true,
    source: "exe",
  });
  assert.equal(row.userId, created.user.id);
  assert.equal(row.type, "bug");
  assert.equal(row.rating, 2);
  assert.equal(row.contactMe, true);
  assert.equal(row.status, "new");
  assert.equal(betaMetrics().feedback.new, 1);
  assert.equal(listFeedback({ type: "bug", rating: 2 }).length, 1);
  const reviewed = updateFeedbackStatus(row.id, "reviewing", created.user.id);
  assert.equal(reviewed.status, "investigating");
  assert.equal(normalizeFeedbackStatus("investigating"), "reviewed");
  assert.equal(normalizeFeedbackStatus("reviewing"), "reviewed");
  assert.equal(betaMetrics().feedback.new, 0);
  const resolved = updateFeedbackStatus(row.id, "resolved", created.user.id);
  assert.equal(resolved.status, "resolved");
  assert.equal(listFeedback({ status: "resolved" }).length, 1);
  assert.equal(readBetaState(dir).feedback[0]?.userId, created.user.id);
});

test("beta feedback rejects secrets, empty notes, and bad ratings", async () => {
  const created = await registerAccount({
    email: "guard@example.com",
    password: "correct-battery-staple",
    displayName: "Guard User",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  assert.equal(looksLikeSecretMaterial("PAYPAL_CLIENT_SECRET=abc"), true);
  assert.throws(
    () => submitFeedback({ userId: created.user.id, type: "payment", note: "PAYPAL_CLIENT_SECRET=abc", rating: 3 }),
    /private keys|secret/i,
  );
  assert.throws(
    () => submitFeedback({ userId: created.user.id, type: "idea", note: "no", rating: 5 }),
    /short note/i,
  );
  assert.throws(
    () => submitFeedback({ userId: created.user.id, type: "other", note: "this is long enough", rating: 9 }),
    /1 to 5/i,
  );
});
