import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { lastMailTo } from "./auth.ts";
import { parseAdminInviteInput, parseAdminOpsPatch, parseAdminUserPatch } from "./admin-input.ts";
import { CATALOG } from "./catalog.ts";
import { contentSecurityPolicy, frameAncestorsDirective } from "./csp.ts";
import { PUBLIC_HEALTH_FORBIDDEN_KEYS, publicHealthBody, publicStatusBody } from "./health.ts";
import { getMailProvider, resetMailProvider, sendMail, setMailProvider, type MailProvider } from "./mail.ts";
import { clientIp, limitExpensiveEndpoint, rateLimit, resetRateLimitForTests } from "./rate-limit.ts";
import { ACCOUNT_STATUSES } from "./beta-types.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-hardening-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "admin@example.com";
process.env.NODE_ENV = "test";

before(() => {
  process.env.POOLINDEX_BETA_DIR = dir;
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  resetMailProvider();
  resetRateLimitForTests();
});

test("production CSP does not ship frame-ancestors *", () => {
  assert.equal(frameAncestorsDirective("production"), "'none'");
  assert.equal(contentSecurityPolicy("production"), "frame-ancestors 'none';");
  assert.equal(frameAncestorsDirective("development"), "*");
  assert.equal(contentSecurityPolicy("development"), "frame-ancestors *;");
});

test("public health and status omit RAM CPU disk job and env details", () => {
  const health = publicHealthBody("ok");
  assert.deepEqual(health, { ok: true, status: "ok" });
  const down = publicHealthBody("critical");
  assert.deepEqual(down, { ok: false, status: "unavailable" });
  const status = publicStatusBody(true);
  assert.deepEqual(status, { ok: false, maintenanceMode: true });
  for (const key of PUBLIC_HEALTH_FORBIDDEN_KEYS) {
    assert.equal(Object.hasOwn(health, key), false);
    assert.equal(Object.hasOwn(status, key), false);
  }
});

test("expensive endpoints are limited per user and per IP", () => {
  resetRateLimitForTests();
  const request = new Request("http://127.0.0.1/api/search", { headers: { "x-forwarded-for": "203.0.113.9" } });
  assert.equal(clientIp(request), "203.0.113.9");
  for (let i = 0; i < 20; i += 1) {
    const hit = limitExpensiveEndpoint(request, "user-a", "search");
    assert.equal(hit.ok, true);
  }
  const blocked = limitExpensiveEndpoint(request, "user-a", "search");
  assert.equal(blocked.ok, false);
  const otherUser = limitExpensiveEndpoint(request, "user-b", "search");
  assert.equal(otherUser.ok, true);
  const otherEndpoint = limitExpensiveEndpoint(request, "user-a", "verify");
  assert.equal(otherEndpoint.ok, true);
  const first = rateLimit("unit", 1, 60_000);
  const second = rateLimit("unit", 1, 60_000);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
});

test("admin mutations reject unknown status, plan, role, and extra fields", () => {
  assert.throws(() => parseAdminUserPatch({ id: "u1", status: "superadmin" }), /Unknown account status/);
  assert.throws(() => parseAdminUserPatch({ id: "u1", status: "active", extra: true }), /Unknown user field/);
  assert.throws(() => parseAdminUserPatch({ id: "u1", plan: "enterprise" }), /Unknown plan/);
  assert.throws(() => parseAdminUserPatch({ id: "u1", role: "root" }), /Unknown role/);
  assert.throws(() => parseAdminOpsPatch({ scansEnabled: "yes" }), /boolean/);
  assert.throws(() => parseAdminOpsPatch({ betaStage: 9 }), /Unknown beta stage/);
  assert.throws(() => parseAdminInviteInput({ stage: 4 }), /Unknown invite stage/);
  const ok = parseAdminUserPatch({ id: "u1", status: "suspended", plan: "free" });
  assert.equal(ok.status, "suspended");
  for (const status of ACCOUNT_STATUSES) {
    assert.equal(parseAdminUserPatch({ id: "u1", status }).status, status);
  }
});

test("mail provider interface keeps the outbox fallback without a hard-coded vendor", async () => {
  assert.equal(getMailProvider().name, "outbox");
  const sent: string[] = [];
  const fake: MailProvider = {
    name: "test-provider",
    async send(message) {
      sent.push(message.purpose);
      return { delivered: true, provider: "test-provider" };
    },
  };
  setMailProvider(fake);
  const result = await sendMail({
    to: "ada@example.com",
    subject: "Verify",
    text: "link",
    url: "/verify?token=x",
    purpose: "verify_email",
  });
  assert.equal(result.delivered, true);
  assert.deepEqual(sent, ["verify_email"]);
  const outbox = lastMailTo("ada@example.com");
  assert.ok(outbox);
  assert.equal(outbox.subject, "Verify");

  setMailProvider({
    name: "broken",
    async send() {
      throw new Error("provider down");
    },
  });
  const fallback = await sendMail({
    to: "ada@example.com",
    subject: "Reset",
    text: "reset",
    purpose: "reset_password",
  });
  assert.equal(fallback.delivered, false);
  assert.equal(fallback.provider, "outbox");
  resetMailProvider();
});

test("catalog accuracy audit is loaded for hardening tests", () => {
  assert.ok(CATALOG.length > 0);
  assert.ok(CATALOG.every((claim) => typeof claim.claimability === "string"));
});
