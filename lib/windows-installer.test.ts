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
