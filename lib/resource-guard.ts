import { cpus, freemem, loadavg, totalmem } from "node:os";
import { readFileSync, statfsSync } from "node:fs";
import { getHeapStatistics } from "node:v8";

export type PressureLevel = "ok" | "warn" | "critical";
export type PressureCause = "ram" | "heap" | "cpu" | "disk" | "jobs";
export type JobKind = "heavy" | "light";

export type ResourceSnapshot = {
  level: PressureLevel;
  cause?: PressureCause;
  message: string;
  rssMb: number;
  heapUsedMb: number;
  heapLimitMb: number;
  ramUsedPct: number;
  ramAvailableMb: number;
  load1: number;
  cpuCount: number;
  diskUsedPct: number;
  diskFreeGb: number;
  heavyJobs: number;
  lightJobs: number;
  jobs: { name: string; kind: JobKind; elapsedMs: number }[];
};

export class ResourcePressureError extends Error {
  readonly code = "RESOURCE_PRESSURE" as const;

  constructor(
    message: string,
    readonly snapshot: ResourceSnapshot,
    readonly retryAfterSec = 20,
  ) {
    super(message);
    this.name = "ResourcePressureError";
  }
}

const HEAVY_LIMIT = 1;
const LIGHT_LIMIT = 2;

const RAM_WARN = 0.75;
const RAM_CRIT = 0.88;
const HEAP_WARN = 0.75;
const HEAP_CRIT = 0.88;
const LOAD_WARN = 1.75;
const LOAD_CRIT = 3;
const DISK_WARN = 88;
const DISK_CRIT = 95;

type ActiveJob = { name: string; kind: JobKind; startedAt: number };

const inFlight: Record<JobKind, number> = { heavy: 0, light: 0 };
const activeJobs: ActiveJob[] = [];
const coalesced = new Map<string, Promise<unknown>>();

