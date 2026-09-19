import type { CatalogClaim, ClaimStatus } from "./types";

export type WatchPool = {
  claimId: string;
  remaining?: string;
  symbol?: string;
  error?: string;
};

export type WatchOffer = {
  claimId: string;
  title: string;
  status: ClaimStatus;
  asset: string;
  remaining?: string;
  symbol?: string;
  poolError?: string;
};

export type WatchSnapshot = {
  capturedAt: string;
  offers: WatchOffer[];
};

export type WatchChangeKind =
  | "baseline"
  | "new_offer"
  | "removed_offer"
  | "status_changed"
  | "pool_changed";

export type WatchChange = {
  claimId: string;
  title: string;
  kind: WatchChangeKind;
  summary: string;
};

export function buildWatchSnapshot(
  claims: CatalogClaim[],
  pools: WatchPool[],
  capturedAt = new Date().toISOString(),
): WatchSnapshot {
  const poolById = new Map(pools.map((pool) => [pool.claimId, pool]));
  const offers: WatchOffer[] = claims
    .filter((claim) => claim.id !== "tornado-avoided")
    .map((claim) => {
      const pool = poolById.get(claim.id);
      return {
        claimId: claim.id,
        title: claim.title,
        status: claim.status,
        asset: claim.asset,
        remaining: pool?.remaining,
        symbol: pool?.symbol,
        poolError: pool?.error,
      };
    });
  return { capturedAt, offers };
}

export function diffWatchSnapshots(prev: WatchSnapshot | null, next: WatchSnapshot): WatchChange[] {
  if (!prev) {
    return [
      {
        claimId: "catalog",
        title: "Catalog watch",
        kind: "baseline",
        summary: `Initial catalog watch: ${next.offers.length} public offers. Later runs only report changes.`,
      },
    ];
  }

  const changes: WatchChange[] = [];
  const prevById = new Map(prev.offers.map((offer) => [offer.claimId, offer]));
  const nextIds = new Set(next.offers.map((offer) => offer.claimId));

  for (const offer of next.offers) {
    const before = prevById.get(offer.claimId);
    if (!before) {
      changes.push({
        claimId: offer.claimId,
        title: offer.title,
        kind: "new_offer",
        summary: `New documented offer: ${offer.title} (${offer.asset}, ${offer.status}).`,
      });
      continue;
    }
    if (before.status !== offer.status) {
      changes.push({
        claimId: offer.claimId,
        title: offer.title,
        kind: "status_changed",
        summary: `${offer.title} status ${before.status} → ${offer.status}.`,
      });
    }
    const beforePool = poolKey(before);
    const afterPool = poolKey(offer);
    if (beforePool !== afterPool && meaningfullyChanged(before, offer)) {
      changes.push({
        claimId: offer.claimId,
        title: offer.title,
        kind: "pool_changed",
        summary: poolChangeSummary(before, offer),
      });
    }
  }

  for (const offer of prev.offers) {
    if (!nextIds.has(offer.claimId)) {
      changes.push({
        claimId: offer.claimId,
        title: offer.title,
        kind: "removed_offer",
        summary: `Removed from catalog: ${offer.title}.`,
      });
    }
  }

  return changes;
}

export function openWatchPools(snapshot: WatchSnapshot): WatchOffer[] {
  return snapshot.offers.filter((offer) => {
    if (offer.status === "expired" || offer.status === "archived") return false;
    const n = Number(offer.remaining);
    return Number.isFinite(n) && n > 0;
  });
}

export function formatWatchDigest(input: {
  capturedAt: string;
  changes: WatchChange[];
  openPools: WatchOffer[];
}): string {
  const lines = [
    `# Poolindex catalog watch`,
    `Captured ${input.capturedAt}`,
    "",
  ];
  if (input.changes.length === 0) {
    lines.push("No catalog or remaining-pool changes since the last snapshot.");
  } else {
    lines.push("## Changes");
    for (const change of input.changes) {
      lines.push(`- ${change.summary}`);
    }
  }
  lines.push("", "## Remaining pools still above zero");
  lines.push("Remaining contract balance is not proof that a claim is open or that you are eligible.");
  if (input.openPools.length === 0) {
    lines.push("- None readable this run.");
  } else {
    for (const offer of input.openPools) {
      lines.push(`- ${offer.title}: ${trimPool(offer.remaining)} ${offer.symbol ?? offer.asset}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function poolKey(offer: WatchOffer): string {
  if (offer.remaining == null) return offer.poolError ? `err:${offer.poolError}` : "none";
  const n = Number(offer.remaining);
  if (!Number.isFinite(n)) return `${offer.remaining}:${offer.symbol ?? ""}`;
  return `${n.toFixed(2)}:${offer.symbol ?? ""}`;
}

function meaningfullyChanged(before: WatchOffer, after: WatchOffer): boolean {
  const a = Number(before.remaining);
  const b = Number(after.remaining);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return poolKey(before) !== poolKey(after);
  if (a === 0 && b === 0) return false;
  const delta = Math.abs(a - b);
  const basis = Math.max(Math.abs(a), 1);
  return delta >= 1 || delta / basis >= 0.01;
}

function poolChangeSummary(before: WatchOffer, after: WatchOffer): string {
  const from = before.remaining != null ? `${trimPool(before.remaining)} ${before.symbol ?? before.asset}` : "n/a";
  const to = after.remaining != null ? `${trimPool(after.remaining)} ${after.symbol ?? after.asset}` : after.poolError || "n/a";
  return `${after.title} remaining pool ${from} → ${to}.`;
}

function trimPool(value: string | undefined): string {
  if (value == null) return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}
