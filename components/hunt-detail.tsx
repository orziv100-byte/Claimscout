"use client";

import { LeadCard } from "@/components/lead-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatElapsed, HUNT_STAGE_LABEL, HUNT_STATUS_LABEL } from "@/lib/labels";
import type { HuntRecord, ReturnDigest } from "@/lib/intelligence/types";
import { useEffect, useState } from "react";

export function HuntDetail({ huntId }: { huntId: string }) {
  const [hunt, setHunt] = useState<HuntRecord | null>(null);
  const [digest, setDigest] = useState<ReturnDigest | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/hunt?id=${encodeURIComponent(huntId)}`);
    const json = (await res.json().catch(() => ({}))) as { hunt?: HuntRecord; digest?: ReturnDigest; error?: string };
    if (!res.ok) {
      setError(json.error || "Hunt not found");
      return;
    }
    setHunt(json.hunt ?? null);
    setDigest(json.digest ?? null);
  }

  async function act(action: string) {
    const res = await fetch("/api/hunt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, huntId }),
    });
    const json = (await res.json().catch(() => ({}))) as { hunt?: HuntRecord; digest?: ReturnDigest; error?: string };
    if (!res.ok) {
      setError(json.error || "Request failed");
      return;
    }
    if (json.hunt) setHunt(json.hunt);
    if (json.digest) setDigest(json.digest);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntId]);

  useEffect(() => {
    if (!hunt || hunt.status !== "running") return;
    const timer = window.setInterval(() => {
      void act("tick");
    }, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt?.id, hunt?.status]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!hunt) return <p className="text-sm text-muted-foreground">Loading hunt…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">{hunt.query}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {HUNT_STATUS_LABEL[hunt.status]} · {HUNT_STAGE_LABEL[hunt.stage]} · elapsed {formatElapsed(hunt.elapsedMs)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hunt.status === "running" ? (
            <Button variant="outline" onClick={() => void act("pause")}>
              Pause
            </Button>
          ) : null}
          {hunt.status === "paused" ? <Button onClick={() => void act("resume")}>Resume</Button> : null}
          {hunt.status === "running" || hunt.status === "paused" || hunt.status === "queued" ? (
            <Button variant="destructive" onClick={() => void act("stop")}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>
      {hunt.pauseReason ? (
        <Alert>
          <AlertTitle>Paused</AlertTitle>
          <AlertDescription>{hunt.pauseReason}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          Sources checked: {hunt.progress.sourcesChecked}
          {hunt.progress.sourcesQueued ? ` / ${hunt.progress.sourcesQueued}` : ""}
        </Badge>
        <Badge variant="secondary">Pages {hunt.progress.pagesInspected}</Badge>
        <Badge variant="secondary">Raw {hunt.progress.rawDiscoveries}</Badge>
        <Badge variant="secondary">Leads {hunt.progress.leadsCreated}</Badge>
        <Badge variant="secondary">Strong evidence {hunt.progress.strongEvidence}</Badge>
      </div>
      {digest?.previousHuntId ? (
        <p className="text-sm text-muted-foreground">
          Since your last hunt: {digest.sourcesRechecked} rechecked · {digest.sourcesChanged} changed · {digest.newLeads}{" "}
          new leads · {digest.strongerEvidence} stronger evidence · {digest.securityWarnings} warnings
        </p>
      ) : null}
      <div className="grid gap-3">
        {hunt.leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}
