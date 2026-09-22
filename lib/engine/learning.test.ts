import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { submitFeedback } from "../feedback.ts";
import { ENGINE_SOURCES, ENGINE_WALLET_LEVEL_CATALOG_IDS } from "./sources.ts";
import {
  decideSourceProposal,
  learningDoesNotMutateProduction,
  listCompetitors,
  operatorLearningSnapshot,
} from "./learning.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-learn-"));
const beta = mkdtempSync(join(tmpdir(), "poolindex-learn-beta-"));
process.env.POOLINDEX_ENGINE_DIR = dir;
process.env.POOLINDEX_BETA_DIR = beta;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.NODE_ENV = "test";

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(beta, { recursive: true, force: true });
  process.env.POOLINDEX_ENGINE_DIR = dir;
  process.env.POOLINDEX_BETA_DIR = beta;
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(beta, { recursive: true, force: true });
});

test("operator learning lists competitors and catalog gaps without adding adapters", () => {
  const before = ENGINE_SOURCES.length;
  const snap = operatorLearningSnapshot();
  assert.equal(snap.autoProductionChanges, false);
  assert.equal(learningDoesNotMutateProduction(), true);
  assert.equal(listCompetitors().some((row) => row.license === "MIT"), true);
  assert.equal(listCompetitors().some((row) => row.stance === "architecture_only"), true);
  const uni = snap.proposals.find((row) => row.catalogId === "uniswap-uni-airdrop");
  assert.equal(uni, undefined);
  const blur = snap.proposals.find((row) => row.catalogId === "blur-airdrop");
  assert.equal(blur?.origin, "catalog_gap");
  assert.match(blur?.detail ?? "", /Request Coverage/);
  const jito = snap.proposals.find((row) => row.catalogId === "jito-solana-airdrop");
  assert.equal(jito?.origin, "catalog_gap");
  assert.equal(jito?.status, "queued");
  assert.equal(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("jito-solana-airdrop"), false);
  const accepted = decideSourceProposal(jito!.id, "accepted", "admin");
  assert.equal(accepted.status, "accepted");
  assert.equal(ENGINE_SOURCES.length, before);
  assert.equal(ENGINE_WALLET_LEVEL_CATALOG_IDS.has("jito-solana-airdrop"), false);
});

test("public feedback becomes a research proposal and does not change production sources", () => {
  const before = ENGINE_SOURCES.length;
  submitFeedback({
    userId: "user-learn-01",
    type: "report_problem",
    note: "ENS merkle returned 500",
    source: "catalog",
    claimId: "blur-airdrop",
  });
  const snap = operatorLearningSnapshot();
  const row = snap.proposals.find((item) => item.id === "feedback:blur-airdrop");
  assert.equal(row?.origin, "feedback");
  assert.match(row?.detail ?? "", /does not change adapter trust/);
  assert.equal(ENGINE_SOURCES.length, before);
});
