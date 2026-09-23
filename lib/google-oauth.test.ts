import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createOAuthState,
  exchangeGoogleCode,
  googleConfigured,
  googleRedirectUri,
  hashDesktopChallenge,
  isAllowedGoogleRedirectUri,
  newPkcePair,
  readSignedOAuthState,
  sanitizeNextPath,
} from "./google-oauth.ts";

test("Google OAuth helpers stay server-side and reject open redirects", () => {
  assert.equal(googleConfigured({}), false);
  assert.equal(googleConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }), true);
  assert.equal(googleRedirectUri({ NODE_ENV: "production" }), "https://poolindex.app/api/auth/google/callback");
  assert.equal(isAllowedGoogleRedirectUri("https://evil.example/callback", { NODE_ENV: "production" }), false);
  assert.equal(isAllowedGoogleRedirectUri("https://poolindex.app/api/auth/google/callback", { NODE_ENV: "production" }), true);
  assert.equal(sanitizeNextPath("https://evil.example"), "/download");
  assert.equal(sanitizeNextPath("//evil.example"), "/download");
  assert.equal(sanitizeNextPath("/upgrade"), "/upgrade");
  assert.equal(sanitizeNextPath("/wallet"), "/download");
  assert.equal(sanitizeNextPath("/wallet", true), "/wallet");
  const pkce = newPkcePair();
  assert.equal(pkce.challenge, createHash("sha256").update(pkce.verifier).digest("base64url"));
  assert.equal(hashDesktopChallenge("abc"), createHash("sha256").update("abc").digest("base64url"));
});

test("OAuth state cookie is HMAC-signed and includes PKCE verifier only in the cookie", () => {
  process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.NODE_ENV = "test";
  const started = createOAuthState({ intent: "login", next: "/wallet" });
  assert.match(started.authorizeUrl, /accounts\.google\.com/);
  assert.match(started.authorizeUrl, /code_challenge=/);
  assert.doesNotMatch(started.authorizeUrl, /client_secret/);
  const parsed = readSignedOAuthState(started.cookieValue);
  assert.ok(parsed);
  assert.equal(parsed.intent, "login");
  assert.ok(parsed.verifier);
  assert.equal(readSignedOAuthState(started.cookieValue + "tamper"), null);
});

test("token exchange uses userinfo and never treats unverified email as verified", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      assert.match(String(init?.body || ""), /code_verifier=/);
      assert.doesNotMatch(String(init?.body || ""), /log/);
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    if (url.includes("userinfo")) {
      assert.match(String(init?.headers ? JSON.stringify(init.headers) : ""), /Bearer token/);
      return new Response(JSON.stringify({ sub: "abc", email: "user@example.com", email_verified: false, name: "User" }), {
        status: 200,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  try {
    const profile = await exchangeGoogleCode("code", "verifier", {
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      NODE_ENV: "production",
    });
    assert.equal(profile.emailVerified, false);
    assert.equal(profile.email, "user@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
