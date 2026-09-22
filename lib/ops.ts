import { APP_VERSION, stageCap, type BetaStage } from "./app-info.ts";
import { mutateBetaState, readBetaState, readErrors, readSecurity, readTelemetry, readUserScans, recordSecurity } from "./beta-store.ts";
import { isWalletScanRecord, type OpsState } from "./beta-types.ts";
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

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round((current / previous) * 100);
}

function closedBetaFunnel(registered: ReturnType<typeof listUsers>) {
  let walletScanStarted = 0;
  let walletScanCompleted = 0;
  let withPotential = 0;
  let withVerified = 0;
  let alerted = 0;
  let returning = 0;
  let walletStartedTotal = 0;
  let walletCompletedTotal = 0;
  let walletFailedTotal = 0;

  for (const user of registered) {
    const walletRows = readUserScans(user.id, 200).filter(isWalletScanRecord);
    const completed = walletRows.filter((row) => row.status === "completed");
    walletStartedTotal += walletRows.filter((row) => row.status === "started").length;
    walletCompletedTotal += completed.length;
    walletFailedTotal += walletRows.filter((row) => row.status === "failed").length;
    if (walletRows.length > 0) walletScanStarted += 1;
    if (completed.length > 0) walletScanCompleted += 1;
    if (completed.some((row) => (row.potentialFindings ?? 0) > 0)) withPotential += 1;
    if (completed.some((row) => (row.verifiedFindings ?? row.itemCount ?? 0) > 0)) withVerified += 1;
    if (completed.some((row) => row.alerted)) alerted += 1;
    if (completed.length >= 2) returning += 1;
  }

  const emailVerified = registered.filter((user) => Boolean(user.emailVerifiedAt)).length;
  const walletBound = registered.filter((user) => user.wallets.length > 0).length;
  const counts = {
    registered: registered.length,
    emailVerified,
    walletBound,
    walletScanStarted,
    walletScanCompleted,
    withPotential,
    withVerified,
    alerted,
    returning,
  };
  return {
    cap: 50,
    ...counts,
    rates: {
      emailVerified: pct(emailVerified, counts.registered),
      walletBound: pct(walletBound, emailVerified),
      walletScanCompleted: pct(walletScanCompleted, walletBound),
      withPotential: pct(withPotential, walletScanCompleted),
      withVerified: pct(withVerified, withPotential),
      alerted: pct(alerted, withVerified),
      returning: pct(returning, walletScanCompleted),
    },
    totals: {
      started: walletStartedTotal,
      completed: walletCompletedTotal,
      failed: walletFailedTotal,
    },
  };
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
      walletBound: registered.filter((user) => user.wallets.length > 0).length,
    },
    scans: {
      started: registered.reduce((sum, user) => sum + user.scanCounts.started, 0),
      completed: registered.reduce((sum, user) => sum + user.scanCounts.completed, 0),
      failed: registered.reduce((sum, user) => sum + user.scanCounts.failed, 0),
    },
    funnel: closedBetaFunnel(registered),
    feedback: {
      useful: feedback.filter((row) => row.type === "useful").length,
      broken: feedback.filter((row) => row.type === "broken_link" || row.type === "report_problem").length,
      new: feedback.filter((row) => row.status === "new").length,
    },
    telemetry: {
      scanStarted: telemetry.filter((row) => row.type === "scan_started").length,
      scanCompleted: telemetry.filter((row) => row.type === "scan_completed").length,
      scanFailed: telemetry.filter((row) => row.type === "scan_failed").length,
      walletScanStarted: telemetry.filter((row) => row.type === "wallet_scan_started").length,
      walletScanCompleted: telemetry.filter((row) => row.type === "wallet_scan_completed").length,
      walletScanFailed: telemetry.filter((row) => row.type === "wallet_scan_failed").length,
      walletAlert: telemetry.filter((row) => row.type === "wallet_alert").length,
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
