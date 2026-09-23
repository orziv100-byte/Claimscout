import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const origin = require("../desktop/origin.cjs") as {
  APP_ORIGIN: string;
  START_URL: string;
  UPDATE_FEED: string;
  isAllowedNavigation: (url: string) => boolean;
  isLivePaypal: (url: string) => boolean;
  isExternalHttps: (url: string) => boolean;
  isGoogleAuthStart: (url: string) => boolean;
};

test("desktop shell only navigates to poolindex.app and PayPal Sandbox", () => {
  assert.equal(origin.APP_ORIGIN, "https://poolindex.app");
  assert.equal(origin.START_URL, "https://poolindex.app/app");
  assert.equal(origin.UPDATE_FEED, "https://poolindex.app/downloads");
  assert.equal(origin.isAllowedNavigation("https://poolindex.app/login"), true);
  assert.equal(origin.isAllowedNavigation("https://poolindex.app/upgrade"), true);
  assert.equal(origin.isAllowedNavigation("https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=x"), true);
  assert.equal(origin.isAllowedNavigation("https://www.paypal.com/checkoutnow"), false);
  assert.equal(origin.isLivePaypal("https://www.paypal.com/checkoutnow"), true);
  assert.equal(origin.isAllowedNavigation("file:///etc/passwd"), false);
  assert.equal(origin.isAllowedNavigation("https://evil.example/phish"), false);
  assert.equal(origin.isExternalHttps("https://github.com/example"), true);
  assert.equal(origin.isGoogleAuthStart("https://poolindex.app/api/auth/google/start?intent=login"), true);
  assert.equal(origin.isAllowedNavigation("https://accounts.google.com/o/oauth2/v2/auth"), false);
});

test("desktop shell source does not embed server secrets", () => {
  const dir = fileURLToPath(new URL("../desktop/", import.meta.url));
  for (const name of ["main.cjs", "preload.cjs", "origin.cjs", "electron-builder.yml", "package.json"]) {
    const text = readFileSync(join(dir, name), "utf8");
    assert.doesNotMatch(text, /GOOGLE_CLIENT_SECRET\s*[:=]\s*\S+/);
    assert.doesNotMatch(text, /PAYPAL_CLIENT_SECRET\s*[:=]\s*\S+/);
    assert.doesNotMatch(text, /POOLINDEX_SESSION_SECRET\s*[:=]\s*\S+/);
    assert.doesNotMatch(text, /POOLINDEX_PLAN_SECRET/);
    assert.doesNotMatch(text, /BEGIN PRIVATE KEY/);
  }
});

test("Windows unpacked runtime keeps required Electron files", () => {
  const unpacked = fileURLToPath(new URL("../desktop/dist/win-unpacked/", import.meta.url));
  const required = [
    "PoolIndex.exe",
    "d3dcompiler_47.dll",
    "ffmpeg.dll",
    "icudtl.dat",
    "libEGL.dll",
    "libGLESv2.dll",
    "resources.pak",
    "chrome_100_percent.pak",
    "chrome_200_percent.pak",
    "snapshot_blob.bin",
    "v8_context_snapshot.bin",
    "vk_swiftshader.dll",
    "locales",
    "resources",
  ];
  for (const name of required) {
    assert.equal(existsSync(join(unpacked, name)), true, `missing ${name}`);
  }
});

test("Closed Beta desktop stays unsigned on Windows and macOS", () => {
  const dir = fileURLToPath(new URL("../desktop/", import.meta.url));
  const yml = readFileSync(join(dir, "electron-builder.yml"), "utf8");
  const pkg = readFileSync(join(dir, "package.json"), "utf8");
  const main = readFileSync(join(dir, "main.cjs"), "utf8");
  assert.match(yml, /forceCodeSigning:\s*false/);
  assert.match(yml, /signAndEditExecutable:\s*false/);
  assert.match(yml, /identity:\s*null/);
  assert.match(yml, /target:\s*zip/);
  assert.doesNotMatch(yml, /certificateFile:/);
  assert.match(pkg, /dist:mac/);
  assert.match(pkg, /--mac zip/);
  assert.match(main, /process\.platform !== "darwin"/);
  assert.match(main, /google-auth-start/);
  assert.match(main, /PoolIndexDesktop/);
  assert.match(main, /poolindex_desktop/);
  assert.match(yml, /oneClick:\s*true/);
  assert.match(yml, /schemes:[\s\S]*poolindex/);
  const versionRoute = readFileSync(new URL("../app/api/desktop/version/route.ts", import.meta.url), "utf8");
  assert.match(versionRoute, /signed:\s*false/);
  assert.match(versionRoute, /macos:/);
  const nsh = readFileSync(join(dir, "build", "installer.nsh"), "utf8");
  const close = readFileSync(join(dir, "build", "close-poolindex.nsh"), "utf8");
  const oneClick = readFileSync(join(dir, "installer-oneclick.nsi"), "utf8");
  assert.match(nsh, /MUI_BGCOLOR/);
  assert.doesNotMatch(nsh, /GOOGLE_CLIENT_SECRET/);
  assert.match(nsh, /customCheckAppRunning/);
  assert.match(nsh, /ClosePoolIndexOrAbort/);
  assert.match(nsh, /ProbePoolIndexRuntimeWritable/);
  assert.match(nsh, /ifndef BUILD_UNINSTALLER/);
  assert.match(yml, /allowElevation:\s*false/);
  assert.match(close, /taskkill\.exe" \/F \/IM "\$\{_IMAGE\}"/);
  assert.doesNotMatch(close, /taskkill\.exe" \/IM "\$\{_IMAGE\}"\r?\n/);
  assert.doesNotMatch(close, /taskkill\.exe" \/F \/T/);
  assert.match(close, /Do not Ignore locked files/);
  assert.doesNotMatch(close, /taskkill[^\n]+chrome\.exe/i);
  assert.doesNotMatch(close, /taskkill[^\n]+electron\.exe/i);
  assert.match(oneClick, /ClosePoolIndexOrAbort/);
  assert.match(oneClick, /ProbePoolIndexRuntimeWritable/);
  assert.match(oneClick, /SetOverwrite on/);
  assert.doesNotMatch(oneClick, /SetOverwrite try/);
  assert.doesNotMatch(oneClick, /File \/nonfatal/);
  assert.doesNotMatch(oneClick, /RMDir.*APPDATA/i);
  assert.match(oneClick, /Keep %APPDATA%\\PoolIndex/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /before-quit/);
  assert.match(main, /destroyAllWindows/);
  assert.match(main, /quitPoolIndex/);
});
