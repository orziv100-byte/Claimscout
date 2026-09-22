import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { saveScan } from "../engine/state.ts";
import type { EngineScan } from "../engine/types.ts";
import { researchWalletClaim } from "./wallet.ts";
import type { HuntRecord } from "./types.ts";

test("Hunt wallet research uses engine overlay when a prior scan exists, and does not invent Eligible", async () => {
  const dir = mkdtempSync(join(tmpdir(), "poolindex-hunt-engine-"));
  const previous = process.env.POOLINDEX_ENGINE_DIR;
  process.env.POOLINDEX_ENGINE_DIR = dir;
  try {
    const address = "0x0000000000000000000000000000000000000001";
    const scan: EngineScan = {
      address,
      scannedAt: "2026-09-21T00:00:00.000Z",
      profile: { address, chains: [], tokens: [], protocols: [], contracts: [], relevantSourceIds: ["airdrop-uni-merkle"] },
      findings: [
        {
          id: "airdrop-uni-merkle:x",
          sourceId: "airdrop-uni-merkle",
          catalogId: "uniswap-uni-airdrop",
          category: "airdrop",
          chainId: 1,
          chainLabel: "Ethereum",
          verification: "verified",
          eligibility: "ineligible",
          title: "Uniswap UNI airdrop",
          detail: "Not in the official merkle chunk.",
          sourceStatus: "ok",
        },
      ],
      counters: { sourcesChecked: 1, sourcesFailed: 0, chainsChecked: 1, relevantSources: 1, potentialFindings: 0, verifiedFindings: 1 },
      summary: { adaptersChecked: 1, adaptersSucceeded: 1, adaptersFailed: 0, failures: [], verified: 1, uncertain: 0, rejected: 0 },
      sourceHealth: [],
      changes: [],
    };
    saveScan(scan);
    const hunt = {
      wallet: address,
      leads: [
        {
          catalogId: "uniswap-uni-airdrop",
          projectName: "Uniswap UNI airdrop",
          opportunityType: "airdrop",
          discoverySource: "catalog",
          evidence: [],
          statusHistory: [],
          mentionCount: 0,
          status: "discovered",
          walletRelevance: "no_evidence",
          eligibility: "unknown",
          claimWindow: "unknown",
          onchainEvidence: "none",
          historicalEvidence: "none",
          sourceConfidence: "unknown_source",
          risk: "needs_review",
          why: "",
        },
      ],
      progress: { pagesInspected: 0 },
    } as unknown as HuntRecord;
    const result = await researchWalletClaim(hunt, "uniswap-uni-airdrop", {
      checkEligibility: async () => {
        throw new Error("catalog checker should not run when engine overlay exists");
      },
    });
    assert.equal(result?.status, "ineligible");
    assert.equal(result?.checkKind, "wallet_level");
    assert.equal(hunt.progress.pagesInspected, 1);
  } finally {
    if (previous == null) delete process.env.POOLINDEX_ENGINE_DIR;
    else process.env.POOLINDEX_ENGINE_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
