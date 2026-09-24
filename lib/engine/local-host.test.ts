import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { getLocalWalletScan, resetLocalWalletScansForTests, startLocalWalletScan } from "./local-host.ts";

test("local wallet host rejects secret-shaped input and does not invent a job", () => {
  const dir = mkdtempSync(join(tmpdir(), "poolindex-local-engine-"));
  const previous = process.env.POOLINDEX_ENGINE_DIR;
  process.env.POOLINDEX_ENGINE_DIR = dir;
  try {
    resetLocalWalletScansForTests();
    const rejected = startLocalWalletScan("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    assert.equal(rejected.status, "failed");
    assert.equal(rejected.storedLocally, true);
    const idle = getLocalWalletScan("not-an-address");
    assert.equal(idle.status, "idle");
  } finally {
    if (previous == null) delete process.env.POOLINDEX_ENGINE_DIR;
    else process.env.POOLINDEX_ENGINE_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
