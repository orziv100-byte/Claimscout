import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_HOME,
  PORTAL_HOME,
  isAppPath,
  isPublicWebsitePath,
  isScanClientAllowed,
  isDesktopClient,
  websitePostLoginPath,
} from "./site-surface.ts";

test("website allows register, download, legal, and payment paths", () => {
  for (const path of ["/", "/login", "/register", "/download", "/terms", "/privacy", "/accessibility", "/upgrade"]) {
    assert.equal(isPublicWebsitePath(path), true, path);
  }
  assert.equal(isPublicWebsitePath("/account"), false);
  for (const path of ["/wallet", "/discover", "/hunts", "/catalog", "/connect", "/coverage", "/app", "/claims/abc"]) {
    assert.equal(isAppPath(path), true, path);
    assert.equal(isPublicWebsitePath(path), false, path);
  }
});

test("desktop identity is Electron UA, PoolIndexDesktop UA, or cookie", () => {
  assert.equal(isDesktopClient({ userAgent: "Mozilla/5.0 Chrome/120" }), false);
  assert.equal(isDesktopClient({ userAgent: "Mozilla/5.0 Electron/28.0.0" }), true);
  assert.equal(isDesktopClient({ userAgent: "PoolIndexDesktop/0.1.3" }), true);
  assert.equal(isDesktopClient({ userAgent: "Mozilla/5.0 Chrome/120", desktopCookie: "1" }), true);
});

test("website login never lands on scan routes", () => {
  assert.equal(websitePostLoginPath(null, false), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/wallet", false), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/discover", false), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/account", false), "/account");
  assert.equal(websitePostLoginPath("/login", false), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/wallet", true), "/wallet");
  assert.equal(websitePostLoginPath(null, true), APP_HOME);
});

test("scan clients are desktop or direct loopback, not Cloudflare forwarded host", () => {
  const browser = new Request("https://poolindex.app/api/onchain", {
    headers: { host: "poolindex.app", "user-agent": "Mozilla/5.0 Chrome/120" },
  });
  const electron = new Request("https://poolindex.app/api/onchain", {
    headers: { host: "poolindex.app", "user-agent": "Mozilla/5.0 Electron/28.0.0" },
  });
  const operator = new Request("http://127.0.0.1:43148/api/onchain", {
    headers: { host: "127.0.0.1:43148", "user-agent": "Mozilla/5.0 Chrome/120" },
  });
  const tunnel = new Request("https://poolindex.app/api/onchain", {
    headers: {
      host: "127.0.0.1:43147",
      "x-forwarded-host": "poolindex.app",
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "Mozilla/5.0 Chrome/120",
    },
  });
  assert.equal(isScanClientAllowed(browser), false);
  assert.equal(isScanClientAllowed(electron), true);
  assert.equal(isScanClientAllowed(operator), true);
  assert.equal(isScanClientAllowed(tunnel), false);
});
