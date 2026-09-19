import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { AuthError } from "./auth.ts";
import { submitFeedback } from "./feedback.ts";
import { CATALOG } from "./catalog.ts";
import {
  adminStopHunt,
  loadHuntForUser,
  pauseHunt,
  publicHunt,
  resumeHunt,
  returnDigest,
  silentAdapters,
  startHunt,
  stopHunt,
  tickHunt,
  type HuntAdapters,
  type HuntDeps,
} from "./intelligence/hunt.ts";
import { huntLimits } from "./intelligence/limits.ts";
import { saveHunt } from "./intelligence/store.ts";
import { leadFingerprint } from "./intelligence/fingerprint.ts";
import { aggregateFeedbackBySource, feedbackDoesNotAutoTrust } from "./intelligence/feedback-agg.ts";
import { communityOnly, canPromoteWithoutCorroboration, setSourceTierOverrides, tierForSource } from "./intelligence/reputation.ts";
import { assertPublicTarget, deriveTargets } from "./intelligence/trail.ts";
import { updateOps } from "./ops.ts";
import { SsrfError } from "./ssrf.ts";
import type { HuntRecord } from "./intelligence/types.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-intel-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.NODE_ENV = "test";

const USER_A = "user-alpha-01";
const USER_B = "user-bravo-01";
const WALLET_A = "0x1111111111111111111111111111111111111111";
const WALLET_B = "0x2222222222222222222222222222222222222222";

const DEPS: HuntDeps = {
  adapters: silentAdapters,
  resourceLevel: () => "ok",
  scansOpen: () => true,
  lookup: async () => ["93.184.216.34"],
};

before(() => {
  process.env.POOLINDEX_BETA_DIR = dir;
});

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env.POOLINDEX_BETA_DIR = dir;
  setSourceTierOverrides({});
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function drain(userId: string, huntId: string, deps: HuntDeps = DEPS, n = 50): Promise<HuntRecord> {
  let hunt = loadHuntForUser(userId, huntId);
  for (let i = 0; i < n; i += 1) {
    hunt = await tickHunt(userId, huntId, deps);
    if (hunt.status === "completed" || hunt.status === "paused" || hunt.status === "failed" || hunt.status === "stopped") {
      return hunt;
    }
  }
  return hunt;
}

test("free Deep Hunt is limited; Pro unlocks archive, wallet intel, continuous, and change detection", () => {
  const free = huntLimits("free");
  const paid = huntLimits("paid");
  assert.deepEqual([...free.sources], ["catalog", "github"]);
  assert.equal(free.walletIntel, false);
  assert.equal(free.continuous, false);
  assert.equal(free.changeDetection, false);
  assert.equal(free.historical, false);
  assert.equal(free.maxTrailDepth, 1);
  assert.ok(paid.sources.includes("wayback"));
  assert.ok(paid.sources.includes("archive_org"));
  assert.equal(paid.walletIntel, true);
  assert.equal(paid.continuous, true);
  assert.equal(paid.changeDetection, true);
});

test("Deep Hunt persists, pauses, resumes, stops, and keeps findings", async () => {
  const started = await startHunt(
    {
      userId: USER_A,
      plan: "free",
      query: "uniswap",
      seed: { catalogIds: ["uniswap-uni-airdrop"], discovered: [] },
    },
    DEPS,
  );
  assert.equal(started.status, "running");
  assert.ok(started.leads.length >= 1);
  assert.equal(started.progress.sourcesChecked, 0);
  const reloaded = loadHuntForUser(USER_A, started.id);
  assert.equal(reloaded.leads[0].projectName, started.leads[0].projectName);

  const paused = await pauseHunt(USER_A, started.id, "Paused by user.", DEPS);
  assert.equal(paused.status, "paused");
  const still = await tickHunt(USER_A, started.id, DEPS);
  assert.equal(still.status, "paused");
  assert.equal(still.leads.length, started.leads.length);

  const resumed = await resumeHunt(USER_A, started.id, DEPS);
  assert.equal(resumed.status, "running");
  const stopped = await stopHunt(USER_A, started.id, DEPS);
  assert.equal(stopped.status, "stopped");
  assert.ok(stopped.leads.length >= 1);
  const afterStop = await tickHunt(USER_A, started.id, DEPS);
  assert.equal(afterStop.status, "stopped");
});

test("failure during a source tick is stored and findings are not invented afterward", async () => {
  const adapters: HuntAdapters = {
    ...silentAdapters,
    searchGitHub: async () => {
      throw new Error("github down");
    },
  };
  const hunt = await startHunt({ userId: USER_A, plan: "free", query: "zzzz-no-such-protocol" }, { ...DEPS, adapters });
  assert.equal(hunt.progress.leadsCreated, 0);
  assert.equal(hunt.progress.sourcesChecked, 0);
  const failed = await drain(USER_A, hunt.id, { ...DEPS, adapters });
  assert.equal(failed.status, "failed");
  assert.match(failed.error || "", /github down/);
  assert.equal(failed.leads.length, 0);
});

