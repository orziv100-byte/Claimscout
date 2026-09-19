"use client";

import { Button } from "@/components/ui/button";
import { FEEDBACK_TYPES } from "@/lib/beta-types";
import { useState } from "react";

const LABELS: Record<(typeof FEEDBACK_TYPES)[number], string> = {
  useful: "Useful",
  already_knew: "Already Knew",
  not_relevant: "Not Relevant",
  expired: "Expired",
  broken_link: "Broken Link",
  suspicious: "Suspicious",
  potential_scam: "Potential Scam",
  claimed_successfully: "Claimed Successfully",
  report_problem: "Report Problem",
};

export function ResultFeedback({
  source,
  claimId,
  leadId,
  url,
}: {
  source?: string;
  claimId?: string;
  leadId?: string;
  url?: string;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function send(type: (typeof FEEDBACK_TYPES)[number]) {
    setStatus(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, note, source, claimId, leadId, url }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus(json.error || "Could not send feedback");
      return;
    }
    setNote("");
    setStatus("Thanks — feedback sent to the Beta operator.");
  }

  return (
    <div className="mt-3 rounded-lg border border-border/70 p-3">
      <p className="text-xs font-medium">Was this result useful?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FEEDBACK_TYPES.map((type) => (
          <Button key={type} type="button" size="sm" variant="outline" onClick={() => void send(type)}>
            {LABELS[type]}
          </Button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Optional short note (no seeds or private keys)"
        className="mt-2 min-h-16 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
      />
      {status ? <p className="mt-1 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
