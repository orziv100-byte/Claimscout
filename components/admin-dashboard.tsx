"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_VERSION } from "@/lib/app-info";
import { useEffect, useMemo, useState } from "react";

type Summary = {
  version: string;
  ops: { scansEnabled: boolean; maintenanceMode: boolean; betaStage: 1 | 2 | 3; reason: string };
  resource: { level: string; message: string; ramUsedPct: number; ramAvailableMb: number; load1: number; cpuCount: number };
  hunts?: {
    active: number;
    queued: number;
    paused: number;
    failed: number;
    completed: number;
    sourcesChecked: number;
    leadsCreated: number;
    hunts: Array<{ id: string; userId: string; query: string; status: string; stage: string; leadCount: number }>;
  };
  sourceFeedback?: Array<{ source: string; total: number; byType: Record<string, number>; currentTier: string }>;
  engineSources?: Array<{
    id: string;
    protocol: string;
    chainLabel: string;
    category: string;
    scanMethod: string;
    adapterVersion: string;
    frequency: string;
    important: boolean;
    status: string;
    lastError?: string;
    consecutiveFailures: number;
    paused?: boolean;
  }>;
  sourceRepairs?: Array<{
    id: string;
    sourceId: string;
    status: string;
    diagnosis: string;
    suggestedAction: string;
    lastError: string;
    consecutiveFailures: number;
    research: { protocol: string; chainLabel: string; scanMethod: string; officialUrl?: string; notes: string };
    updatedAt: string;
  }>;
  operatorLearning?: {
    autoProductionChanges: boolean;
    engineAdapterCount: number;
    competitors: Array<{
      id: string;
      name: string;
      url: string;
      license: string;
      stance: string;
      notes: string;
      lastReviewedAt: string;
    }>;
    proposals: Array<{
      id: string;
      origin: string;
      status: string;
      title: string;
      detail: string;
      catalogId?: string;
      chain?: string;
      officialUrl?: string;
      feedbackType?: string;
    }>;
  };
  metrics: {
    users: Record<string, number>;
    scans: Record<string, number>;
    feedback: Record<string, number>;
    telemetry: Record<string, number>;
    stage: number;
    stageCap: number;
    funnel?: {
      cap: number;
      registered: number;
      emailVerified: number;
      walletBound: number;
      walletScanStarted: number;
      walletScanCompleted: number;
      withPotential: number;
      withVerified: number;
      alerted: number;
      returning: number;
      rates: Record<string, number | null>;
      totals: { started: number; completed: number; failed: number };
    };
  };
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    role: string;
    plan: string;
    wallets?: string[];
    scanCounts: { started: number; completed: number; failed: number };
    lastLoginAt: string | null;
    firstScanAt: string | null;
    lastScanAt?: string | null;
    deletionStatus?: string;
  }>;
  invites: Array<{ code: string; email: string | null; usedBy: string[]; maxUses: number; disabled: boolean }>;
  deletionRequests?: Array<{
    id: string;
    userId: string;
    status: string;
    requestedAt: string;
    processedAt: string | null;
  }>;
  privacyRequests?: Array<{ id: string; userId: string; type: string; status: string; createdAt: string }>;
  legal?: { ok: boolean; blockers: string[]; notes: string[]; missingContacts: string[] };
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

type Me = { id: string; email: string; role: string; totpEnabled?: boolean } | null;

