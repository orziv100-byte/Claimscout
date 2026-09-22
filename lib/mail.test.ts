import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ResendMailProvider,
  absoluteMailUrl,
  mailFromAddress,
  mailProviderFromEnv,
  mailReplyTo,
  publicOrigin,
  resendSendBody,
} from "./mail.ts";

test("mail defaults send from poolindex.app and stay on outbox without a key", () => {
  assert.equal(mailFromAddress({}), "PoolIndex <noreply@poolindex.app>");
  assert.equal(mailProviderFromEnv({}).name, "outbox");
  assert.equal(mailProviderFromEnv({ POOLINDEX_MAIL_PROVIDER: "resend" }).name, "outbox");
  assert.equal(
    mailProviderFromEnv({ POOLINDEX_MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test" }).name,
    "resend",
  );
});

test("production mail links are absolute on poolindex.app", () => {
  assert.equal(publicOrigin({ NODE_ENV: "test" }), "");
  assert.equal(publicOrigin({ NODE_ENV: "production" }), "https://poolindex.app");
  assert.equal(absoluteMailUrl("/verify?token=abc", { NODE_ENV: "test" }), "/verify?token=abc");
  assert.equal(
    absoluteMailUrl("/verify?token=abc", { NODE_ENV: "production" }),
    "https://poolindex.app/verify?token=abc",
  );
  assert.equal(
    absoluteMailUrl("/reset?token=xyz", { POOLINDEX_PUBLIC_URL: "https://poolindex.app/" }),
    "https://poolindex.app/reset?token=xyz",
  );
});

test("resend payload uses the poolindex.app from address and does not embed the API key", () => {
  const body = resendSendBody(
    {
      to: "ada@example.com",
      subject: "Verify your PoolIndex Beta account",
      text: "Welcome\nhttps://poolindex.app/verify?token=abc",
      url: "https://poolindex.app/verify?token=abc",
      purpose: "verify_email",
    },
    { POOLINDEX_MAIL_FROM: "PoolIndex <noreply@poolindex.app>" },
  );
  const encoded = JSON.stringify(body);
  assert.equal(body.from, "PoolIndex <noreply@poolindex.app>");
  assert.deepEqual(body.to, ["ada@example.com"]);
  assert.match(String(body.html), /poolindex\.app\/verify\?token=abc/);
  assert.equal(encoded.includes("re_"), false);
  assert.equal(mailReplyTo({ POOLINDEX_CONTACT_SUPPORT: "support@POOLINDEX_DOMAIN" }), undefined);
  assert.equal(mailReplyTo({ POOLINDEX_MAIL_REPLY_TO: "support@poolindex.app" }), "support@poolindex.app");
});

test("resend provider posts to the API and reports delivery without returning the key", async () => {
  const originalFetch = globalThis.fetch;
  let posted = false;
  globalThis.fetch = (async (_url, init) => {
    posted = true;
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization") || "";
    assert.equal(authorization.startsWith("Bearer "), true);
    assert.equal(authorization.includes("re_test_key"), true);
    const body = JSON.parse(String(init?.body)) as { from: string; subject: string };
    assert.equal(body.from, "PoolIndex <noreply@poolindex.app>");
    assert.equal(body.subject, "Reset your PoolIndex password");
    return new Response(JSON.stringify({ id: "email_test" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const provider = new ResendMailProvider({
      RESEND_API_KEY: "re_test_key",
      POOLINDEX_MAIL_FROM: "PoolIndex <noreply@poolindex.app>",
    });
    const result = await provider.send({
      to: "ada@example.com",
      subject: "Reset your PoolIndex password",
      text: "https://poolindex.app/reset?token=xyz",
      url: "https://poolindex.app/reset?token=xyz",
      purpose: "reset_password",
    });
    assert.equal(posted, true);
    assert.equal(result.delivered, true);
    assert.equal(result.provider, "resend");
    assert.equal(JSON.stringify(result).includes("re_test_key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
