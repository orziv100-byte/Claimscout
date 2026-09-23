import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { INTERNAL_ADMIN_BIND, INTERNAL_ADMIN_PORT, isLoopbackHost } from "../lib/download-ops.ts";
import {
  operatorAudit,
  operatorDashboard,
  operatorDownloads,
  operatorFeedback,
  operatorSecurityCenter,
  operatorSubscriptions,
  operatorSystemFeed,
  operatorUsers,
  performOperatorAction,
} from "../lib/operator-console.ts";

const PORT = Number(process.env.POOLINDEX_INTERNAL_ADMIN_PORT || INTERNAL_ADMIN_PORT) || INTERNAL_ADMIN_PORT;
const BIND = INTERNAL_ADMIN_BIND;

function denied(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(message);
}

function allowed(req: IncomingMessage): boolean {
  const host = req.headers.host || "";
  if (!isLoopbackHost(host)) return false;
  const addr = req.socket.remoteAddress || "";
  return addr === "127.0.0.1" || addr === "::1" || addr === ":ffff:127.0.0.1";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function kvTable(rows: [string, unknown][]): string {
  return `<table><tbody>${rows
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function htmlPage(query: string, notice = ""): string {
  const dash = operatorDashboard();
  const users = operatorUsers(query);
  const subs = operatorSubscriptions();
  const feedback = operatorFeedback();
  const system = operatorSystemFeed();
  const security = operatorSecurityCenter();
  const downloads = operatorDownloads();
  const audit = operatorAudit(30);
  const userRows = users
    .map(
      (user) => `<tr>
        <td>${escapeHtml(user.email)}<br><span class="muted">${escapeHtml(user.displayName)} · ${escapeHtml(user.id.slice(0, 8))}</span></td>
        <td>${escapeHtml(user.status)}</td>
        <td>${user.verified ? "yes" : "no"}</td>
        <td>${escapeHtml(user.createdAt)}</td>
        <td>${escapeHtml(user.lastLoginAt || "")}</td>
        <td>${escapeHtml(user.subscription)}${user.trial ? " / trial" : ""}</td>
        <td>${escapeHtml(user.appVersion)} ${escapeHtml(user.platform)}</td>
        <td>${escapeHtml(user.scans.started)}/${escapeHtml(user.scans.completed)}/${escapeHtml(user.scans.failed)}</td>
        <td>${escapeHtml(user.feedbackCount)}</td>
        <td>
          <form method="post" action="/action">
            <input type="hidden" name="action" value="user_status">
            <input type="hidden" name="userId" value="${escapeHtml(user.id)}">
            <input type="hidden" name="status" value="suspended">
            <input name="confirm" placeholder="CONFIRM" size="8">
            <button type="submit">Suspend</button>
          </form>
          <form method="post" action="/action">
            <input type="hidden" name="action" value="user_status">
            <input type="hidden" name="userId" value="${escapeHtml(user.id)}">
            <input type="hidden" name="status" value="disabled">
            <input name="confirm" placeholder="CONFIRM" size="8">
            <button type="submit">Disable</button>
          </form>
          <form method="post" action="/action">
            <input type="hidden" name="action" value="user_status">
            <input type="hidden" name="userId" value="${escapeHtml(user.id)}">
            <input type="hidden" name="status" value="active">
            <input name="confirm" placeholder="CONFIRM" size="8">
            <button type="submit">Restore</button>
          </form>
          <form method="post" action="/action">
            <input type="hidden" name="action" value="revoke_sessions">
            <input type="hidden" name="userId" value="${escapeHtml(user.id)}">
            <input name="confirm" placeholder="CONFIRM" size="8">
            <button type="submit">Revoke sessions (${escapeHtml(user.sessionsOpen)})</button>
          </form>
        </td>
      </tr>`,
    )
    .join("");
  const fileRows = downloads.files
    .map((file) => `<tr><td>${escapeHtml(file.name)}</td><td>${file.bytes}</td><td>${downloads.counts.files[file.name] || 0}</td></tr>`)
    .join("");
  const eventRows = downloads.events
    .map(
      (event) =>
        `<tr><td>${escapeHtml(event.at)}</td><td>${escapeHtml(event.kind)}</td><td>${escapeHtml(event.path)}</td><td>${escapeHtml(event.file || "")}</td><td>${escapeHtml(event.ip)}</td></tr>`,
    )
    .join("");
  const fbRows = (rows: typeof feedback.user) =>
    rows
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.at)}</td>
          <td>${escapeHtml(row.email)}</td>
          <td>${escapeHtml(row.appVersion)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.message)}</td>
          <td>${escapeHtml(row.status === "reviewed" || row.status === "investigating" ? "reviewing" : row.status)}</td>
          <td>
            <form method="post" action="/action">
              <input type="hidden" name="action" value="feedback_status">
              <input type="hidden" name="feedbackId" value="${escapeHtml(row.id)}">
              <select name="status">
                <option value="new" ${row.status === "new" ? "selected" : ""}>new</option>
                <option value="reviewing" ${row.status === "reviewed" || row.status === "investigating" ? "selected" : ""}>reviewing</option>
                <option value="resolved" ${row.status === "resolved" || row.status === "fixed" || row.status === "closed" ? "selected" : ""}>resolved</option>
              </select>
              <input name="operatorNote" maxlength="200" placeholder="internal note" value="${escapeHtml(row.operatorNote)}">
              <button type="submit">Save</button>
            </form>
          </td>
        </tr>`,
      )
      .join("");
  const secRows = security.recent
    .map((row) => `<tr><td>${escapeHtml(row.at)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.detail)}</td><td>${escapeHtml(row.emailDomain)}</td></tr>`)
    .join("");
  const auditRows = audit
    .map((row) => `<tr><td>${escapeHtml(row.at)}</td><td>${escapeHtml(row.userId || "")}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.detail || "")}</td></tr>`)
    .join("");
  const subRows = subs
    .map((row) => {
      const inner = row.subscriptions.length
        ? row.subscriptions.map((item) => `${item.status} ${item.interval} ${item.id}`).join("; ")
        : row.plan;
      return `<tr><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.plan)}</td><td>${escapeHtml(inner)}</td>
        <td><form method="post" action="/action">
          <input type="hidden" name="action" value="refund">
          <input type="hidden" name="subscriptionId" value="${escapeHtml(row.subscriptions[0]?.id || "")}">
          <input name="confirm" placeholder="REFUND" size="8">
          <button type="submit">Refund</button>
        </form></td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PoolIndex operator console</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background:#0b0f14; color:#f5f7fa; margin:0; padding:24px; }
    a, button { color:#9ec5ff; }
    nav a { margin-right:12px; }
    table { border-collapse: collapse; width:100%; margin: 12px 0 28px; font-size:13px; }
    th, td { border-bottom:1px solid #243040; text-align:left; padding:8px 6px; vertical-align:top; }
    .warn { color:#f0c36d; }
    .ok { color:#8ee0a8; }
    .muted { color:#9aa7b5; font-size:12px; }
    form { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin: 4px 0; }
    input, button, select { background:#151b24; color:#f5f7fa; border:1px solid #2a3544; padding:6px 8px; border-radius:6px; }
    section { margin-bottom: 36px; }
    .notice { background:#1c2733; padding:10px 12px; border-radius:8px; }
  </style>
</head>
<body>
  <p class="warn">Internal operator console. Bound to ${BIND}:${PORT} only. Not published on poolindex.app. Not part of the desktop app. Passwords, hashes, secrets, and session tokens are never shown.</p>
  <nav>
    <a href="#dashboard">Dashboard</a>
    <a href="#users">Users</a>
    <a href="#billing">Subscriptions</a>
    <a href="#feedback">Feedback</a>
    <a href="#system">System feed</a>
    <a href="#security">Security</a>
    <a href="#downloads">Downloads</a>
    <a href="#control">System control</a>
    <a href="#audit">Audit</a>
  </nav>
  ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ""}
  <section id="dashboard">
    <h1>Dashboard</h1>
    ${kvTable([
      ["Registered users", dash.users.registered],
      ["Verified users", dash.users.verified],
      ["Active users", dash.users.active],
      ["Total download events", dash.downloads.total],
      ["Windows downloads", dash.downloads.windows],
      ["macOS downloads", dash.downloads.macos],
      ["Paying subscribers", dash.billing.paying],
      ["Trial/free users", dash.billing.trialFree],
      ["Without active subscription", dash.billing.withoutActiveSub],
      ["Cancelled subscriptions", dash.billing.cancelled],
      ["Failed payments", dash.billing.failedPayments],
      ["Refunds recorded", dash.billing.refunds],
      ["Scans started/completed/failed", `${dash.scans.started}/${dash.scans.completed}/${dash.scans.failed}`],
      ["Alerts generated", dash.alerts],
      ["App version", dash.versions.app],
      ["Windows file", dash.versions.windows || "unpublished"],
      ["macOS file", dash.versions.macos || "unpublished"],
      ["API health", `${dash.health.level} — ${dash.health.message}`],
    ])}
  </section>
  <section id="users">
    <h2>User management</h2>
    <form method="get" action="/">
      <input name="q" value="${escapeHtml(query)}" placeholder="search email, name, id">
      <button type="submit">Search</button>
    </form>
    <table>
      <thead><tr><th>User</th><th>Status</th><th>Verified</th><th>Registered</th><th>Last login</th><th>Subscription</th><th>App</th><th>Scans s/c/f</th><th>Feedback</th><th>Actions</th></tr></thead>
      <tbody>${userRows || `<tr><td colspan="10">No users.</td></tr>`}</tbody>
    </table>
  </section>
  <section id="billing">
    <h2>Subscriptions / payments</h2>
    <p class="muted">PayPal Sandbox only. Secrets are not displayed. Refunds require typing REFUND and a stored capture id.</p>
    <table>
      <thead><tr><th>Email</th><th>Plan</th><th>State</th><th>Refund</th></tr></thead>
      <tbody>${subRows || `<tr><td colspan="4">No subscription rows.</td></tr>`}</tbody>
    </table>
  </section>
  <section id="feedback">
    <h2>A. User feedback</h2>
    <p class="muted">Submitted manually from the desktop app. Status: new / reviewing / resolved. Passwords and secrets are never shown.</p>
    <h3>Desktop reports</h3>
    <table>
      <thead><tr><th>When</th><th>Email</th><th>Version</th><th>Category</th><th>Message</th><th>Status</th><th>Update</th></tr></thead>
      <tbody>${fbRows(feedback.user) || `<tr><td colspan="7">No desktop user feedback.</td></tr>`}</tbody>
    </table>
    <h3>Scan result ratings</h3>
    <table>
      <thead><tr><th>When</th><th>Email</th><th>Version</th><th>Category</th><th>Message</th><th>Status</th><th>Update</th></tr></thead>
      <tbody>${fbRows(feedback.result) || `<tr><td colspan="7">No result feedback.</td></tr>`}</tbody>
    </table>
  </section>
  <section id="system">
    <h2>B. System feedback / telemetry</h2>
    <p>Crashes/app errors: ${system.crashes.length}. Scan failures: ${system.scanFailures.length}. Update failures: ${system.updateFailures.length}. API failures: ${system.apiFailures.length}. Auth failures: ${system.authFailures.length}. Version anomalies: ${system.versionAnomalies.length}.</p>
    <p class="muted">Ordinary application errors are telemetry, not security breaches.</p>
    <table>
      <thead><tr><th>When</th><th>Kind</th><th>Severity</th><th>Version</th><th>Platform</th><th>Detail</th></tr></thead>
      <tbody>${system.events
        .slice(-30)
        .map((row) => `<tr><td>${escapeHtml(row.at)}</td><td>${escapeHtml(row.kind)}</td><td>${escapeHtml(row.severity)}</td><td>${escapeHtml(row.version)}</td><td>${escapeHtml(row.platform)}</td><td>${escapeHtml(row.detail)}</td></tr>`)
        .join("") || `<tr><td colspan="6">No system telemetry rows.</td></tr>`}</tbody>
    </table>
  </section>
  <section id="security">
    <h2>Security center</h2>
    <p class="ok">${escapeHtml(security.note)}</p>
    <p>Repeated auth details: ${escapeHtml(JSON.stringify(security.repeatedAuth))}. Breach-class alerts: ${security.alerts.length}.</p>
    <table>
      <thead><tr><th>When</th><th>Type</th><th>Detail</th><th>Email domain</th></tr></thead>
      <tbody>${secRows || `<tr><td colspan="4">No security events.</td></tr>`}</tbody>
    </table>
  </section>
  <section id="downloads">
    <h2>Download / release control</h2>
    <p>Status: <strong>${downloads.control.paused ? "PAUSED" : "live"}</strong> ${escapeHtml(downloads.control.reason || "")}</p>
    <form method="post" action="/action">
      <input type="hidden" name="action" value="pause_downloads">
      <input name="reason" maxlength="200" placeholder="Pause reason">
      <button type="submit">Pause downloads</button>
    </form>
    <form method="post" action="/action">
      <input type="hidden" name="action" value="resume_downloads">
      <button type="submit">Resume downloads</button>
    </form>
    <table>
      <thead><tr><th>File</th><th>Bytes</th><th>Hits</th></tr></thead>
      <tbody>${fileRows || `<tr><td colspan="3">No installer files.</td></tr>`}</tbody>
    </table>
    <h3>Recent download events</h3>
    <table>
      <thead><tr><th>When</th><th>Kind</th><th>Path</th><th>File</th><th>IP</th></tr></thead>
      <tbody>${eventRows || `<tr><td colspan="5">No events.</td></tr>`}</tbody>
    </table>
  </section>
  <section id="control">
    <h2>System control</h2>
    <p>Scans enabled: ${dash.ops.scansEnabled ? "yes" : "no"}. Maintenance: ${dash.ops.maintenanceMode ? "yes" : "no"}. Stage: ${dash.ops.betaStage}.</p>
    <form method="post" action="/action">
      <input type="hidden" name="action" value="ops_patch">
      <input type="hidden" name="status" value="pause_scans">
      <input name="confirm" placeholder="CONFIRM" size="8">
      <button type="submit">Pause scans</button>
    </form>
    <form method="post" action="/action">
      <input type="hidden" name="action" value="ops_patch">
      <input type="hidden" name="status" value="resume_scans">
      <input name="confirm" placeholder="CONFIRM" size="8">
      <button type="submit">Resume scans</button>
    </form>
    <form method="post" action="/action">
      <input type="hidden" name="action" value="ops_patch">
      <input type="hidden" name="status" value="maintenance_on">
      <input name="reason" placeholder="reason">
      <input name="confirm" placeholder="CONFIRM" size="8">
      <button type="submit">Maintenance on</button>
    </form>
    <form method="post" action="/action">
      <input type="hidden" name="action" value="ops_patch">
      <input type="hidden" name="status" value="maintenance_off">
      <input name="confirm" placeholder="CONFIRM" size="8">
      <button type="submit">Maintenance off</button>
    </form>
  </section>
  <section id="audit">
    <h2>Admin audit log</h2>
    <table>
      <thead><tr><th>When</th><th>Operator</th><th>Action</th><th>Target / result</th></tr></thead>
      <tbody>${auditRows || `<tr><td colspan="4">No operator actions yet.</td></tr>`}</tbody>
    </table>
  </section>
</body>
</html>`;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8000) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (!allowed(req)) {
    denied(res, 403, "Internal operator console is only on 127.0.0.1.");
    return;
  }
  const url = new URL(req.url || "/", `http://${BIND}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" });
      res.end(htmlPage(url.searchParams.get("q") || "", url.searchParams.get("notice") || ""));
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("ok\n");
      return;
    }
    if (req.method === "GET" && url.pathname === "/status") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(`${JSON.stringify({ port: PORT, ...operatorDashboard() })}\n`);
      return;
    }
    if (req.method === "POST" && (url.pathname === "/pause" || url.pathname === "/resume" || url.pathname === "/action")) {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const action =
        url.pathname === "/pause" ? "pause_downloads" : url.pathname === "/resume" ? "resume_downloads" : params.get("action") || "";
      const result = performOperatorAction({
        action,
        userId: params.get("userId") || undefined,
        status: params.get("status") || undefined,
        reason: params.get("reason") || undefined,
        feedbackId: params.get("feedbackId") || undefined,
        operatorNote: params.get("operatorNote") || undefined,
        subscriptionId: params.get("subscriptionId") || undefined,
        confirm: params.get("confirm") || undefined,
      });
      const notice = encodeURIComponent(result.message);
      res.writeHead(303, { location: `/?notice=${notice}` });
      res.end();
      return;
    }
    denied(res, 404, "Not found.");
  } catch {
    denied(res, 400, "Request failed.");
  }
});

server.listen(PORT, BIND, () => {
  process.stdout.write(`internal-operator-console ${BIND}:${PORT} (loopback, not poolindex.app)\n`);
});
