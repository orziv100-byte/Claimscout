import { APP_VERSION } from "./app-info.ts";
import { listUsers, revokeUserSessions, updateUser } from "./auth.ts";
import { readBetaState, readErrors, readSecurity, readTelemetry, recordSecurity } from "./beta-store.ts";
import { BETA_FEEDBACK_CATEGORIES, type BillingStatus, type FeedbackRecord, type PublicUser } from "./beta-types.ts";
import { countDownloadEvents, listPublishedInstallers, readDownloadControl, readDownloadEvents, writeDownloadControl } from "./download-ops.ts";
import { listFeedback, updateFeedbackStatus } from "./feedback.ts";
import { updateOps } from "./ops.ts";
import { paypalSettings } from "./paypal.ts";
import { readResourceSnapshot } from "./resource-guard.ts";
import { macosInstaller, windowsInstaller } from "./windows-installer.ts";

export const OPERATOR_ACTOR = "loopback-operator";
const SECRET_KEYS = /password|secret|hash|token|cookie|private.?key|seed|mnemonic|paypal_client/i;

export type OperatorActionResult = { ok: boolean; message: string; code?: string };

function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripSecrets(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(key)) continue;
      out[key] = stripSecrets(item);
    }
    return out as T;
  }
  return value;
}

function subStatus(user: PublicUser, subscriptions: ReturnType<typeof readBetaState>["subscriptions"]): {
  status: BillingStatus | "none" | "trial";
  interval: string | null;
} {
  const rows = subscriptions.filter((row) => row.userId === user.id);
  const live = rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (live) return { status: live.status, interval: live.interval };
  if (user.plan === "paid") return { status: "active", interval: "license" };
  return { status: "trial", interval: null };
}

export function operatorDashboard() {
  const state = readBetaState();
  const users = listUsers();
  const downloads = countDownloadEvents();
  const files = listPublishedInstallers();
  const winHits = files.filter((file) => file.name.toLowerCase().endsWith(".exe")).reduce((sum, file) => sum + (downloads.files[file.name] || 0), 0);
  const macHits = files
    .filter((file) => /\.(dmg|zip)$/i.test(file.name) && /mac/i.test(file.name))
    .reduce((sum, file) => sum + (downloads.files[file.name] || 0), 0);
  const subs = state.subscriptions;
  const paying = users.filter((user) => user.plan === "paid" || subs.some((row) => row.userId === user.id && row.status === "active")).length;
  const cancelled = subs.filter((row) => row.status === "cancelled").length;
  const failed = subs.filter((row) => row.status === "payment_failed").length;
  const telemetry = readTelemetry(400);
  const scans = users.reduce(
    (acc, user) => {
      acc.started += user.scanCounts.started;
      acc.completed += user.scanCounts.completed;
      acc.failed += user.scanCounts.failed;
      return acc;
    },
    { started: 0, completed: 0, failed: 0 },
  );
  const health = readResourceSnapshot();
  const win = windowsInstaller();
  const mac = macosInstaller();
  return stripSecrets({
    version: APP_VERSION,
    public: false,
    bind: "127.0.0.1",
    users: {
      registered: users.length,
      verified: users.filter((user) => Boolean(user.emailVerifiedAt)).length,
      active: users.filter((user) => user.status === "active").length,
      pending: users.filter((user) => user.status === "pending_verification").length,
      suspended: users.filter((user) => user.status === "suspended").length,
      disabled: users.filter((user) => user.status === "disabled").length,
    },
    downloads: {
      total: downloads.total,
      pages: downloads.pages,
      files: downloads.total - downloads.pages,
      windows: winHits,
      macos: macHits,
      paused: readDownloadControl().paused,
    },
    billing: {
      paying,
      trialFree: users.length - paying,
      withoutActiveSub: users.filter((user) => subStatus(user, subs).status !== "active").length,
      cancelled,
      failedPayments: failed,
      refunds: 0,
      paypal: { mode: paypalSettings().mode, chargesEnabled: paypalSettings().chargesEnabled, credentialsPresent: paypalSettings().credentialsPresent },
    },
    scans,
    alerts: telemetry.filter((row) => row.type === "wallet_alert").length,
    versions: {
      app: APP_VERSION,
      windows: win.filename,
      macos: mac.filename,
    },
    health: {
      level: health.level,
      cause: health.cause || "",
      message: health.message,
      ramAvailableMb: health.ramAvailableMb,
      load1: health.load1,
      diskUsedPct: health.diskUsedPct,
    },
    ops: state.ops,
  });
}

