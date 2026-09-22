import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { AuthError } from "../auth.ts";
import {
  approveRepair,
  detectBrokenSource,
  diagnoseRepair,
  getSourcePause,
  pausedFinding,
  rejectRepair,
  restoreRepair,
  suggestRepairAction,
} from "./repair.ts";
import { resetRepairStateForTests } from "./repair-store.ts";
import { ENGINE_SOURCES } from "./sources.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-repair-"));
const beta = mkdtempSync(join(tmpdir(), "poolindex-repair-beta-"));
process.env.POOLINDEX_ENGINE_DIR = dir;
process.env.POOLINDEX_BETA_DIR = beta;

const uni = ENGINE_SOURCES.find((source) => source.id === "airdrop-uni-merkle");
if (!uni) throw new Error("airdrop-uni-merkle source missing");

beforeEach(() => {
  process.env.POOLINDEX_ENGINE_DIR = dir;
  process.env.POOLINDEX_BETA_DIR = beta;
  resetRepairStateForTests();
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(beta, { recursive: true, force: true });
});

test("repair diagnosis maps bytecode, timeout, and self-destruct without inventing eligibility", () => {
  assert.equal(diagnoseRepair("MerkleDistributor has no contract code"), "no_bytecode");
  assert.equal(diagnoseRepair("Source timed out after 30s"), "timeout");
  assert.equal(diagnoseRepair("self-destructed after the 2023-09-24 claim deadline"), "self_destruct");
  assert.equal(suggestRepairAction("no_bytecode"), "skip_until_restored");
  assert.equal(suggestRepairAction("timeout"), "keep_reporting");
});

test("detect opens one sandbox case and does not pause until approve", () => {
  const health = {
    id: uni.id,
    status: "failed" as const,
    lastError: "Official merkle distributor currently has no contract code",
    consecutiveFailures: 2,
  };
  const first = detectBrokenSource({ source: uni, health, now: "2026-09-21T00:00:00.000Z" });
  const second = detectBrokenSource({ source: uni, health, now: "2026-09-21T01:00:00.000Z" });
  assert.equal(first?.status, "proposed");
  assert.equal(first?.diagnosis, "no_bytecode");
  assert.equal(second?.id, first?.id);
  assert.equal(second?.updatedAt, "2026-09-21T01:00:00.000Z");
  assert.equal(getSourcePause(uni.id), null);
});

test("without Approve there is no Restore; Approve skip can later Restore", () => {
  detectBrokenSource({
    source: uni,
    health: {
      id: uni.id,
      status: "failed",
      lastError: "TokenDistributor self-destructed after deadline",
      consecutiveFailures: 1,
    },
  });
  assert.throws(() => restoreRepair(uni.id, "admin"), (err: unknown) => {
    assert.ok(err instanceof AuthError);
    assert.equal(err.code, "REPAIR_NOT_APPROVED");
    return true;
  });
  const approved = approveRepair(uni.id, "admin", "2026-09-21T02:00:00.000Z");
  assert.equal(approved.status, "approved");
  assert.equal(approved.appliedAction, "skip_until_restored");
  assert.equal(getSourcePause(uni.id)?.approvedBy, "admin");
  const finding = pausedFinding(uni, getSourcePause(uni.id)?.reason ?? "");
  assert.equal(finding.sourceStatus, "skipped");
  assert.match(finding.detail, /No eligibility was invented/);
  const restored = restoreRepair(uni.id, "admin", "2026-09-21T03:00:00.000Z");
  assert.equal(restored.status, "restored");
  assert.equal(getSourcePause(uni.id), null);
});

test("reject leaves the live adapter running", () => {
  detectBrokenSource({
    source: uni,
    health: {
      id: uni.id,
      status: "failed",
      lastError: "Source timed out after 30s",
      consecutiveFailures: 1,
    },
  });
  const rejected = rejectRepair(uni.id, "admin");
  assert.equal(rejected.status, "rejected");
  assert.equal(getSourcePause(uni.id), null);
  const again = detectBrokenSource({
    source: uni,
    health: {
      id: uni.id,
      status: "failed",
      lastError: "Source timed out after 30s",
      consecutiveFailures: 2,
    },
  });
  assert.equal(again?.status, "rejected");
});
