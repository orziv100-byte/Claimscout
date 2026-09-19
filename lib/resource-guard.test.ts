import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  classifyPressure,
  liveSourceLimit,
  mapLimit,
  resetResourceGuardForTests,
  ResourcePressureError,
  withJob,
  type ResourceSnapshot,
} from "./resource-guard.ts";

afterEach(() => {
  resetResourceGuardForTests();
});

test("classifyPressure treats normal metrics as ok", () => {
  const result = classifyPressure({
    ramUsedRatio: 0.4,
    heapUsedRatio: 0.2,
    loadPerCpu: 0.3,
    diskUsedPct: 10,
  });
  assert.equal(result.level, "ok");
});

test("classifyPressure flags RAM exhaustion as critical before CPU warn", () => {
  const result = classifyPressure({
    ramUsedRatio: 0.92,
    heapUsedRatio: 0.2,
    loadPerCpu: 2,
    diskUsedPct: 10,
  });
  assert.equal(result.level, "critical");
  assert.equal(result.cause, "ram");
});

test("classifyPressure flags high CPU as warn", () => {
  const result = classifyPressure({
    ramUsedRatio: 0.4,
    heapUsedRatio: 0.2,
    loadPerCpu: 2,
    diskUsedPct: 10,
  });
  assert.equal(result.level, "warn");
  assert.equal(result.cause, "cpu");
});

test("liveSourceLimit is sequential unless the host is already critical", () => {
  assert.equal(liveSourceLimit({ level: "ok" }), 1);
  assert.equal(liveSourceLimit({ level: "warn" }), 1);
  assert.equal(liveSourceLimit({ level: "critical" }), 0);
});

test("mapLimit caps concurrency and limit 0 does no work", async () => {
  let current = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4], 2, async (n) => {
    current += 1;
    peak = Math.max(peak, current);
    await new Promise((r) => setTimeout(r, 15));
    current -= 1;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40]);
  assert.ok(peak <= 2);
  const skipped = await mapLimit([1, 2, 3], 0, async (n) => n);
  assert.deepEqual(skipped, []);
});

test("withJob refuses a second heavy task instead of queueing forever", async () => {
  let startedSecond = false;
  const first = withJob("scan-a", "heavy", async () => {
    await new Promise((r) => setTimeout(r, 40));
    return "ok";
  });
  await new Promise((r) => setTimeout(r, 5));
  await assert.rejects(
    async () => {
      startedSecond = true;
      await withJob("scan-b", "heavy", async () => "nope");
    },
    (err: unknown) => err instanceof ResourcePressureError && err.snapshot.cause === "jobs",
  );
  assert.equal(await first, "ok");
  assert.equal(startedSecond, true);
});

test("withJob coalesces identical keys instead of spawning a duplicate", async () => {
  let runs = 0;
  const a = withJob(
    "scan",
    "heavy",
    async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 30));
      return 1;
    },
    { coalesceKey: "search:uni" },
  );
  const b = withJob(
    "scan",
    "heavy",
    async () => {
      runs += 1;
      return 2;
    },
    { coalesceKey: "search:uni" },
  );
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra, 1);
  assert.equal(rb, 1);
  assert.equal(runs, 1);
});

test("ResourceSnapshot public fields stay serializable", () => {
  const snap: ResourceSnapshot = {
    level: "ok",
    message: "ok",
    rssMb: 1,
    heapUsedMb: 1,
    heapLimitMb: 10,
    ramUsedPct: 10,
    ramAvailableMb: 1000,
    load1: 0.1,
    cpuCount: 4,
    diskUsedPct: 5,
    diskFreeGb: 100,
    heavyJobs: 0,
    lightJobs: 0,
    jobs: [],
  };
  assert.equal(JSON.parse(JSON.stringify(snap)).level, "ok");
});
