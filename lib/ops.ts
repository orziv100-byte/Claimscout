import { APP_VERSION, stageCap, type BetaStage } from "./app-info.ts";
import { mutateBetaState, readBetaState, readErrors, readSecurity, readTelemetry, recordSecurity } from "./beta-store.ts";
import type { OpsState } from "./beta-types.ts";
import { listInvites, listUsers } from "./auth.ts";

export function readOps(): OpsState {
  return readBetaState().ops;
}

export function updateOps(
  patch: Partial<Pick<OpsState, "scansEnabled" | "maintenanceMode" | "betaStage" | "reason">>,
  actorId: string,
): OpsState {
  return mutateBetaState((state) => {
    if (typeof patch.scansEnabled === "boolean") state.ops.scansEnabled = patch.scansEnabled;
    if (typeof patch.maintenanceMode === "boolean") state.ops.maintenanceMode = patch.maintenanceMode;
    if (patch.betaStage === 1 || patch.betaStage === 2 || patch.betaStage === 3) state.ops.betaStage = patch.betaStage;
    if (typeof patch.reason === "string") state.ops.reason = patch.reason.slice(0, 500);
    state.ops.updatedAt = new Date().toISOString();
    state.ops.updatedBy = actorId;
    recordSecurity({
      type: "ops_updated",
      userId: actorId,
      detail: `scans=${state.ops.scansEnabled};maintenance=${state.ops.maintenanceMode};stage=${state.ops.betaStage}`,
    });
    return { ...state.ops };
  });
}

export function scansAreOpen(ops = readOps()): boolean {
  return ops.scansEnabled && !ops.maintenanceMode;
}

export function betaMetrics() {
  const users = listUsers();
  const invites = listInvites();
  const telemetry = readTelemetry(1000);
  const stage = readOps().betaStage as BetaStage;
  const registered = users.filter((user) => user.status !== "disabled");
  const verified = registered.filter((user) => Boolean(user.emailVerifiedAt));
  const firstScan = registered.filter((user) => Boolean(user.firstScanAt));
  const returning = registered.filter((user) => (user.scanCounts.completed ?? 0) >= 2);
  const feedback = readBetaState().feedback;
  return {
    version: APP_VERSION,
    stage,
    stageCap: stageCap(stage),
    users: {
      registered: registered.length,
      invited: invites.reduce((sum, invite) => sum + invite.usedBy.length, 0),
      invitesSent: invites.length,
      verified: verified.length,
      active: registered.filter((user) => user.status === "active").length,
      disabled: users.filter((user) => user.status === "disabled").length,
      suspended: users.filter((user) => user.status === "suspended").length,
      pending: users.filter((user) => user.status === "pending_verification").length,
      firstScan: firstScan.length,
      returning: returning.length,
    },
    scans: {
      started: registered.reduce((sum, user) => sum + user.scanCounts.started, 0),
      completed: registered.reduce((sum, user) => sum + user.scanCounts.completed, 0),
      failed: registered.reduce((sum, user) => sum + user.scanCounts.failed, 0),
    },
    feedback: {
      useful: feedback.filter((row) => row.type === "useful").length,
      broken: feedback.filter((row) => row.type === "broken_link" || row.type === "report_problem").length,
      new: feedback.filter((row) => row.status === "new").length,
    },
    telemetry: {
      scanStarted: telemetry.filter((row) => row.type === "scan_started").length,
      scanCompleted: telemetry.filter((row) => row.type === "scan_completed").length,
      scanFailed: telemetry.filter((row) => row.type === "scan_failed").length,
      sourceFailure: telemetry.filter((row) => row.type === "source_failure").length,
      resourceLimit: telemetry.filter((row) => row.type === "resource_limit").length,
      appError: telemetry.filter((row) => row.type === "app_error").length,
    },
    majorErrors: readErrors(50).slice(-20),
    recentSecurity: readSecurity(30).slice(-15).map((row) => ({
      at: row.at,
      type: row.type,
      userId: row.userId,
    })),
  };
}