export function operatorUsers(query = "") {
  const state = readBetaState();
  const needle = query.trim().toLowerCase();
  const feedback = listFeedback();
  const telemetry = readTelemetry(200);
  return listUsers()
    .filter((user) => {
      if (!needle) return true;
      return `${user.email} ${user.displayName} ${user.id} ${user.status} ${user.plan}`.toLowerCase().includes(needle);
    })
    .map((user) => {
      const sub = subStatus(user, state.subscriptions);
      const lastTel = [...telemetry].reverse().find((row) => row.userId === user.id);
      return stripSecrets({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        role: user.role,
        plan: user.plan,
        verified: Boolean(user.emailVerifiedAt),
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        subscription: sub.status,
        trial: sub.status === "trial",
        platform: lastTel?.detail?.includes("darwin") ? "macOS" : lastTel?.detail?.includes("win") ? "Windows" : "",
        appVersion: lastTel?.version || "",
        scans: user.scanCounts,
        feedbackCount: feedback.filter((row) => row.userId === user.id).length,
        sessionsOpen: state.sessions.filter((session) => session.userId === user.id && !session.revokedAt).length,
        googleLinked: user.googleLinked,
        totpEnabled: Boolean(user.totpEnabled),
      });
    });
}

export function operatorSubscriptions() {
  const users = listUsers();
  const state = readBetaState();
  return users.map((user) => {
    const rows = state.subscriptions.filter((row) => row.userId === user.id);
    return stripSecrets({
      userId: user.id,
      email: user.email,
      plan: user.plan,
      subscriptions: rows.map((row) => ({
        id: row.id,
        status: row.status,
        interval: row.interval,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        nextBillingAt: row.nextBillingAt,
        paypalSubscriptionId: row.paypalSubscriptionId ? `${row.paypalSubscriptionId.slice(0, 8)}…` : "",
      })),
    });
  });
}

export function operatorFeedback() {
  const users = new Map(listUsers().map((user) => [user.id, user]));
  const rows = listFeedback();
  const isUser = (row: FeedbackRecord) => (BETA_FEEDBACK_CATEGORIES as readonly string[]).includes(row.type);
  const mapRow = (row: FeedbackRecord) =>
    stripSecrets({
      id: row.id,
      email: users.get(row.userId)?.email || "",
      userId: row.userId,
      at: row.createdAt,
      appVersion: row.appVersion,
      category: row.type,
      message: row.note,
      status: row.status,
      operatorNote: row.operatorNote || "",
      rating: row.rating,
    });
  return {
    user: rows.filter(isUser).map(mapRow),
    result: rows.filter((row) => !isUser(row)).map(mapRow),
  };
}

function safeDetail(value: unknown): string {
  if (typeof value !== "string") return "";
  if (SECRET_KEYS.test(value)) return "";
  return value.slice(0, 180);
}

function eventSeverity(type: string): "low" | "medium" | "high" {
  if (/crash|intrusion|breach|exfil/i.test(type)) return "high";
  if (/fail|error|auth|rate.?limit/i.test(type)) return "medium";
  return "low";
}

