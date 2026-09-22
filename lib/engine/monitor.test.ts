import assert from "node:assert/strict";
import { test } from "node:test";
import { alertableChanges, belowAlertNet, dailyMonitorAllowed, walletAlertMail } from "./monitor.ts";
import type { EngineScan } from "./types.ts";

function scan(partial: Partial<EngineScan> & Pick<EngineScan, "changes" | "findings">): EngineScan {
  return {
    address: "0x0000000000000000000000000000000000000001",
    scannedAt: "2026-01-02T00:00:00.000Z",
    profile: {
      address: "0x0000000000000000000000000000000000000001",
      chains: [],
      tokens: [],
      protocols: [],
      contracts: [],
      relevantSourceIds: [],
    },
    counters: {
      sourcesChecked: 1,
      sourcesFailed: 0,
      chainsChecked: 1,
      relevantSources: 1,
      potentialFindings: 1,
      verifiedFindings: 1,
    },
    summary: {
      adaptersChecked: 1,
      adaptersSucceeded: 1,
      adaptersFailed: 0,
      failures: [],
      verified: 1,
      uncertain: 0,
      rejected: 0,
    },
    ...partial,
  };
}

test("daily monitor skips Free unless explicit opt-in and always includes paid", () => {
  assert.equal(dailyMonitorAllowed({ plan: "free" }), false);
  assert.equal(dailyMonitorAllowed({ plan: "free", monitorEnabled: false }), false);
  assert.equal(dailyMonitorAllowed({ plan: "free", monitorEnabled: true }), true);
  assert.equal(dailyMonitorAllowed({ plan: "paid" }), true);
  assert.equal(dailyMonitorAllowed({ plan: "paid", monitorEnabled: false }), true);
});

test("monitor does not alert on the first baseline scan", () => {
  const first = scan({
    findings: [],
    changes: [{ kind: "baseline", findingId: "*", summary: "First engine scan for this address." }],
  });
  assert.deepEqual(alertableChanges(first), []);
});

test("monitor alerts when a verified airdrop becomes eligible", () => {
  const next = scan({
    findings: [
      {
        id: "airdrop-uni-merkle:x",
        sourceId: "airdrop-uni-merkle",
        category: "airdrop",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        eligibility: "eligible",
        title: "Uniswap UNI airdrop",
        detail: "in tree",
        sourceStatus: "ok",
      },
    ],
    changes: [{ kind: "status_changed", findingId: "airdrop-uni-merkle:x", summary: "eligible now" }],
  });
  assert.equal(alertableChanges(next).length, 1);
});

test("monitor does not alert on Uncertain or dust below estimated net", () => {
  const uncertain = scan({
    findings: [
      {
        id: "airdrop-uni-merkle:x",
        sourceId: "airdrop-uni-merkle",
        category: "airdrop",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "uncertain",
        title: "Uniswap UNI airdrop",
        detail: "unverifiable",
        sourceStatus: "ok",
      },
    ],
    changes: [{ kind: "status_changed", findingId: "airdrop-uni-merkle:x", summary: "uncertain" }],
  });
  assert.deepEqual(alertableChanges(uncertain), []);

  const dustFinding = {
    id: "token-eth-uni:x",
    sourceId: "token-eth-uni",
    category: "forgotten_token" as const,
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified" as const,
    title: "UNI",
    detail: "dust",
    amount: "0.01",
    symbol: "UNI",
    sourceStatus: "ok" as const,
    estimatedValueUsd: 0.4,
    roiConfidence: "medium" as const,
  };
  assert.equal(belowAlertNet(dustFinding), true);
  const dust = scan({
    findings: [dustFinding],
    changes: [{ kind: "new_finding", findingId: dustFinding.id, summary: "new dust" }],
  });
  assert.deepEqual(alertableChanges(dust), []);
});

test("monitor alerts on a closing deadline and on a source that failed after being healthy", () => {
  const closing = scan({
    findings: [
      {
        id: "airdrop-arb:x",
        sourceId: "airdrop-arb-distributor",
        category: "airdrop",
        chainId: 42161,
        chainLabel: "Arbitrum One",
        verification: "verified",
        eligibility: "window_closed",
        title: "Arbitrum ARB airdrop",
        detail: "closing",
        sourceStatus: "ok",
        deadlineStatus: "closing",
        deadlineLabel: "7 days remaining",
      },
    ],
    changes: [{ kind: "status_changed", findingId: "airdrop-arb:x", summary: "7 days remaining" }],
  });
  assert.equal(alertableChanges(closing).length, 1);

  const failed = scan({
    findings: [],
    changes: [{ kind: "source_failed", findingId: "airdrop-uni-merkle", summary: "RPC timeout" }],
  });
  assert.equal(alertableChanges(failed).length, 1);
});

test("Pro alert mail uses claim-window and verified-finding subjects", () => {
  const closing = scan({
    findings: [
      {
        id: "airdrop-arb:x",
        sourceId: "airdrop-arb-distributor",
        category: "airdrop",
        chainId: 42161,
        chainLabel: "Arbitrum One",
        verification: "verified",
        eligibility: "window_closed",
        title: "Arbitrum ARB airdrop",
        detail: "closing",
        sourceStatus: "ok",
        deadlineStatus: "closing",
        deadlineLabel: "7 days remaining",
      },
    ],
    changes: [{ kind: "status_changed", findingId: "airdrop-arb:x", summary: "7 days remaining" }],
  });
  const mail = walletAlertMail(closing.address, closing, alertableChanges(closing));
  assert.equal(mail.purpose, "claim_window_closing");
  assert.match(mail.subject, /claim window/i);

  const eligible = scan({
    findings: [
      {
        id: "airdrop-uni-merkle:x",
        sourceId: "airdrop-uni-merkle",
        category: "airdrop",
        chainId: 1,
        chainLabel: "Ethereum",
        verification: "verified",
        eligibility: "eligible",
        title: "Uniswap UNI airdrop",
        detail: "in tree",
        sourceStatus: "ok",
      },
    ],
    changes: [{ kind: "new_finding", findingId: "airdrop-uni-merkle:x", summary: "eligible now" }],
  });
  const eligibleMail = walletAlertMail(eligible.address, eligible, alertableChanges(eligible));
  assert.equal(eligibleMail.purpose, "eligibility_available");
});
