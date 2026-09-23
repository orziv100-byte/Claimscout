import assert from "node:assert/strict";
import { test } from "node:test";
import { requestHostname, sameOrigin } from "./csrf.ts";

function req(method: string, headers: Record<string, string>) {
  return new Request("http://127.0.0.1:43147/api/auth/login", { method, headers });
}

test("requestHostname strips ports, schemes, and forwarded lists", () => {
  assert.equal(requestHostname("poolindex.app:443"), "poolindex.app");
  assert.equal(requestHostname("https://poolindex.app"), "poolindex.app");
  assert.equal(requestHostname("poolindex.app, 127.0.0.1:43147"), "poolindex.app");
  assert.equal(requestHostname("127.0.0.1:43147"), "127.0.0.1");
});

test("login CSRF allows poolindex.app even when Next is bound to loopback", () => {
  assert.equal(
    sameOrigin(
      req("POST", {
        origin: "https://poolindex.app",
        host: "127.0.0.1:43147",
        "x-forwarded-host": "poolindex.app",
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      req("POST", {
        origin: "https://poolindex.app",
        host: "127.0.0.1:43147",
      }),
    ),
    true,
  );
  assert.equal(sameOrigin(req("POST", { origin: "https://poolindex.app", host: "poolindex.app" })), true);
  assert.equal(sameOrigin(req("GET", {})), true);
});

test("login CSRF still blocks foreign origins", () => {
  assert.equal(sameOrigin(req("POST", { origin: "https://evil.example", host: "poolindex.app" })), false);
  assert.equal(sameOrigin(req("POST", { origin: "https://evil.example", host: "127.0.0.1:43147" })), false);
  assert.equal(sameOrigin(req("POST", { host: "poolindex.app" })), false);
});
