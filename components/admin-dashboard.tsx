"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_VERSION } from "@/lib/app-info";
import { useEffect, useMemo, useState } from "react";

type Summary = {
  version: string;
  ops: { scansEnabled: boolean; maintenanceMode: boolean; betaStage: 1 | 2 | 3; reason: string };
  resource: { level: string; message: string; ramUsedPct: number; ramAvailableMb: number; load1: number; cpuCount: number };
  metrics: {
    users: Record<string, number>;
    scans: Record<string, number>;
    feedback: Record<string, number>;
    telemetry: Record<string, number>;
    stage: number;
    stageCap: number;
  };
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    role: string;
    plan: string;
    scanCounts: { started: number; completed: number; failed: number };
    lastLoginAt: string | null;
    firstScanAt: string | null;
  }>;
  invites: Array<{ code: string; email: string | null; usedBy: string[]; maxUses: number; disabled: boolean }>;
};

type FeedbackRow = {
  id: string;
  type: string;
  status: string;
  note: string;
  source: string;
  userId: string;
  email: string | null;
  appVersion: string;
  createdAt: string;
  urlHost: string;
};

export function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [reason, setReason] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setError(null);
    const [sumRes, feedRes] = await Promise.all([
      fetch("/api/admin/summary"),
      fetch(`/api/admin/feedback?type=${encodeURIComponent(typeFilter)}&status=${encodeURIComponent(statusFilter)}`),
    ]);
    const sumJson = (await sumRes.json().catch(() => ({}))) as Summary & { error?: string };
    const feedJson = (await feedRes.json().catch(() => ({}))) as { feedback?: FeedbackRow[]; error?: string };
    if (!sumRes.ok) {
      setError(sumJson.error || "Admin access denied");
      return;
    }
    setSummary(sumJson);
    setFeedback(feedJson.feedback ?? []);
    setReason(sumJson.ops.reason || "");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const recent = useMemo(() => summary?.users.slice().sort((a, b) => (b.lastLoginAt || "").localeCompare(a.lastLoginAt || "")).slice(0, 8) ?? [], [summary]);

  async function patchOps(body: Record<string, unknown>) {
    await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await load();
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: inviteEmail || undefined, maxUses: 1, note: "Closed Beta" }),
    });
    setInviteEmail("");
    await load();
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!summary) return <p className="text-sm text-muted-foreground">Loading control center…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Registered", summary.metrics.users.registered],
          ["Verified", summary.metrics.users.verified],
          ["Active", summary.metrics.users.active],
          ["Disabled", summary.metrics.users.disabled],
          ["Scans started", summary.metrics.scans.started],
          ["Scans completed", summary.metrics.scans.completed],
          ["Scans failed", summary.metrics.scans.failed],
          ["Feedback new", summary.metrics.feedback.new],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border/80 bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-heading text-2xl">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Server health</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Version {summary.version || APP_VERSION} · {summary.resource.level} · RAM {summary.resource.ramUsedPct}% ·{" "}
          {summary.resource.ramAvailableMb} MB free · load {summary.resource.load1}/{summary.resource.cpuCount}
        </p>
        <p className="mt-1 text-sm">{summary.resource.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Stage {summary.ops.betaStage} cap {summary.metrics.stageCap} · scans {summary.ops.scansEnabled ? "on" : "stopped"} ·
          maintenance {summary.ops.maintenanceMode ? "on" : "off"}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <Button variant="destructive" onClick={() => void patchOps({ scansEnabled: false, reason })}>
            Stop new scans
          </Button>
          <Button variant="outline" onClick={() => void patchOps({ maintenanceMode: true, scansEnabled: false, reason })}>
            Maintenance
          </Button>
          <Button onClick={() => void patchOps({ scansEnabled: true, maintenanceMode: false, reason: "" })}>
            Resume
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant={summary.ops.betaStage === 1 ? "default" : "outline"} onClick={() => void patchOps({ betaStage: 1 })}>
            Stage 1 (10)
          </Button>
          <Button size="sm" variant={summary.ops.betaStage === 2 ? "default" : "outline"} onClick={() => void patchOps({ betaStage: 2 })}>
            Stage 2 (20)
          </Button>
          <Button size="sm" variant={summary.ops.betaStage === 3 ? "default" : "outline"} onClick={() => void patchOps({ betaStage: 3 })}>
            Stage 3 (50)
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Invites</h2>
        <form className="mt-3 flex gap-2" onSubmit={createInvite}>
          <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Optional bound email" />
          <Button type="submit">Create invite</Button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {summary.invites.map((invite) => (
            <li key={invite.code} className="font-mono text-xs">
              {invite.code} · used {invite.usedBy.length}/{invite.maxUses}
              {invite.email ? ` · ${invite.email}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Users</h2>
        <p className="mt-1 text-xs text-muted-foreground">Passwords and hashes are never shown.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Email</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Scans</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summary.users.map((user) => (
                <tr key={user.id} className="border-t border-border/60">
                  <td className="py-2">
                    {user.displayName}
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td>{user.status}</td>
                  <td>{user.plan}</td>
                  <td>
                    {user.scanCounts.completed}/{user.scanCounts.failed} fail
                  </td>
                  <td className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => void patchUser(user.id, { status: user.status === "active" ? "suspended" : "active" })}>
                      {user.status === "suspended" || user.status === "disabled" ? "Activate" : "Suspend"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void patchUser(user.id, { status: "disabled" })}>
                      Disable
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void patchUser(user.id, { plan: user.plan === "paid" ? "free" : "paid" })}>
                      {user.plan === "paid" ? "Make Free" : "Make Poolindex Pro"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-4 text-sm font-medium">Recent activity</h3>
        <ul className="mt-2 text-xs text-muted-foreground">
          {recent.map((user) => (
            <li key={user.id}>
              {user.email} · last login {user.lastLoginAt || "never"} · first scan {user.firstScanAt || "none"}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Feedback queue</h2>
        <div className="mt-3 flex gap-2">
          <Input value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="type" />
          <Input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="status" />
        </div>
        <ul className="mt-3 space-y-3">
          {feedback.map((row) => (
            <li key={row.id} className="rounded-md border border-border/60 p-3 text-sm">
              <p>
                {row.type} · {row.status} · {row.email || row.userId} · {row.source || "n/a"} · {row.appVersion}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.createdAt} · {row.urlHost} · {row.note || "no note"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {["new", "investigating", "fixed", "closed"].map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void fetch("/api/admin/feedback", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: row.id, status }),
                      }).then(load)
                    }
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
