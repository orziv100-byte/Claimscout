"use client";

import { HUNT_STAGE_LABEL, HUNT_STATUS_LABEL } from "@/lib/labels";
import type { HuntSummary } from "@/lib/intelligence/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export function HuntList() {
  const [hunts, setHunts] = useState<HuntSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hunt")
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { hunts?: HuntSummary[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load hunts");
        setHunts(json.hunts ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load hunts"));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!hunts.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No hunts yet. Run a live scan, then choose Start Deep Hunt.{" "}
        <Link href="/discover" className="text-primary hover:underline">
          Live scan
        </Link>
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {hunts.map((hunt) => (
        <li key={hunt.id} className="rounded-xl border border-border/80 bg-card p-4">
          <Link href={`/hunts/${hunt.id}`} className="font-heading text-lg hover:underline">
            {hunt.query}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {HUNT_STATUS_LABEL[hunt.status]} · {HUNT_STAGE_LABEL[hunt.stage]} · {hunt.progress.leadsCreated} leads ·{" "}
            {hunt.progress.sourcesChecked} sources
            {hunt.progress.sourcesQueued ? ` / ${hunt.progress.sourcesQueued}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
