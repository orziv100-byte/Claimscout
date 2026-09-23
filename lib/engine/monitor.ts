import { parsePublicAddress } from "../address.ts";
import { listUsers } from "../auth.ts";
import { sendMail, type MailPurpose } from "../mail.ts";
import { isPaidPlan, MONITOR_WALLET_CAP, monitoringActive, type PlanId } from "../plan.ts";
import { scansAreOpen } from "../ops.ts";
import { readResourceSnapshot } from "../resource-guard.ts";
import { trackWalletAlert, trackWalletScan } from "../telemetry.ts";
import { scanWalletEngine } from "./scan.ts";
import { recordScanMcpEvents } from "./mcp-events.ts";
import type { EngineChange, EngineFinding, EngineScan } from "./types.ts";

export type MonitorWalletResult = {
  userId: string;
  address: string;
  scannedAt: string;
  alerted: boolean;
  skipped?: string;
  changeCount: number;
};

export type MonitorRunResult = {
  ranAt: string;
  wallets: MonitorWalletResult[];
  skipped: string | null;
};

export const MIN_ALERT_NET_USD = 1;

/** Daily engine monitor is paid (or explicit Free opt-in). Free is never full-scanned by default. */
export function dailyMonitorAllowed(user: { plan: PlanId; monitorEnabled?: boolean }): boolean {
  return monitoringActive(user.plan, user.monitorEnabled);
}

export function belowAlertNet(finding: EngineFinding): boolean {
  if (finding.roiConfidence === "none" || finding.roiConfidence == null) return false;
  const net =
    finding.estimatedNetUsd ?? (finding.estimatedFeesUsd == null ? finding.estimatedValueUsd : undefined);
  if (net == null || !Number.isFinite(net)) return false;
  return net < MIN_ALERT_NET_USD;
}

export function alertableChanges(scan: EngineScan): EngineChange[] {
  const byId = new Map(scan.findings.map((row) => [row.id, row]));
  return scan.changes.filter((change) => isAlertable(change, byId.get(change.findingId)));
}

function isAlertable(change: EngineChange, finding?: EngineFinding): boolean {
  if (change.kind === "baseline") return false;
  if (change.kind === "source_failed") return true;
  if (change.kind === "removed_finding") return finding?.category === "airdrop";
  if (change.kind === "status_changed") {
    if (!finding || finding.verification === "uncertain" || finding.verification === "rejected") return false;
    if (finding.deadlineStatus === "closing" || finding.deadlineStatus === "expired") return true;
    if (finding.verification !== "verified") return false;
    if (finding.eligibility === "eligible" && belowAlertNet(finding)) return false;
    return true;
  }
  if (change.kind === "new_finding") {
    if (!finding || finding.verification !== "verified") return false;
    if (belowAlertNet(finding)) return false;
    if (finding.eligibility === "eligible") return true;
    if (finding.category === "forgotten_token" || finding.category === "native_balance") {
      return Number(finding.amount) > 0;
    }
    return false;
  }
  if (change.kind === "amount_changed") {
    if (finding?.category !== "airdrop" || finding.verification !== "verified") return false;
    return !belowAlertNet(finding);
  }
  return false;
}

function alertText(address: string, scan: EngineScan, changes: EngineChange[]): string {
  const lines = [
    `PoolIndex found a meaningful change for ${address}.`,
    `Scan: ${scan.scannedAt}`,
    "",
    ...changes.map((change) => `- ${change.summary}`),
    "",
    "Open Wallet Check: https://poolindex.app/wallet",
    "This is not a claim that money is owed. Verify on the official source before acting.",
  ];
  return lines.join("\n");
}

