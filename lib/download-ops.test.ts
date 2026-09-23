import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  countDownloadEvents,
  downloadsPaused,
  installerFilenameFromPath,
  isDownloadPagePath,
  isInstallerDownloadPath,
  isLoopbackHost,
  listPublishedInstallers,
  readDownloadControl,
  recordDownloadEvent,
  sanitizeLoggedIp,
  writeDownloadControl,
} from "./download-ops.ts";

test("download ops stay local, pause files, and never treat spoof paths as installers", () => {
  const root = mkdtempSync(join(tmpdir(), "poolindex-dl-"));
  mkdirSync(join(root, "public", "downloads"), { recursive: true });
  writeFileSync(join(root, "public", "downloads", "PoolIndex-0.1.2-win.exe"), "installer");
  assert.equal(downloadsPaused(root), false);
  writeDownloadControl({ paused: true, reason: "Closed Beta hold" }, root);
  assert.equal(readDownloadControl(root).paused, true);
  assert.equal(downloadsPaused(root), true);
  assert.equal(installerFilenameFromPath("/downloads/PoolIndex-0.1.2-win.exe"), "PoolIndex-0.1.2-win.exe");
  assert.equal(installerFilenameFromPath("/downloads/../.env"), null);
  assert.equal(installerFilenameFromPath("/downloads/.env"), null);
  assert.equal(isInstallerDownloadPath("/downloads/PoolIndex-0.1.2-win.exe"), true);
  assert.equal(isDownloadPagePath("/download"), true);
  recordDownloadEvent({ kind: "file", path: "/downloads/PoolIndex-0.1.2-win.exe", ip: "203.0.113.9" }, root);
  recordDownloadEvent({ kind: "page", path: "/download", ip: "not-an-ip" }, root);
  const counts = countDownloadEvents(root);
  assert.equal(counts.files["PoolIndex-0.1.2-win.exe"], 1);
  assert.equal(counts.pages, 1);
  assert.equal(sanitizeLoggedIp("x-real-ip-spoof"), "unknown");
  assert.equal(isLoopbackHost("127.0.0.1:43148"), true);
  assert.equal(isLoopbackHost("[::1]:43148"), true);
  assert.equal(isLoopbackHost("poolindex.app"), false);
  assert.deepEqual(listPublishedInstallers(root).map((row) => row.name), ["PoolIndex-0.1.2-win.exe"]);
  const ops = readFileSync(new URL("./download-ops.ts", import.meta.url), "utf8");
  assert.match(ops, /INTERNAL_ADMIN_PORT = 43148/);
  assert.match(ops, /INTERNAL_ADMIN_BIND = "127\.0\.0\.1"/);
  const script = readFileSync(new URL("../scripts/internal-download-admin.ts", import.meta.url), "utf8");
  assert.match(script, /INTERNAL_ADMIN_PORT/);
  assert.match(script, /listen\(PORT, BIND/);
  assert.doesNotMatch(script, /listen\([^)]*poolindex\.app/);
  assert.doesNotMatch(script, /0\.0\.0\.0/);
  const unit = readFileSync(new URL("../systemd/poolindex-internal-admin.service", import.meta.url), "utf8");
  assert.match(unit, /internal-download-admin/);
  assert.doesNotMatch(unit, /0\.0\.0\.0/);
  const origin = readFileSync(new URL("../desktop/origin.cjs", import.meta.url), "utf8");
  assert.doesNotMatch(origin, /43148/);
  rmSync(root, { recursive: true, force: true });
});
