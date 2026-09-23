import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_HOME,
  PORTAL_HOME,
  isAppPath,
  isDesktopClient,
  isPublicWebsitePath,
  websitePostLoginPath,
} from "./site-surface.ts";

test("website, portal, and desktop app paths stay separate", () => {
  assert.equal(isPublicWebsitePath("/"), true);
  assert.equal(isPublicWebsitePath("/download"), true);
  assert.equal(isPublicWebsitePath("/login"), true);
  assert.equal(isPublicWebsitePath("/register"), true);
  assert.equal(isPublicWebsitePath("/terms"), true);
  assert.equal(isPublicWebsitePath("/wallet"), false);
  assert.equal(isPublicWebsitePath("/discover"), false);
  assert.equal(isPublicWebsitePath("/catalog"), false);
  assert.equal(isPublicWebsitePath("/connect"), false);
  assert.equal(isPublicWebsitePath("/coverage"), false);
  assert.equal(isAppPath("/app"), true);
  assert.equal(isAppPath("/wallet"), true);
  assert.equal(isAppPath("/hunts/abc"), true);
  assert.equal(isAppPath("/desktop"), true);
  assert.equal(isPublicWebsitePath("/desktop"), false);
});

test("website login never lands on desktop app routes", () => {
  assert.equal(websitePostLoginPath(null), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/wallet"), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/discover"), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/admin"), PORTAL_HOME);
  assert.equal(websitePostLoginPath("https://evil.example"), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/upgrade"), "/upgrade");
  assert.equal(websitePostLoginPath("/account"), "/account");
  assert.equal(websitePostLoginPath("/download"), PORTAL_HOME);
  assert.equal(websitePostLoginPath("/wallet", true), "/wallet");
  assert.equal(websitePostLoginPath(null, true), APP_HOME);
});

test("desktop client is cookie or UA, not a public website signal", () => {
  assert.equal(isDesktopClient({}), false);
  assert.equal(isDesktopClient({ desktopCookie: "1" }), true);
  assert.equal(isDesktopClient({ userAgent: "Mozilla PoolIndexDesktop/0.1.2" }), true);
  assert.equal(isDesktopClient({ userAgent: "Mozilla/5.0 Electron/28.3.3" }), true);
  assert.equal(isDesktopClient({ userAgent: "Mozilla" }), false);
});
