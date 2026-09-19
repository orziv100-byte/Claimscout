import type { PressureLevel } from "./resource-guard.ts";

export type PublicHealthBody = {
  ok: boolean;
  status: "ok" | "unavailable";
};

export type PublicStatusBody = {
  ok: boolean;
  maintenanceMode: boolean;
};

export function publicHealthBody(level: PressureLevel): PublicHealthBody {
  const ok = level !== "critical";
  return { ok, status: ok ? "ok" : "unavailable" };
}

export function publicStatusBody(maintenanceMode: boolean): PublicStatusBody {
  return { ok: !maintenanceMode, maintenanceMode };
}

export const PUBLIC_HEALTH_FORBIDDEN_KEYS = [
  "ramUsedPct",
  "ramAvailableMb",
  "rssMb",
  "heapUsedMb",
  "heapLimitMb",
  "load1",
  "cpuCount",
  "diskUsedPct",
  "diskFreeGb",
  "jobs",
  "heavyJobs",
  "lightJobs",
  "envOk",
  "betaStage",
  "scansEnabled",
  "version",
] as const;