export function operatorSystemFeed() {
  const telemetry = readTelemetry(150);
  const errors = readErrors(80);
  const security = readSecurity(150);
  const authFails = security.filter((row) => row.type === "login_failure" || row.type === "login_blocked");
  const crashes = telemetry.filter((row) => /crash|app_error/i.test(row.type));
  const scanFailures = telemetry.filter((row) => row.type.includes("scan_failed") || row.type === "source_failure");
  const updateFailures = telemetry.filter((row) => /update_fail|installer_fail/i.test(row.type));
  const apiFailures = errors.slice(-40).map((row) => ({
    at: String(row.at ?? ""),
    type: String(row.type ?? "api_error"),
    code: String(row.code ?? ""),
    detail: safeDetail(row.detail),
  }));
  const authFailures = authFails.slice(-40).map((row) => ({
    at: row.at,
    detail: row.detail,
    emailDomain: row.email?.includes("@") ? row.email.split("@")[1] : "",
  }));
  const versionAnomalies = telemetry.filter((row) => row.version && row.version !== APP_VERSION).slice(-20);
  const events = [
    ...crashes.map((row) => ({
      at: row.at,
      kind: row.type,
      severity: eventSeverity(row.type),
      version: row.version || "",
      platform: row.source || "",
      detail: safeDetail(row.detail),
    })),
    ...scanFailures.map((row) => ({
      at: row.at,
      kind: row.type,
      severity: eventSeverity(row.type),
      version: row.version || "",
      platform: row.source || "",
      detail: safeDetail(row.detail),
    })),
    ...updateFailures.map((row) => ({
      at: row.at,
      kind: row.type,
      severity: eventSeverity(row.type),
      version: row.version || "",
      platform: row.source || "",
      detail: safeDetail(row.detail),
    })),
    ...apiFailures.map((row) => ({
      at: row.at,
      kind: row.type || "api_error",
      severity: eventSeverity(row.type),
      version: "",
      platform: "",
      detail: row.detail,
    })),
    ...authFailures.map((row) => ({
      at: row.at,
      kind: "auth_failure",
      severity: "medium" as const,
      version: "",
      platform: "",
      detail: row.detail || "",
    })),
    ...versionAnomalies.map((row) => ({
      at: row.at,
      kind: "version_anomaly",
      severity: "low" as const,
      version: row.version || "",
      platform: row.source || "",
      detail: safeDetail(row.detail) || row.type,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-50);
  return stripSecrets({
    crashes,
    scanFailures,
    updateFailures,
    apiFailures,
    authFailures,
    versionAnomalies,
    events,
  });
}

export function operatorSecurityCenter() {
  const security = readSecurity(200);
  const failures = security.filter((row) => row.type === "login_failure");
  const byDetail: Record<string, number> = {};
  for (const row of failures) byDetail[row.detail || "unknown"] = (byDetail[row.detail || "unknown"] || 0) + 1;
  return stripSecrets({
    recent: security.slice(-40).map((row) => ({
      at: row.at,
      type: row.type,
      detail: row.detail || "",
      userId: row.userId || "",
      emailDomain: row.email?.includes("@") ? row.email.split("@")[1] : "",
    })),
    repeatedAuth: byDetail,
    alerts: security.filter((row) => /breach|intrusion|exfil/i.test(`${row.type} ${row.detail || ""}`)),
    note: "Ordinary login failures and scan errors are not labeled as security breaches.",
  });
}

export function operatorDownloads() {
  return {
    control: readDownloadControl(),
    counts: countDownloadEvents(),
    files: listPublishedInstallers(),
    events: readDownloadEvents(40),
  };
}

export function operatorAudit(limit = 40) {
  return readSecurity(limit).filter((row) =>
    /sessions_revoked|user_updated|ops_updated|feedback_status|download|refund/i.test(row.type + (row.detail || "")),
  );
}

function requireConfirm(confirm: string, expected: string): OperatorActionResult | null {
  if (confirm !== expected) {
    return { ok: false, code: "CONFIRM_REQUIRED", message: `Type ${expected} to confirm this action.` };
  }
  return null;
}

export function performOperatorAction(input: {
  action: string;
  userId?: string;
  status?: string;
  reason?: string;
  feedbackId?: string;
  operatorNote?: string;
  subscriptionId?: string;
  confirm?: string;
}): OperatorActionResult {
  const actor = OPERATOR_ACTOR;
  try {
    if (input.action === "pause_downloads") {
      writeDownloadControl({ paused: true, reason: input.reason || "operator pause" });
      recordSecurity({ type: "ops_updated", userId: actor, detail: "downloads_paused" });
      return { ok: true, message: "Downloads paused." };
    }
    if (input.action === "resume_downloads") {
      writeDownloadControl({ paused: false, reason: "" });
      recordSecurity({ type: "ops_updated", userId: actor, detail: "downloads_resumed" });
      return { ok: true, message: "Downloads resumed." };
    }
    if (input.action === "user_status") {
      const denied = requireConfirm(input.confirm || "", "CONFIRM");
      if (denied) return denied;
      const status = input.status;
      if (status !== "active" && status !== "disabled" && status !== "suspended") {
        return { ok: false, code: "INVALID_STATUS", message: "Unknown account status." };
      }
      if (!input.userId) return { ok: false, code: "USER_REQUIRED", message: "User id required." };
      updateUser(input.userId, { status }, actor);
      return { ok: true, message: `Account set to ${status}.` };
    }
    if (input.action === "revoke_sessions") {
      const denied = requireConfirm(input.confirm || "", "CONFIRM");
      if (denied) return denied;
      if (!input.userId) return { ok: false, code: "USER_REQUIRED", message: "User id required." };
      const n = revokeUserSessions(input.userId, actor);
      return { ok: true, message: `Revoked ${n} session(s).` };
    }
    if (input.action === "feedback_status") {
      if (!input.feedbackId) return { ok: false, code: "FEEDBACK_REQUIRED", message: "Feedback id required." };
      updateFeedbackStatus(input.feedbackId, input.status || "new", actor, input.operatorNote);
      return { ok: true, message: "Feedback updated." };
    }
    if (input.action === "ops_patch") {
      const denied = requireConfirm(input.confirm || "", "CONFIRM");
      if (denied) return denied;
      const patch: { scansEnabled?: boolean; maintenanceMode?: boolean; reason?: string } = {};
      if (input.status === "pause_scans") patch.scansEnabled = false;
      if (input.status === "resume_scans") patch.scansEnabled = true;
      if (input.status === "maintenance_on") patch.maintenanceMode = true;
      if (input.status === "maintenance_off") patch.maintenanceMode = false;
      if (input.reason) patch.reason = input.reason;
      updateOps(patch, actor);
      return { ok: true, message: "Ops updated." };
    }
    if (input.action === "refund") {
      const denied = requireConfirm(input.confirm || "", "REFUND");
      if (denied) return denied;
      recordSecurity({ type: "ops_updated", userId: actor, detail: `refund_unavailable:${input.subscriptionId || ""}` });
      return {
        ok: false,
        code: "NO_CAPTURE",
        message: "No PayPal capture id is stored for this Closed Beta account, so a provider refund cannot be sent.",
      };
    }
    return { ok: false, code: "UNKNOWN_ACTION", message: "Unknown action." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed.";
    recordSecurity({ type: "ops_updated", userId: actor, detail: `action_failed:${input.action}` });
    return { ok: false, message };
  }
}