export function walletAlertMail(
  address: string,
  scan: EngineScan,
  changes: EngineChange[],
): { purpose: MailPurpose; subject: string; text: string } {
  const byId = new Map(scan.findings.map((row) => [row.id, row]));
  const closing = changes.some((change) => {
    const finding = byId.get(change.findingId);
    return finding?.deadlineStatus === "closing" || finding?.deadlineStatus === "expired";
  });
  const newlyEligible = changes.some((change) => {
    const finding = byId.get(change.findingId);
    return (
      (change.kind === "new_finding" || change.kind === "status_changed") &&
      finding?.verification === "verified" &&
      finding.eligibility === "eligible"
    );
  });
  if (closing) {
    return {
      purpose: "claim_window_closing",
      subject: "PoolIndex: claim window closing",
      text: alertText(address, scan, changes),
    };
  }
  if (newlyEligible) {
    return {
      purpose: "eligibility_available",
      subject: "PoolIndex: verified finding on your wallet",
      text: alertText(address, scan, changes),
    };
  }
  return {
    purpose: "wallet_scan_changed",
    subject: "PoolIndex: wallet scan changed",
    text: alertText(address, scan, changes),
  };
}

export async function runWalletMonitor(): Promise<MonitorRunResult> {
  const ranAt = new Date().toISOString();
  if (!scansAreOpen()) {
    return { ranAt, wallets: [], skipped: "scans paused or maintenance mode" };
  }
  const pressure = readResourceSnapshot();
  if (pressure.level === "critical") {
    return { ranAt, wallets: [], skipped: pressure.message };
  }

  const targets = listUsers().filter(
    (user) => user.status === "active" && user.emailVerifiedAt && user.wallets.length > 0 && user.email,
  );
  const wallets: MonitorWalletResult[] = [];

  for (const user of targets) {
    if (!dailyMonitorAllowed(user)) {
      for (const raw of user.wallets.slice(0, MONITOR_WALLET_CAP)) {
        wallets.push({
          userId: user.id,
          address: raw,
          scannedAt: ranAt,
          alerted: false,
          skipped: "free_plan_no_daily_monitor",
          changeCount: 0,
        });
      }
      continue;
    }
    const watched = user.wallets.slice(0, MONITOR_WALLET_CAP);
    for (const raw of watched) {
      const snap = readResourceSnapshot();
      if (snap.level === "critical") {
        wallets.push({
          userId: user.id,
          address: raw,
          scannedAt: ranAt,
          alerted: false,
          skipped: snap.message,
          changeCount: 0,
        });
        continue;
      }
      const parsed = parsePublicAddress(raw);
      if (!parsed.ok) {
        wallets.push({
          userId: user.id,
          address: raw,
          scannedAt: ranAt,
          alerted: false,
          skipped: "invalid public address",
          changeCount: 0,
        });
        continue;
      }
      const startedAt = Date.now();
      trackWalletScan(user, { status: "started" });
      try {
        const scan = await scanWalletEngine(parsed.address);
        recordScanMcpEvents(user.id, scan);
        const alerts = alertableChanges(scan);
        let alerted = false;
        if (alerts.length > 0 && isPaidPlan(user.plan)) {
          const mail = walletAlertMail(parsed.address, scan, alerts);
          await sendMail({
            to: user.email,
            subject: mail.subject,
            text: mail.text,
            url: "https://poolindex.app/wallet",
            purpose: mail.purpose,
          });
          alerted = true;
          trackWalletAlert(user.id, alerts.length);
        }
        trackWalletScan(user, {
          status: "completed",
          durationMs: Date.now() - startedAt,
          potentialFindings: scan.counters.potentialFindings,
          verifiedFindings: scan.counters.verifiedFindings,
          sourcesChecked: scan.counters.sourcesChecked,
          alerted,
        });
        wallets.push({
          userId: user.id,
          address: parsed.address,
          scannedAt: scan.scannedAt,
          alerted,
          changeCount: alerts.length,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Wallet monitor scan failed";
        trackWalletScan(user, { status: "failed", durationMs: Date.now() - startedAt, error });
        wallets.push({
          userId: user.id,
          address: parsed.address,
          scannedAt: new Date().toISOString(),
          alerted: false,
          skipped: error,
          changeCount: 0,
        });
      }
    }
  }

  return { ranAt, wallets, skipped: null };
}
