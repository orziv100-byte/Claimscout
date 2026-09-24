import type { Address } from "viem";
import { scanCatalogEligibility } from "../onchain.ts";
import { parsePublicAddress } from "../address.ts";
import { looksLikeSecretMaterial } from "../secrets-guard.ts";
import { ResourcePressureError, withJob } from "../resource-guard.ts";
import { eligibilityOverlay, publicEngineScan, scanWalletEngine } from "./scan.ts";
import { buildScanProgress } from "./progress.ts";
import { ENGINE_SOURCES } from "./sources.ts";
import { loadPreviousScan, loadScanHistory } from "./state.ts";
import type { ScanProgress } from "./types.ts";
import type { EligibilityResult } from "../types.ts";

export type LocalWalletScanStatus = "running" | "done" | "failed" | "idle";

export type LocalWalletScanView = {
  status: LocalWalletScanStatus;
  progress?: ScanProgress;
  error?: string;
  address?: string;
  eligibility?: EligibilityResult[];
  engine?: ReturnType<typeof publicEngineScan>;
  storedLocally: true;
};

type JobRecord = {
  address: Address;
  status: Exclude<LocalWalletScanStatus, "idle">;
  progress: ScanProgress;
  error?: string;
  eligibility?: EligibilityResult[];
  engine?: ReturnType<typeof publicEngineScan>;
  startedAt: number;
  finishedAt?: number;
};

const jobs = new Map<string, JobRecord>();

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

function view(job: JobRecord): LocalWalletScanView {
  return {
    status: job.status,
    progress: { ...job.progress, elapsedMs: Date.now() - job.startedAt },
    error: job.error,
    address: job.address,
    eligibility: job.eligibility,
    engine: job.engine,
    storedLocally: true,
  };
}

export function getLocalWalletScan(address: string): LocalWalletScanView {
  const parsed = parsePublicAddress(address);
  if (!parsed.ok) return { status: "idle", storedLocally: true };
  const job = jobs.get(parsed.address.toLowerCase());
  if (!job) {
    const previous = loadPreviousScan(parsed.address);
    if (!previous) return { status: "idle", address: parsed.address, storedLocally: true };
    return {
      status: "done",
      address: parsed.address,
      engine: publicEngineScan(previous),
      eligibility: eligibilityOverlay(previous),
      storedLocally: true,
    };
  }
  return view(job);
}

export function startLocalWalletScan(address: string): LocalWalletScanView {
  if (looksLikeSecretMaterial(address)) {
    return { status: "failed", error: "invalid address", storedLocally: true };
  }
  const parsed = parsePublicAddress(address);
  if (!parsed.ok) {
    return { status: "failed", error: "invalid address", storedLocally: true };
  }
  const key = parsed.address.toLowerCase();
  const existing = jobs.get(key);
  if (existing && existing.status === "running") return view(existing);

  const startedAt = Date.now();
  const job: JobRecord = {
    address: parsed.address,
    status: "running",
    progress: emptyProgress(parsed.address, startedAt),
    startedAt,
  };
  jobs.set(key, job);

  void withJob(
    "local-wallet-scan",
    "heavy",
    async () => {
      const engine = await scanWalletEngine(parsed.address, {
        persist: true,
        onProgress: (progress) => {
          job.progress = progress;
        },
      });
      const eligibility = await scanCatalogEligibility(parsed.address, eligibilityOverlay(engine));
      job.eligibility = eligibility;
      job.engine = publicEngineScan(engine);
      job.status = "done";
      job.finishedAt = Date.now();
      job.progress = {
        ...job.progress,
        stage: "done",
        currentSource: undefined,
        elapsedMs: job.finishedAt - job.startedAt,
        stages: job.progress.stages.map((stage) => ({ ...stage, status: "done" })),
      };
    },
    { coalesceKey: `local-engine-scan:${key}` },
  ).catch((err) => {
    job.status = "failed";
    job.finishedAt = Date.now();
    job.error =
      err instanceof ResourcePressureError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Wallet scan failed";
  });

  return view(job);
}

export function localScanHistory(address: string) {
  const parsed = parsePublicAddress(address);
  if (!parsed.ok) return [];
  return loadScanHistory(parsed.address);
}

export function resetLocalWalletScansForTests() {
  jobs.clear();
}
