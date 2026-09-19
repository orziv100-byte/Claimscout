"use client";

import { LeadCard } from "@/components/lead-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatElapsed, HUNT_STAGE_LABEL, HUNT_STATUS_LABEL } from "@/lib/labels";
import type { HuntRecord, ReturnDigest, SeedDiscovery } from "@/lib/intelligence/types";
import type { CatalogClaim, DiscoveredClaim } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HuntPayload = { hunt?: HuntRecord; digest?: ReturnDigest; error?: string };

export function DeepHuntPanel({
  query,
  catalog,
  discovered,
  wallet,
}: {
  query: string;
  catalog: CatalogClaim[];
  discovered: DiscoveredClaim[];
  wallet?: string;
}) {
  const [hunt, setHunt] = useState<HuntRecord | null>(null);
  const [digest, setDigest] = useState<ReturnDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seed = useMemo(
    () => ({
      catalogIds: catalog.map((row) => row.id),
      discovered: discovered.map(
        (item): SeedDiscovery => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          url: item.url,
          kind: item.kind,
          source: item.source,
          sourceLabel: item.sourceLabel,
          publishedAt: item.publishedAt,
          legitimacy: item.legitimacy,
          flags: item.flags,
          archiveUrl: item.archiveUrl,
          catalogId: item.catalogId,
        }),
      ),
    }),
    [catalog, discovered],
  );

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hunt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, huntId: hunt?.id, query, wallet, seed, ...extra }),
    });
    const json = (await res.json().catch(() => ({}))) as HuntPayload;
    if (!res.ok) {
      setError(json.error || "Deep Hunt request failed");
      setBusy(false);
      return;
    }
    if (json.hunt) setHunt(json.hunt);
    if (json.digest) setDigest(json.digest);
    setBusy(false);
  }

  useEffect(() => {
    if (!hunt || hunt.status !== "running") return;
    const timer = window.setInterval(() => {
      void call("tick");
    }, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt?.id, hunt?.status]);

  const progress = hunt?.progress;
  const knownTotal = progress && progress.sourcesQueued > 0 ? progress.sourcesQueued : null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-2xl">Deep Hunt</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue investigating across additional sources, historical records and public blockchain data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!hunt || hunt.status === "completed" || hunt.status === "stopped" ? (
            <Button onClick={() => void call("start")} disabled={busy || !query}>
              Start Deep Hunt
            </Button>
          ) : null}
          {hunt?.status === "running" ? (
            <Button variant="outline" onClick={() => void call("pause")} disabled={busy}>
              Pause
            </Button>
          ) : null}
          {hunt?.status === "paused" ? (
            <Button onClick={() => void call("resume")} disabled={busy}>
              Resume
            </Button>
          ) : null}
          {hunt && hunt.status !== "stopped" && hunt.status !== "completed" ? (
            <Button variant="destructive" onClick={() => void call("stop")} disabled={busy}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Deep Hunt</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {hunt?.pauseReason ? (
        <Alert>
          <AlertTitle>{HUNT_STATUS_LABEL[hunt.status]}</AlertTitle>
          <AlertDescription>{hunt.pauseReason}</AlertDescription>
        </Alert>
      ) : null}
      {hunt ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{HUNT_STATUS_LABEL[hunt.status]}</Badge>
            <Badge variant="outline">Current stage: {HUNT_STAGE_LABEL[hunt.stage] ?? hunt.stage}</Badge>
            <span>Elapsed {formatElapsed(hunt.elapsedMs)}</span>
            {hunt.id ? (
              <Link href={`/hunts/${hunt.id}`} className="text-primary hover:underline">
                Open hunt
              </Link>
            ) : null}
          </div>
          {progress ? (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              <li>
                Sources checked: {progress.sourcesChecked}
                {knownTotal ? ` / ${knownTotal}` : ""}
              </li>
              <li>Pages inspected: {progress.pagesInspected}</li>
              <li>Raw discoveries: {progress.rawDiscoveries}</li>
              <li>Leads created: {progress.leadsCreated}</li>
              <li>Strong evidence: {progress.strongEvidence}</li>
              <li>Investigating: {progress.investigating}</li>
              <li>Rejected: {progress.rejected}</li>
            </ul>
          ) : null}
          {digest && digest.previousHuntId ? (
            <div className="rounded-lg border border-border/70 p-3 text-sm">
              <p className="font-medium">Since your last hunt</p>
              <p className="mt-1 text-muted-foreground">
                {digest.sourcesRechecked} sources rechecked · {digest.sourcesChanged} sources changed · {digest.newLeads}{" "}
                new leads · {digest.strongerEvidence} stronger evidence · {digest.statusChanges} status changes ·{" "}
                {digest.securityWarnings} security warnings
              </p>
            </div>
          ) : null}
          <div className="grid gap-3">
            {hunt.leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Initial results above stay available. Deep Hunt is optional and uses only public, read-only sources.
        </p>
      )}
    </section>
  );
}
