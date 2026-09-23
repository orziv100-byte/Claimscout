import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { APP_VERSION } from "./app-info.ts";
import { macosInstaller, windowsInstaller } from "./windows-installer.ts";

test("Windows installer download is unpublished until an EXE exists on disk", () => {
  const root = mkdtempSync(join(tmpdir(), "poolindex-installer-"));
  const missing = windowsInstaller(root);
  assert.equal(missing.published, false);
  assert.equal(missing.href, null);
  assert.equal(missing.version, APP_VERSION);
  mkdirSync(join(root, "public", "downloads"), { recursive: true });
  writeFileSync(join(root, "public", "downloads", "PoolIndex.exe"), "stub");
  const published = windowsInstaller(root);
  assert.equal(published.published, true);
  assert.equal(published.href, "/downloads/PoolIndex.exe");
  rmSync(root, { recursive: true, force: true });
});

test("macOS installer stays unpublished until a zip or dmg exists on disk", () => {
  const root = mkdtempSync(join(tmpdir(), "poolindex-mac-"));
  const missing = macosInstaller(root);
  assert.equal(missing.published, false);
  assert.equal(missing.href, null);
  mkdirSync(join(root, "public", "downloads"), { recursive: true });
  writeFileSync(join(root, "public", "downloads", `PoolIndex-${APP_VERSION}-mac-arm64.zip`), "stub");
  const published = macosInstaller(root);
  assert.equal(published.published, true);
  assert.equal(published.href, `/downloads/PoolIndex-${APP_VERSION}-mac-arm64.zip`);
  rmSync(root, { recursive: true, force: true });
});

test("windows installer discovers the newest version even when APP_VERSION has drifted", () => {
  const root = mkdtempSync(join(tmpdir(), "poolindex-installer-drift-"));
  const dir = join(root, "public", "downloads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "PoolIndex-0.1.0-win.exe"), "stub");
  writeFileSync(join(dir, "PoolIndex-0.1.1-win.exe"), "stub");
  writeFileSync(join(dir, "PoolIndex-0.1.3-win.exe"), "stub");
  writeFileSync(join(dir, "PoolIndex-0.1.2-win.exe"), "stub");
  const result = windowsInstaller(root);
  assert.equal(result.published, true);
  assert.equal(result.version, "0.1.3");
  assert.equal(result.filename, "PoolIndex-0.1.3-win.exe");
  assert.equal(result.href, "/downloads/PoolIndex-0.1.3-win.exe");
  rmSync(root, { recursive: true, force: true });
});

test("macOS installer discovers the newest version across multiple builds", () => {
  const root = mkdtempSync(join(tmpdir(), "poolindex-mac-drift-"));
  const dir = join(root, "public", "downloads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "PoolIndex-0.1.0-mac-x64.zip"), "stub");
  writeFileSync(join(dir, "PoolIndex-0.1.2-mac-arm64.zip"), "stub");
  const result = macosInstaller(root);
  assert.equal(result.published, true);
  assert.equal(result.version, "0.1.2");
  assert.equal(result.filename, "PoolIndex-0.1.2-mac-arm64.zip");
  rmSync(root, { recursive: true, force: true });
});
