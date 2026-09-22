import { CATALOG } from "./catalog";
import { scanCatalogPools } from "./onchain";
import {
  buildWatchSnapshot,
  diffWatchSnapshots,
  formatWatchDigest,
  openWatchPools,
  unsupportedWatchPools,
  type WatchChange,
  type WatchOffer,
  type WatchSnapshot,
} from "./watch";
import { readLatestWatchSnapshot, writeWatchSnapshot } from "./watch-store";

export type CatalogWatchResult = {
  snapshot: WatchSnapshot;
  previous: WatchSnapshot | null;
  changes: WatchChange[];
  openPools: WatchOffer[];
  unsupportedPools: WatchOffer[];
  digest: string;
  refreshed: boolean;
};

export async function captureCatalogWatch(): Promise<CatalogWatchResult> {
  const previous = readLatestWatchSnapshot();
  const pools = await scanCatalogPools();
  const snapshot = buildWatchSnapshot(CATALOG, pools);
  const changes = diffWatchSnapshots(previous, snapshot);
  const openPools = openWatchPools(snapshot);
  const unsupportedPools = unsupportedWatchPools(snapshot);
  const digest = formatWatchDigest({
    capturedAt: snapshot.capturedAt,
    changes,
    openPools,
    unsupportedPools,
  });
  writeWatchSnapshot(snapshot, digest);
  return { snapshot, previous, changes, openPools, unsupportedPools, digest, refreshed: true };
}

export function readCatalogWatch(): CatalogWatchResult | null {
  const snapshot = readLatestWatchSnapshot();
  if (!snapshot) return null;
  const openPools = openWatchPools(snapshot);
  const unsupportedPools = unsupportedWatchPools(snapshot);
  return {
    snapshot,
    previous: snapshot,
    changes: [],
    openPools,
    unsupportedPools,
    digest: formatWatchDigest({ capturedAt: snapshot.capturedAt, changes: [], openPools, unsupportedPools }),
    refreshed: false,
  };
}
