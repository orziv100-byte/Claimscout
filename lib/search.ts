import { CATALOG, filterCatalog, getClaimById } from "./catalog";
import { searchArchiveOrg } from "./sources/archive-org";
import { searchBitcointalk } from "./sources/bitcointalk";
import { searchGitHub } from "./sources/github";
import { searchReddit } from "./sources/reddit";
import { searchWayback } from "./sources/wayback";
import type { DiscoveredClaim, SearchResponse, SourceKind } from "./types";

const ALL_LIVE: SourceKind[] = ["github", "wayback", "reddit", "bitcointalk", "archive_org"];

export async function runSearch(opts: {
  query: string;
  sources?: string[];
  kinds?: string[];
  statuses?: string[];
  chain?: string;
}): Promise<SearchResponse> {
  const started = Date.now();
  const sources = new Set(
    (opts.sources?.length ? opts.sources : ["catalog", ...ALL_LIVE]) as string[],
  );

  const catalog = sources.has("catalog")
    ? filterCatalog({
        query: opts.query,
        kinds: opts.kinds,
        statuses: opts.statuses,
        chain: opts.chain,
      })
    : [];

  const liveJobs: Promise<{ key: string; items: DiscoveredClaim[]; error?: string }>[] = [];

  if (sources.has("github")) {
    liveJobs.push(
      searchGitHub(opts.query).then((r) => ({ key: "github", items: r.items, error: r.error })),
    );
  }
  if (sources.has("wayback")) {
    liveJobs.push(
      searchWayback(opts.query).then((r) => ({ key: "wayback", items: r.items, error: r.error })),
    );
  }
  if (sources.has("reddit")) {
    liveJobs.push(
      searchReddit(opts.query).then((r) => ({ key: "reddit", items: r.items, error: r.error })),
    );
  }
  if (sources.has("bitcointalk")) {
    liveJobs.push(
      searchBitcointalk(opts.query).then((r) => ({
        key: "bitcointalk",
        items: r.items,
        error: r.error,
      })),
    );
  }
  if (sources.has("archive_org")) {
    liveJobs.push(
      searchArchiveOrg(opts.query).then((r) => ({
        key: "archive_org",
        items: r.items,
        error: r.error,
      })),
    );
  }

  const settled = await Promise.allSettled(liveJobs);
  const discovered: DiscoveredClaim[] = [];
  const sourceErrors: { source: string; message: string }[] = [];
  const blocked = 0;

  for (const result of settled) {
    if (result.status === "rejected") {
      sourceErrors.push({
        source: "unknown",
        message: result.reason instanceof Error ? result.reason.message : "failed",
      });
      continue;
    }
    if (result.value.error) {
      sourceErrors.push({ source: result.value.key, message: result.value.error });
    }
    for (const item of result.value.items) {
      const catalogHit = CATALOG.find(
        (c) =>
          c.officialUrl &&
          (item.url.startsWith(c.officialUrl) ||
            c.sources.some((s) => item.url.startsWith(s.url))),
      );
      if (catalogHit) {
        item.catalogId = catalogHit.id;
        item.legitimacy = catalogHit.legitimacy;
      }
      discovered.push(item);
    }
  }

  const query = opts.query.trim();
  return {
    query,
    catalog,
    discovered,
    blocked,
    sourceErrors,
    tookMs: Date.now() - started,
  };
}

export { getClaimById };
