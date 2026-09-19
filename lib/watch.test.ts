import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogClaim } from "./types.ts";
import {
  buildWatchSnapshot,
  diffWatchSnapshots,
  formatWatchDigest,
  openWatchPools,
} from "./watch.ts";

function claim(partial: Partial<CatalogClaim> & Pick<CatalogClaim, "id" | "title" | "status" | "asset">): CatalogClaim {
  return {
    kind: "airdrop",
    legitimacy: "official",
    chain: "ethereum",
    eligibility: "",
    howToVerify: "",
    warnings: [],
    sources: [],
    action: { type: "none", reason: "test" },
    tags: [],
    ...partial,
  };
}

test("first snapshot is a baseline, not a flood of new_offer events", () => {
  const next = buildWatchSnapshot(
    [claim({ id: "uniswap-uni-airdrop", title: "UNI", status: "unclaimed_remaining", asset: "UNI" })],
    [{ claimId: "uniswap-uni-airdrop", remaining: "1000", symbol: "UNI" }],
    "2026-09-19T00:00:00.000Z",
  );
  const changes = diffWatchSnapshots(null, next);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, "baseline");
});

test("diff reports new offers, status changes, and remaining-pool moves", () => {
  const prev = buildWatchSnapshot(
    [
      claim({ id: "uni", title: "UNI airdrop", status: "unclaimed_remaining", asset: "UNI" }),
      claim({ id: "arb", title: "ARB airdrop", status: "open", asset: "ARB" }),
    ],
    [
      { claimId: "uni", remaining: "1000", symbol: "UNI" },
      { claimId: "arb", remaining: "50", symbol: "ARB" },
    ],
    "2026-09-18T00:00:00.000Z",
  );
  const next = buildWatchSnapshot(
    [
      claim({ id: "uni", title: "UNI airdrop", status: "unclaimed_remaining", asset: "UNI" }),
      claim({ id: "ens", title: "ENS airdrop", status: "unclaimed_remaining", asset: "ENS" }),
    ],
    [
      { claimId: "uni", remaining: "800", symbol: "UNI" },
      { claimId: "ens", remaining: "12", symbol: "ENS" },
    ],
    "2026-09-19T00:00:00.000Z",
  );
  const kinds = diffWatchSnapshots(prev, next).map((change) => change.kind).sort();
  assert.deepEqual(kinds, ["new_offer", "pool_changed", "removed_offer"]);
});

test("tiny RPC jitter does not count as a pool change", () => {
  const prev = buildWatchSnapshot(
    [claim({ id: "uni", title: "UNI", status: "unclaimed_remaining", asset: "UNI" })],
    [{ claimId: "uni", remaining: "1000.00", symbol: "UNI" }],
  );
  const next = buildWatchSnapshot(
    [claim({ id: "uni", title: "UNI", status: "unclaimed_remaining", asset: "UNI" })],
    [{ claimId: "uni", remaining: "1000.40", symbol: "UNI" }],
  );
  assert.deepEqual(diffWatchSnapshots(prev, next), []);
});

test("openWatchPools skips expired archives and formats a digest", () => {
  const snapshot = buildWatchSnapshot(
    [
      claim({ id: "uni", title: "UNI", status: "unclaimed_remaining", asset: "UNI" }),
      claim({ id: "old", title: "Old faucet", status: "archived", asset: "BTC" }),
    ],
    [
      { claimId: "uni", remaining: "12.5", symbol: "UNI" },
      { claimId: "old", remaining: "1", symbol: "BTC" },
    ],
    "2026-09-19T12:00:00.000Z",
  );
  const open = openWatchPools(snapshot);
  assert.equal(open.length, 1);
  assert.equal(open[0].claimId, "uni");
  const digest = formatWatchDigest({
    capturedAt: snapshot.capturedAt,
    changes: diffWatchSnapshots(null, snapshot),
    openPools: open,
  });
  assert.match(digest, /Initial catalog watch/);
  assert.match(digest, /UNI: 12\.5 UNI/);
});
