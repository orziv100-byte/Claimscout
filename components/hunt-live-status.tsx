import { formatElapsed, HUNT_STAGE_LABEL, HUNT_STATUS_LABEL } from "@/lib/labels";
import type { HuntRecord } from "@/lib/intelligence/types";

/** Visible counters plus a live region that omits elapsed time so ticks do not flood assistive tech. */
export function HuntLiveStatus({ hunt }: { hunt: HuntRecord }) {
  const status = HUNT_STATUS_LABEL[hunt.status] ?? hunt.status;
  const stage = HUNT_STAGE_LABEL[hunt.stage] ?? hunt.stage;
  const leads = hunt.progress.leadsCreated;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {status} · {stage} · elapsed {formatElapsed(hunt.elapsedMs)} · {leads} leads · {hunt.progress.strongEvidence}{" "}
        strong evidence
        {hunt.mode === "continuous" ? " · Continuous Hunt (periodic public re-check)" : ""}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Deep Hunt {status}, stage {stage}, {leads} leads
        {hunt.mode === "continuous" ? ", Continuous Hunt running" : ""}
      </p>
    </>
  );
}
