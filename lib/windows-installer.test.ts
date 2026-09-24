import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { macosInstaller, windowsInstaller } from "./windows-installer.ts";

test("windowsInstaller picks the highest semver EXE and does not invent a download", () => {
  const root = mkdtempSync(join(tmpdir(), "poolindex-installer-"));
  try {
    mkdirSync(join(root, "public", "downloads"), { recursive: true });
    assert.equal(windowsInstaller(root).published, false);
    writeFileSync(join(root, "public", "downloads", "PoolIndex-0.1.0-win.exe"), "old");
    writeFileSync(join(root, "public", "downloads", "PoolIndex-0.1.3-win.exe"), "new");
    const installer = windowsInstaller(root);
    assert.equal(installer.published, true);
    assert.equal(installer.filename, "PoolIndex-0.1.3-win.exe");
    assert.equal(installer.href, "/downloads/PoolIndex-0.1.3-win.exe");
    assert.equal(macosInstaller(root).published, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