export function classifyPressure(input: {
  ramUsedRatio: number;
  heapUsedRatio: number;
  loadPerCpu: number;
  diskUsedPct: number;
}): { level: PressureLevel; cause?: PressureCause; message: string } {
  const checks: { level: PressureLevel; cause: PressureCause; hit: boolean; message: string }[] = [
    {
      level: "critical",
      cause: "ram",
      hit: input.ramUsedRatio >= RAM_CRIT,
      message: `RAM exhaustion risk (${pct(input.ramUsedRatio)} used).`,
    },
    {
      level: "critical",
      cause: "heap",
      hit: input.heapUsedRatio >= HEAP_CRIT,
      message: `Node heap near limit (${pct(input.heapUsedRatio)} used).`,
    },
    {
      level: "critical",
      cause: "disk",
      hit: input.diskUsedPct >= DISK_CRIT,
      message: `Disk pressure (${input.diskUsedPct.toFixed(1)}% used).`,
    },
    {
      level: "critical",
      cause: "cpu",
      hit: input.loadPerCpu >= LOAD_CRIT,
      message: `CPU overload (load ${input.loadPerCpu.toFixed(2)} per core).`,
    },
    {
      level: "warn",
      cause: "ram",
      hit: input.ramUsedRatio >= RAM_WARN,
      message: `High RAM use (${pct(input.ramUsedRatio)}). Reducing concurrency.`,
    },
    {
      level: "warn",
      cause: "heap",
      hit: input.heapUsedRatio >= HEAP_WARN,
      message: `High heap use (${pct(input.heapUsedRatio)}). Reducing concurrency.`,
    },
    {
      level: "warn",
      cause: "disk",
      hit: input.diskUsedPct >= DISK_WARN,
      message: `Disk filling (${input.diskUsedPct.toFixed(1)}% used).`,
    },
    {
      level: "warn",
      cause: "cpu",
      hit: input.loadPerCpu >= LOAD_WARN,
      message: `High CPU load (${input.loadPerCpu.toFixed(2)} per core). Prefer sequential work.`,
    },
  ];

  const first = checks.find((c) => c.hit);
  if (!first) {
    return { level: "ok", message: "Resources within safe limits." };
  }
  return { level: first.level, cause: first.cause, message: first.message };
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function readMeminfo(): { total: number; available: number } {
  try {
    const text = readFileSync("/proc/meminfo", "utf8");
    const totalKb = Number(/MemTotal:\s+(\d+)/.exec(text)?.[1]);
    const availableKb = Number(/MemAvailable:\s+(\d+)/.exec(text)?.[1]);
    if (Number.isFinite(totalKb) && Number.isFinite(availableKb) && totalKb > 0) {
      return { total: totalKb * 1024, available: availableKb * 1024 };
    }
  } catch {
    /* fall through */
  }
  return { total: totalmem(), available: freemem() };
}

function readDisk(): { usedPct: number; freeGb: number } {
  try {
    const s = statfsSync("/");
    const total = Number(s.blocks) * Number(s.bsize);
    const free = Number(s.bavail) * Number(s.bsize);
    if (!Number.isFinite(total) || total <= 0) return { usedPct: 0, freeGb: 0 };
    return {
      usedPct: (1 - free / total) * 100,
      freeGb: free / 1024 ** 3,
    };
  } catch {
    return { usedPct: 0, freeGb: 0 };
  }
}

export function readResourceSnapshot(): ResourceSnapshot {
  const mem = readMeminfo();
  const ramUsedRatio = mem.total > 0 ? 1 - mem.available / mem.total : 0;
  const heap = process.memoryUsage();
  const heapLimit = getHeapStatistics().heap_size_limit;
  const heapUsedRatio = heapLimit > 0 ? heap.heapUsed / heapLimit : 0;
  const cpuCount = Math.max(1, cpus().length);
  const load1 = loadavg()[0] ?? 0;
  const disk = readDisk();
  const classified = classifyPressure({
    ramUsedRatio,
    heapUsedRatio,
    loadPerCpu: load1 / cpuCount,
    diskUsedPct: disk.usedPct,
  });

  return {
    level: classified.level,
    cause: classified.cause,
    message: classified.message,
    rssMb: Math.round(heap.rss / 1024 / 1024),
    heapUsedMb: Math.round(heap.heapUsed / 1024 / 1024),
    heapLimitMb: Math.round(heapLimit / 1024 / 1024),
    ramUsedPct: Math.round(ramUsedRatio * 1000) / 10,
    ramAvailableMb: Math.round(mem.available / 1024 / 1024),
    load1: Math.round(load1 * 100) / 100,
    cpuCount,
    diskUsedPct: Math.round(disk.usedPct * 10) / 10,
    diskFreeGb: Math.round(disk.freeGb * 10) / 10,
    heavyJobs: inFlight.heavy,
    lightJobs: inFlight.light,
    jobs: activeJobs.map((job) => ({
      name: job.name,
      kind: job.kind,
      elapsedMs: Date.now() - job.startedAt,
    })),
  };
}

/** Live source fan-out. Always sequential; 0 when the machine is already critical. */
export function liveSourceLimit(snapshot: Pick<ResourceSnapshot, "level"> = readResourceSnapshot()): number {
  return snapshot.level === "critical" ? 0 : 1;
}

export function shouldSkipOptionalWork(snapshot = readResourceSnapshot()): boolean {
  return snapshot.level !== "ok";
}

export function publicSnapshot(snapshot: ResourceSnapshot) {
  return {
    level: snapshot.level,
    cause: snapshot.cause,
    message: snapshot.message,
    ramUsedPct: snapshot.ramUsedPct,
    ramAvailableMb: snapshot.ramAvailableMb,
    rssMb: snapshot.rssMb,
    heapUsedMb: snapshot.heapUsedMb,
    heapLimitMb: snapshot.heapLimitMb,
    load1: snapshot.load1,
    cpuCount: snapshot.cpuCount,
    diskUsedPct: snapshot.diskUsedPct,
    diskFreeGb: snapshot.diskFreeGb,
    heavyJobs: snapshot.heavyJobs,
    lightJobs: snapshot.lightJobs,
    jobs: snapshot.jobs,
  };
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  shouldStop?: () => boolean,
): Promise<R[]> {
  if (limit <= 0 || items.length === 0) return [];
  const out: R[] = [];
  let next = 0;
  async function worker() {
    while (true) {
      if (shouldStop?.()) return;
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out.filter((_, index) => Object.prototype.hasOwnProperty.call(out, index));
}

export async function withJob<T>(
  name: string,
  kind: JobKind,
  fn: () => Promise<T>,
  opts: { signal?: AbortSignal; coalesceKey?: string } = {},
): Promise<T> {
  if (opts.signal?.aborted) {
    throw abortError();
  }

  if (opts.coalesceKey) {
    const existing = coalesced.get(opts.coalesceKey);
    if (existing) return existing as Promise<T>;
  }

  const snapshot = readResourceSnapshot();
  if (snapshot.level === "critical") {
    throw new ResourcePressureError(
      `Stopped ${name} before start: ${snapshot.message} Stability has priority over speed.`,
      snapshot,
    );
  }

  const limit = kind === "heavy" ? HEAVY_LIMIT : LIGHT_LIMIT;
  if (inFlight[kind] >= limit) {
    const busy = activeJobs.map((job) => job.name).join(", ") || kind;
    throw new ResourcePressureError(
      `Stopped ${name}: another ${kind} task is already running (${busy}). Prefer one stable task at a time.`,
      {
        ...snapshot,
        level: "critical",
        cause: "jobs",
        message: `Too many parallel ${kind} jobs (limit ${limit}).`,
      },
    );
  }

  const run = (async () => {
    inFlight[kind] += 1;
    const rec: ActiveJob = { name, kind, startedAt: Date.now() };
    activeJobs.push(rec);
    try {
      if (opts.signal?.aborted) throw abortError();
      return await fn();
    } finally {
      inFlight[kind] = Math.max(0, inFlight[kind] - 1);
      const idx = activeJobs.indexOf(rec);
      if (idx >= 0) activeJobs.splice(idx, 1);
    }
  })();

  if (opts.coalesceKey) {
    coalesced.set(opts.coalesceKey, run);
    void run.finally(() => {
      if (coalesced.get(opts.coalesceKey!) === run) coalesced.delete(opts.coalesceKey!);
    });
  }

  return run;
}

function abortError(): Error {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

/** Test-only: clear in-flight counters so unit tests do not leak across cases. */
export function resetResourceGuardForTests() {
  inFlight.heavy = 0;
  inFlight.light = 0;
  activeJobs.splice(0, activeJobs.length);
  coalesced.clear();
}