function parseOtpauthSecret(otpauth: string): string {
  const match = otpauth.match(/[?&]secret=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [reason, setReason] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [me, setMe] = useState<Me>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  const [enrollOtpauth, setEnrollOtpauth] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function load() {
    setError(null);
    const [meRes, sumRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/admin/summary")]);
    const meJson = (await meRes.json().catch(() => ({}))) as { user?: Me };
    setMe(meJson.user ?? null);
    const sumJson = (await sumRes.json().catch(() => ({}))) as Summary & { error?: string; code?: string };
    if (!sumRes.ok) {
      if (sumJson.code === "MFA_REQUIRED") {
        setMfaRequired(true);
        return;
      }
      setError(sumJson.error || "Admin access denied");
      return;
    }
    setMfaRequired(false);
    setSummary(sumJson);
    setReason(sumJson.ops.reason || "");
    const feedRes = await fetch(`/api/admin/feedback?type=${encodeURIComponent(typeFilter)}&status=${encodeURIComponent(statusFilter)}`);
    const feedJson = (await feedRes.json().catch(() => ({}))) as { feedback?: FeedbackRow[]; error?: string };
    setFeedback(feedJson.feedback ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    setMfaError(null);
    setMfaBusy(true);
    try {
      const res = await fetch("/api/admin/mfa-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "That code is not valid.");
      setMfaCode("");
      await load();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "That code is not valid.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function startEnroll() {
    setEnrollError(null);
    setEnrollBusy(true);
    try {
      const res = await fetch("/api/admin/mfa-enroll", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const json = (await res.json().catch(() => ({}))) as { otpauth?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not start enrollment.");
      setEnrollOtpauth(json.otpauth ?? null);
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : "Could not start enrollment.");
    } finally {
      setEnrollBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrollError(null);
    setEnrollBusy(true);
    try {
      const res = await fetch("/api/admin/mfa-confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: enrollCode.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { recoveryCodes?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error || "That code is not valid.");
      setRecoveryCodes(json.recoveryCodes ?? []);
      setEnrollOtpauth(null);
      setEnrollCode("");
      await load();
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : "That code is not valid.");
    } finally {
      setEnrollBusy(false);
    }
  }

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

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (mfaRequired) {
    return (
      <section className="max-w-md rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Admin authenticator required</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, or one of your saved recovery codes.
        </p>
        <form onSubmit={verifyMfa} className="mt-4 flex flex-col gap-3">
          <label htmlFor="mfa-code" className="text-sm">
            Code
            <Input
              id="mfa-code"
              className="mt-1"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </label>
          {mfaError ? (
            <p className="text-sm text-destructive" role="alert">
              {mfaError}
            </p>
          ) : null}
          <Button type="submit" disabled={mfaBusy} aria-busy={mfaBusy}>
            {mfaBusy ? "Verifying…" : "Verify"}
          </Button>
        </form>
      </section>
    );
  }

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
        <h2 className="font-heading text-xl">Admin security</h2>
        {me?.totpEnabled ? (
          <p className="mt-2 text-sm text-muted-foreground">Authenticator app (TOTP) is enabled for this admin account.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              No authenticator app enrolled yet. Once enabled, every admin sign-in needs a 6-digit code or a saved
              recovery code. Regular users never need this.
            </p>
            {recoveryCodes ? (
              <div className="mt-3 rounded-md border border-border/60 p-3">
                <p className="text-sm font-medium">Save these recovery codes now — shown once</p>
                <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-4">
                  {recoveryCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
                <Button size="sm" className="mt-3" onClick={() => setRecoveryCodes(null)}>
                  I&apos;ve saved these codes
                </Button>
              </div>
            ) : enrollOtpauth ? (
              <form onSubmit={confirmEnroll} className="mt-3 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Add this to an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit
                  code to confirm.
                </p>
                <p className="break-all rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-xs">{enrollOtpauth}</p>
                <label htmlFor="enroll-secret" className="text-xs text-muted-foreground">
                  Manual entry secret
                  <Input
                    id="enroll-secret"
                    className="mt-1 font-mono"
                    readOnly
                    value={parseOtpauthSecret(enrollOtpauth)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <label htmlFor="enroll-code" className="text-sm">
                  6-digit code
                  <Input
                    id="enroll-code"
                    className="mt-1"
                    value={enrollCode}
                    onChange={(e) => setEnrollCode(e.target.value)}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                </label>
                {enrollError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {enrollError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={enrollBusy} aria-busy={enrollBusy}>
                    {enrollBusy ? "Confirming…" : "Confirm & enable"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEnrollOtpauth(null);
                      setEnrollError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <Button className="mt-3" onClick={() => void startEnroll()} disabled={enrollBusy}>
                  {enrollBusy ? "Starting…" : "Enable authenticator app"}
                </Button>
                {enrollError ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {enrollError}
                  </p>
                ) : null}
              </>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Closed Beta funnel</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Unique invited users through registration → wallet → successful scan → Potential → Verified → alert →
          return use. Cap {summary.metrics.funnel?.cap ?? 50} invited users. Catalog hunts are counted separately
          from wallet-engine scans.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Registered", summary.metrics.funnel?.registered, null],
              ["Email verified", summary.metrics.funnel?.emailVerified, summary.metrics.funnel?.rates.emailVerified],
              ["Wallet bound", summary.metrics.funnel?.walletBound, summary.metrics.funnel?.rates.walletBound],
              ["Scan completed", summary.metrics.funnel?.walletScanCompleted, summary.metrics.funnel?.rates.walletScanCompleted],
              ["Potential", summary.metrics.funnel?.withPotential, summary.metrics.funnel?.rates.withPotential],
              ["Verified", summary.metrics.funnel?.withVerified, summary.metrics.funnel?.rates.withVerified],
              ["Alerted", summary.metrics.funnel?.alerted, summary.metrics.funnel?.rates.alerted],
              ["Returning", summary.metrics.funnel?.returning, summary.metrics.funnel?.rates.returning],
            ] as const
          ).map(([label, value, rate]) => (
            <li key={label} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-heading text-2xl">{value ?? 0}</p>
              {rate != null ? <p className="text-xs text-muted-foreground">{rate}% of previous step</p> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Wallet-engine totals: {summary.metrics.funnel?.totals.started ?? 0} started ·{" "}
          {summary.metrics.funnel?.totals.completed ?? 0} completed · {summary.metrics.funnel?.totals.failed ?? 0}{" "}
          failed · {summary.metrics.telemetry.walletAlert ?? 0} alerts sent
        </p>
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
          <label htmlFor="ops-reason" className="sr-only">
            Reason
          </label>
          <Input id="ops-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
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
        <h2 className="font-heading text-xl">Engine sources</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.engineSources?.length ?? 0} adapters ·{" "}
          {(summary.engineSources ?? []).filter((row) => row.status === "failed").length} failed · frequency and last
          error are recorded. Failed sources stay listed; they do not invent eligibility.
        </p>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
          {(summary.engineSources ?? [])
            .filter((row) => row.status === "failed" || row.important)
            .slice(0, 40)
            .map((row) => (
              <li key={row.id} className="border-t border-border/60 py-2">
                <span className="font-medium">{row.id}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {row.chainLabel} · {row.scanMethod} · v{row.adapterVersion} · {row.status}
                  {row.consecutiveFailures ? ` · ${row.consecutiveFailures} fail(s)` : ""}
                </span>
                {row.lastError ? <div className="text-xs text-muted-foreground">{row.lastError}</div> : null}
                {row.paused ? <div className="text-xs text-muted-foreground">Paused until Restore</div> : null}
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Broken sources</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Detect → Diagnose → sandbox proposal → human Approve → Restore. Without Approve the live adapter keeps
          running and still reports the real error. Approve never invents eligibility.
        </p>
        <ul className="mt-3 space-y-3">
          {(summary.sourceRepairs ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No broken-source cases.</li>
          ) : (
            (summary.sourceRepairs ?? []).map((row) => (
              <li key={row.id} className="rounded-md border border-border/60 p-3 text-sm">
                <p className="font-medium">
                  {row.sourceId} · {row.status} · {row.diagnosis}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.research.chainLabel} · {row.research.scanMethod} · suggest {row.suggestedAction.replaceAll("_", " ")}
                  {row.consecutiveFailures ? ` · ${row.consecutiveFailures} fail(s)` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{row.lastError}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.research.notes}</p>
                {row.research.officialUrl ? (
                  <p className="mt-1 text-xs">
                    <a href={row.research.officialUrl} className="underline" target="_blank" rel="noreferrer">
                      Official source
                    </a>
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.status === "proposed" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          void fetch("/api/admin/repairs", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: row.id, decision: "approve" }),
                          }).then(load)
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void fetch("/api/admin/repairs", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: row.id, decision: "reject" }),
                          }).then(load)
                        }
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {row.status === "approved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void fetch("/api/admin/repairs", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: row.id, decision: "restore" }),
                        }).then(load)
                      }
                    >
                      Restore
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Operator learning</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Internal research only. Competitor notes and source proposals never auto-change production adapters (
          {summary.operatorLearning?.engineAdapterCount ?? 0} live). Catalog gaps without a hosted merkle lookup are
          Request Coverage, not paid bugfixes. Accept queues a future human deploy; it does not write the catalog or
          engine.
        </p>
        <h3 className="mt-4 text-sm font-medium">Competitors</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {(summary.operatorLearning?.competitors ?? []).map((row) => (
            <li key={row.id} className="rounded-md border border-border/60 p-3">
              <p className="font-medium">
                {row.name} · {row.license} · {row.stance.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
              <p className="mt-1 text-xs">
                <a href={row.url} className="underline" target="_blank" rel="noreferrer">
                  Research URL
                </a>
              </p>
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-medium">Source proposals</h3>
        <ul className="mt-2 space-y-3">
          {(summary.operatorLearning?.proposals ?? []).slice(0, 20).map((row) => (
            <li key={row.id} className="rounded-md border border-border/60 p-3 text-sm">
              <p className="font-medium">
                {row.title} · {row.status} · {row.origin.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.chain ? `${row.chain} · ` : ""}
                {row.detail}
              </p>
              {row.officialUrl ? (
                <p className="mt-1 text-xs">
                  <a href={row.officialUrl} className="underline" target="_blank" rel="noreferrer">
                    Official source
                  </a>
                </p>
              ) : null}
              {row.status === "queued" ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    onClick={() =>
                      void fetch("/api/admin/learning", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ kind: "proposal", id: row.id, decision: "accepted" }),
                      }).then(load)
                    }
                  >
                    Accept (no deploy)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void fetch("/api/admin/learning", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ kind: "proposal", id: row.id, decision: "rejected" }),
                      }).then(load)
                    }
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
              {row.status === "accepted" ? (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void fetch("/api/admin/learning", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ kind: "proposal", id: row.id, decision: "shipped" }),
                      }).then(load)
                    }
                  >
                    Mark shipped after code deploy
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Hunts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Active {summary.hunts?.active ?? 0} · queued {summary.hunts?.queued ?? 0} · paused {summary.hunts?.paused ?? 0} ·
          failed {summary.hunts?.failed ?? 0} · completed {summary.hunts?.completed ?? 0} · sources{" "}
          {summary.hunts?.sourcesChecked ?? 0} · leads {summary.hunts?.leadsCreated ?? 0}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(summary.hunts?.hunts ?? []).slice(0, 12).map((hunt) => (
            <li key={hunt.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 py-2">
              <span>
                {hunt.query} · {hunt.status} · {hunt.stage} · {hunt.leadCount} leads
              </span>
              {hunt.status === "running" || hunt.status === "paused" || hunt.status === "queued" ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void fetch("/api/admin/hunts", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ huntId: hunt.id }),
                    }).then(load)
                  }
                >
                  Stop hunt
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {summary.sourceFeedback?.length ? (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Source feedback (review only — does not auto-change trust)</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {summary.sourceFeedback.map((row) => (
                <li key={row.source}>
                  {row.source} tier {row.currentTier}: {row.total} reports
                  {Object.entries(row.byType)
                    .map(([type, count]) => ` · ${type} ${count}`)
                    .join("")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Invites</h2>
        <form className="mt-3 flex gap-2" onSubmit={createInvite}>
          <label htmlFor="invite-email" className="sr-only">
            Optional invite email
          </label>
          <Input id="invite-email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Optional bound email" />
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
                <th>Wallets</th>
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
                  <td>{user.wallets?.length ?? 0}</td>
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
                      {user.plan === "paid" ? "Make Free" : "Make PoolIndex Pro"}
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
        <h2 className="font-heading text-xl">Account closure requests</h2>
        {summary.legal && !summary.legal.ok ? (
          <p className="mt-2 text-sm text-destructive" role="status">
            Legal readiness blockers: {summary.legal.blockers.join(" ")}
          </p>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm">
          {(summary.deletionRequests ?? []).map((row) => (
            <li key={row.id} className="rounded-md border border-border/60 p-3">
              <p>
                {row.userId} · {row.status} · {row.requestedAt}
              </p>
              {row.status === "requested" ? (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void fetch("/api/admin/deletions", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ requestId: row.id, decision: "complete" }),
                      }).then(load)
                    }
                    aria-label={`Process closure for ${row.userId}`}
                  >
                    Process closure
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void fetch("/api/admin/deletions", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ requestId: row.id, decision: "reject" }),
                      }).then(load)
                    }
                    aria-label={`Reject closure for ${row.userId}`}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-medium">Privacy requests</h3>
        <ul className="mt-2 text-xs text-muted-foreground">
          {(summary.privacyRequests ?? []).map((row) => (
            <li key={row.id}>
              {row.type} · {row.status} · {row.userId} · {row.createdAt}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5">
        <h2 className="font-heading text-xl">Feedback queue</h2>
        <div className="mt-3 flex gap-2">
          <label htmlFor="feedback-type" className="sr-only">
            Feedback type filter
          </label>
          <Input id="feedback-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="type" />
          <label htmlFor="feedback-status" className="sr-only">
            Feedback status filter
          </label>
          <Input id="feedback-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="status" />
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