test("catalog seed creates a reviewable lead with provenance; community-only stays investigating", async () => {
  const hunt = await startHunt(
    {
      userId: USER_A,
      plan: "free",
      query: "uniswap",
      seed: {
        catalogIds: ["uniswap-uni-airdrop"],
        discovered: [
          {
            id: "reddit-1",
            title: "Random forum rumor",
            summary: "Someone on a forum mentioned a mystery reward.",
            url: "https://reddit.com/r/ethereum/comments/rumor",
            kind: "airdrop",
            source: "reddit",
            sourceLabel: "Reddit",
            legitimacy: "unverified",
          },
        ],
      },
    },
    DEPS,
  );
  const uni = hunt.leads.find((lead) => lead.catalogId === "uniswap-uni-airdrop");
  assert.ok(uni);
  assert.equal(uni.status, "reviewable");
  assert.ok(uni.evidence.some((row) => row.type === "catalog" && row.sourceTier === "A"));
  assert.match(uni.why, /catalog/i);
  assert.equal(uni.eligibility, "unknown");
  assert.doesNotMatch(uni.why, /guaranteed/i);

  const rumor = hunt.leads.find((lead) => lead.discoverySource === "reddit");
  assert.ok(rumor);
  const finished = await drain(USER_A, hunt.id);
  const rumorAfter = finished.leads.find((lead) => lead.id === rumor.id);
  assert.ok(rumorAfter);
  assert.equal(rumorAfter.status, "investigating");
  assert.notEqual(rumorAfter.status, "reviewable");
});

test("duplicate discoveries merge into one fingerprint", async () => {
  const hunt = await startHunt(
    {
      userId: USER_A,
      plan: "free",
      query: "ens",
      seed: {
        catalogIds: ["ens-airdrop", "ens-airdrop"],
        discovered: [
          {
            id: "d1",
            title: "ENS token airdrop",
            summary: "mirror",
            url: "https://claim.ens.domains/",
            kind: "airdrop",
            source: "github",
            sourceLabel: "GitHub",
            catalogId: "ens-airdrop",
          },
          {
            id: "d2",
            title: "ENS token airdrop",
            summary: "another mirror",
            url: "https://claim.ens.domains/docs",
            kind: "airdrop",
            source: "github",
            sourceLabel: "GitHub",
            catalogId: "ens-airdrop",
          },
        ],
      },
    },
    DEPS,
  );
  const ens = hunt.leads.filter((lead) => lead.catalogId === "ens-airdrop");
  assert.equal(ens.length, 1);
  assert.ok(ens[0].mentionCount >= 2);
  assert.equal(leadFingerprint({ catalogId: "ens-airdrop", projectName: "ENS", kind: "airdrop" }), "catalog:ens-airdrop");
});

test("Follow the Trail respects depth, derived-target caps, and SSRF", async () => {
  const hunt = await startHunt(
    {
      userId: USER_A,
      plan: "paid",
      query: "uniswap",
      seed: { catalogIds: ["uniswap-uni-airdrop"], discovered: [] },
    },
    DEPS,
  );
  hunt.maxDerivedTargets = 1;
  hunt.maxTrailDepth = 1;
  saveHunt(hunt);
  const lead = hunt.leads[0];
  const targets = deriveTargets(lead, 1);
  assert.ok(targets.length >= 1);
  const finished = await drain(USER_A, hunt.id);
  assert.ok(finished.trailUsed <= 1);

  await assert.rejects(() => assertPublicTarget("http://127.0.0.1/secret"), SsrfError);
  await assert.rejects(() => assertPublicTarget("http://localhost/admin"), SsrfError);
});

test("wallet history never assumes eligibility and stays user-scoped", async () => {
  const adapters: HuntAdapters = {
    ...silentAdapters,
    checkEligibility: async (claimId, address) => ({
      claimId,
      address,
      status: "unknown",
      detail: "No address-level checker for this offer.",
    }),
  };
  await assert.rejects(
    () =>
      startHunt(
        { userId: USER_A, plan: "paid", query: "uniswap", wallet: WALLET_A, wallets: [], seed: { catalogIds: ["uniswap-uni-airdrop"], discovered: [] } },
        { ...DEPS, adapters },
      ),
    /Bind this public wallet/,
  );
  const hunt = await startHunt(
    {
      userId: USER_A,
      plan: "paid",
      query: "uniswap",
      wallet: WALLET_A,
      wallets: [WALLET_A],
      seed: { catalogIds: ["uniswap-uni-airdrop"], discovered: [] },
    },
    { ...DEPS, adapters },
  );
  const finished = await drain(USER_A, hunt.id, { ...DEPS, adapters });
  const uni = finished.leads.find((lead) => lead.catalogId === "uniswap-uni-airdrop");
  assert.ok(uni);
  assert.equal(uni.eligibility, "unknown");
  assert.notEqual(uni.status, "eligibility_confirmed");
  assert.match(uni.why, /not yet been confirmed/i);

  assert.throws(() => loadHuntForUser(USER_B, hunt.id), /Hunt not found/);
  const view = publicHunt(finished);
  assert.equal(view.userId, USER_A);
  assert.notEqual(view.wallet, WALLET_A);
});

