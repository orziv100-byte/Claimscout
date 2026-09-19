import { APP_VERSION } from "./app-info.ts";
import { updateUser } from "./auth.ts";
import { getUserById } from "./auth.ts";
import { recordTelemetry, recordUserScan } from "./beta-store.ts";
import type { ScanRecord, UserRecord } from "./beta-types.ts";

export function trackScan(user: UserRecord, row: Omit<ScanRecord, "userId" | "version" | "at"> & { at?: string }) {
  const event: ScanRecord = {
    at: row.at ?? new Date().toISOString(),
    userId: user.id,
    query: row.query.slice(0, 120),
    sources: row.sources,
    status: row.status,
    durationMs: row.durationMs,
    itemCount: row.itemCount,
    blocked: row.blocked,
    error: row.error,
    version: APP_VERSION,
  };
  recordUserScan(event);
  recordTelemetry({
    type: `scan_${row.status}`,
    userId: user.id,
    durationMs: row.durationMs,
    detail: row.sources.join(","),
    code: row.error,
  });
  recordTelemetry({
    type: `NORMAL_SCAN_${row.status.toUpperCase()}`,
    userId: user.id,
    durationMs: row.durationMs,
    detail: row.sources.join(","),
    code: row.error,
  });
  const live = getUserById(user.id);
  if (!live) return;
  const scanCounts = { ...live.scanCounts };
  if (row.status === "started") scanCounts.started += 1;
  if (row.status === "completed") scanCounts.completed += 1;
  if (row.status === "failed") scanCounts.failed += 1;
  updateUser(
    live.id,
    {
      scanCounts,
      lastScanAt: event.at,
      firstScanAt: live.firstScanAt ?? event.at,
    },
    live.id,
  );
}

export function trackSourceFailure(source: string, code: string, userId?: string) {
  recordTelemetry({ type: "source_failure", source, code, userId });
}

export function trackAppError(detail: string, code?: string, userId?: string) {
  recordTelemetry({ type: "app_error", detail: detail.slice(0, 300), code, userId });
}

export function trackResourceLimit(code: string, detail: string, userId?: string) {
  recordTelemetry({ type: "resource_limit", code, detail: detail.slice(0, 300), userId });
}
