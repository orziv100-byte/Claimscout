import type { Address } from "viem";
import { scanCatalogEligibility } from "../onchain.ts";
import { ResourcePressureError, withJob } from "../resource-guard.ts";
import { eligibilityOverlay, publicEngineScan, scanWalletEngine } from "./scan.ts";
import { buildScanProgress } from "./progress.ts";
import { ENGINE_SOURCES } from "./sources.ts";
import type { ScanProgress } from "./types.ts";
import type { EligibilityResult } from "../types.ts";
import { getUserById } from "../auth.ts";
import { trackWalletScan } from "../telemetry.ts";
import { recordScanMcpEvents } from "./mcp-events.ts";

const JOB_TTL_MS = 30 * 60 * 1000;

export type WalletScanJobStatus = "running" | "done" | "failed";

export type WalletScanJobView = {
  status: WalletScanJobStatus;
  progress: ScanProgress;
  error?: string;
  address: string;
  eligibility?: EligibilityResult[];
  engine?: ReturnType<typeof publicEngineScan>;
};

type JobRecord = {
  address: Address;
  userId?: string;
  status: WalletScanJobStatus;
  progress: ScanProgress;
  error?: string;
  eligibility?: EligibilityResult[];
  engine?: ReturnType<typeof publicEngineScan>;
  startedAt: number;
  finishedAt?: number;
};

const jobs = new Map<string, JobRecord>();

function keyFor(address: string): string {
  return address.toLowerCase();
}

function pruneJobs(now = Date.now()) {
  for (const [key, job] of jobs) {
    const end = job.finishedAt ?? job.startedAt;
    if (job.status !== "running" && now - end > JOB_TTL_MS) jobs.delete(key);
  }
}

function emptyProgress(address: string, startedAt: number): ScanProgress {
  const natives = ENGINE_SOURCES.filter((source) => source.category === "native_balance");
  return buildScanProgress({
    address,
    startedAt,
    stage: "profile",
    natives,
    selected: natives,
    findings: [],
    timedOut: 0,
  });
}

function view(job: JobRecord): WalletScanJobView {
  return {
    status: job.status,
    progress: { ...job.progress, elapsedMs: Date.now() - job.startedAt },
    error: job.error,
    address: job.address,
    eligibility: job.eligibility,
    engine: job.engine,
  };
}

export function getWalletScanJob(address: string): WalletScanJobView | null {
  pruneJobs();
  const job = jobs.get(keyFor(address));
  return job ? view(job) : null;
}

function recordJob(job: JobRecord, status: "started" | "completed" | "failed") {
  if (!job.userId) return;
  const user = getUserById(job.userId);
  if (!user) return;
  trackWalletScan(user, {
    status,
    durationMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    potentialFindings: job.engine?.counters.potentialFindings,
    verifiedFindings: job.engine?.counters.verifiedFindings,
    sourcesChecked: job.engine?.counters.sourcesChecked,
    error: job.error,
  });
}

export function startWalletScanJob(address: Address, opts?: { userId?: string }): WalletScanJobView {
  pruneJobs();
  const key = keyFor(address);
  const existing = jobs.get(key);
  if (existing && existing.status === "running") return view(existing);

  const startedAt = Date.now();
  const job: JobRecord = {
    address,
    userId: opts?.userId,
    status: "running",
    progress: emptyProgress(address, startedAt),
    startedAt,
  };
  jobs.set(key, job);
  recordJob(job, "started");

  void withJob(
    "onchain-eligibility",
    "heavy",
    async () => {
      const engine = await scanWalletEngine(address, {
        onProgress: (progress) => {
          job.progress = progress;
        },
      });
      job.progress = {
        ...job.progress,
        currentSource: "catalog overlay",
        elapsedMs: Date.now() - job.startedAt,
      };
      const eligibility = await scanCatalogEligibility(address, eligibilityOverlay(engine));
      job.eligibility = eligibility;
      job.engine = publicEngineScan(engine);
      if (job.userId) recordScanMcpEvents(job.userId, engine);
      job.status = "done";
      job.finishedAt = Date.now();
      job.progress = {
        ...job.progress,
        stage: "done",
        currentSource: undefined,
        elapsedMs: job.finishedAt - job.startedAt,
        stages: job.progress.stages.map((stage) => ({ ...stage, status: "done" })),
      };
      recordJob(job, "completed");
    },
    { coalesceKey: `engine-scan:${key}` },
  ).catch((err) => {
    job.status = "failed";
    job.finishedAt = Date.now();
    if (err instanceof ResourcePressureError) {
      job.error = err.message;
    } else {
      job.error = err instanceof Error ? err.message : "Wallet scan failed";
    }
    recordJob(job, "failed");
  });

  return view(job);
}

export function resetWalletScanJobsForTests() {
  jobs.clear();
}