test("source reputation: community sources cannot confirm opportunities", () => {
  assert.equal(tierForSource("reddit"), "D");
  assert.equal(communityOnly("D"), true);
  assert.equal(canPromoteWithoutCorroboration("reddit"), false);
  assert.equal(canPromoteWithoutCorroboration("catalog", "official"), true);
});

test("change detection and Continuous Hunt use stored state, not invented percentages", async () => {
  const first = await startHunt(
    { userId: USER_A, plan: "paid", query: "uniswap", seed: { catalogIds: ["uniswap-uni-airdrop"], discovered: [] } },
    DEPS,
  );
  const completed = await drain(USER_A, first.id);
  assert.equal(completed.status, "completed");
  assert.equal(Object.hasOwn(completed.progress, "percent"), false);

  await assert.rejects(
    () => startHunt({ userId: USER_A, plan: "free", query: "uniswap", mode: "continuous" }, DEPS),
    /Poolindex Pro/,
  );

  const next = await startHunt({ userId: USER_A, plan: "paid", query: "uniswap", mode: "continuous" }, DEPS);
  assert.equal(next.mode, "continuous");
  assert.equal(next.previousHuntId, completed.id);
  const done = await drain(USER_A, next.id);
  const digest = returnDigest(USER_A, done);
  assert.equal(digest.previousHuntId, completed.id);
  assert.ok(digest.sourcesRechecked >= 0);
  assert.equal(typeof digest.newLeads, "number");
});

test("feedback aggregates for admin review and does not auto-change source trust", () => {
  submitFeedback({ userId: USER_A, type: "not_relevant", source: "reddit", leadId: "lead-1" });
  submitFeedback({ userId: USER_A, type: "broken_link", source: "reddit" });
  submitFeedback({ userId: USER_A, type: "useful", source: "reddit" });
  const rows = aggregateFeedbackBySource();
  const reddit = rows.find((row) => row.source === "reddit");
  assert.ok(reddit);
  assert.equal(reddit.byType.not_relevant, 1);
  assert.equal(reddit.byType.broken_link, 1);
  assert.equal(reddit.byType.useful, 1);
  assert.equal(tierForSource("reddit"), "D");
  assert.equal(feedbackDoesNotAutoTrust("not_relevant"), true);
});

test("resource guard and kill switch pause Deep Hunt without fake work", async () => {
  const hunt = await startHunt({ userId: USER_A, plan: "free", query: "uniswap" }, DEPS);
  const paused = await tickHunt(USER_A, hunt.id, { ...DEPS, resourceLevel: () => "critical" });
  assert.equal(paused.status, "paused");
  assert.equal(paused.pauseReason, "Deep Hunt paused — server protection active.");

  const other = await startHunt({ userId: USER_B, plan: "free", query: "ens" }, DEPS);
  updateOps({ scansEnabled: false, reason: "kill switch test" }, USER_B);
  const killed = await tickHunt(USER_B, other.id, {
    adapters: silentAdapters,
    resourceLevel: () => "ok",
    lookup: DEPS.lookup,
  });
  assert.equal(killed.status, "paused");
  assert.match(killed.pauseReason || "", /stopped by the operator/);
  updateOps({ scansEnabled: true, reason: "" }, USER_B);
});

test("admin can stop another user's hunt; empty scans do not invent findings", async () => {
  const hunt = await startHunt({ userId: USER_A, plan: "free", query: "zzzz-no-such-protocol" }, DEPS);
  assert.equal(hunt.progress.rawDiscoveries, 0);
  const ticked = await tickHunt(USER_A, hunt.id, DEPS);
  assert.equal(ticked.progress.sourcesChecked, 1);
  assert.equal(ticked.leads.length, 0);
  const stopped = await adminStopHunt(hunt.id, DEPS);
  assert.equal(stopped.status, "stopped");
  assert.ok(CATALOG.length > 0);
});

test("Free hunt queue does not include Pro-only sources", async () => {
  const hunt = await startHunt({ userId: USER_A, plan: "free", query: "uniswap" }, DEPS);
  const sources = hunt.queue.filter((task) => task.kind === "source").map((task) => task.source);
  assert.deepEqual(sources, ["catalog", "github"]);
  const paid = await startHunt({ userId: USER_B, plan: "paid", query: "uniswap" }, DEPS);
  const paidSources = paid.queue.filter((task) => task.kind === "source").map((task) => task.source);
  assert.deepEqual(paidSources, ["catalog", "github", "wayback", "archive_org"]);
});
