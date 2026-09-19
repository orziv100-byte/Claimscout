import { CATALOG, filterCatalog, getClaimById } from "./catalog";
import { liveSourceLimit, readResourceSnapshot } from "./resource-guard";
import { searchArchiveOrg } from "./sources/archive-org";
import { searchBitcointalk } from "./sources/bitcointalk";
import { searchGitHub } from "./sources/github";
import { searchReddit } from "./sources/reddit";
import { searchWayback } from "./sources/wayback";
import type { DiscoveredClaim, LiveSourceResult, SearchResponse, SourceKind } from "./types";

const ALL_LIVE: SourceKind[] = ["github", "wayback", "reddit", "bitcointalk", "archive_org"];

type LiveResult = LiveSourceResult & { key: string };

export async function runSearch(
  opts: {
    query: string;
    sources?: string[];
    kinds?: string[];
    statuses?: string[];
    chain?: string;
  },
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const started = Date.now();
  const budgetMs = 18_000;
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

  const liveRunners: { key: string; run: () => Promise<LiveResult> }[] = [];

  if (sources.has("github")) {
    liveRunners.push({
      key: "github",
      run: () => searchGitHub(opts.query).then((r) => ({ key: "github", ...r })),
    });
  }
  if (sources.has("wayback")) {
    liveRunners.push({
      key: "wayback",
      run: () => searchWayback(opts.query).then((r) => ({ key: "wayback", ...r })),
    });
  }
  if (sources.has("reddit")) {
    liveRunners.push({
      key: "reddit",
      run: () => searchReddit(opts.query).then((r) => ({ key: "reddit", ...r })),
    });
  }
  if (sources.has("bitcointalk")) {
    liveRunners.push({
      key: "bitcointalk",
      run: () => searchBitcointalk(opts.query).then((r) => ({ key: "bitcointalk", ...r })),
    });
  }
  if (sources.has("archive_org")) {
    liveRunners.push({
      key: "archive_org",
      run: () => searchArchiveOrg(opts.query).then((r) => ({ key: "archive_org", ...r })),
    });
  }

  const discovered: DiscoveredClaim[] = [];
  const sourceErrors: { source: string; message: string }[] = [];
  let blocked = 0;
  let degraded = false;
  let resourceNote: string | undefined;

  const initial = readResourceSnapshot();
  const limit = liveSourceLimit(initial);
  if (liveRunners.length && limit === 0) {
    degraded = true;
    resourceNote = initial.message;
    sourceErrors.push({
      source: "live",
      message: `Live scan skipped to protect this machine: ${initial.message}`,
    });
  } else {
    for (const runner of liveRunners) {
      if (signal?.aborted) {
        degraded = true;
        resourceNote = "Client cancelled the scan.";
        sourceErrors.push({
          source: runner.key,
          message: "Scan aborted. Remaining live sources skipped. No retry.",
        });
        break;
      }
      if (Date.now() - started > budgetMs) {
        degraded = true;
        resourceNote = "Live scan hit its time budget to protect this machine.";
        sourceErrors.push({
          source: runner.key,
          message: "Time budget reached. Remaining live sources skipped. No retry.",
        });
        break;
      }
      const snap = readResourceSnapshot();
      if (snap.level === "critical") {
        degraded = true;
        resourceNote = snap.message;
        sourceErrors.push({
          source: runner.key,
          message: `Remaining live sources skipped (${snap.message}). No retry.`,
        });
        break;
      }
      try {
        const result = await runner.run();
        if (result.error) {
          sourceErrors.push({ source: result.key, message: result.error });
        }
        blocked += result.blocked;
        for (const item of result.items) {
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
      } catch (err) {
        sourceErrors.push({
          source: runner.key,
          message: err instanceof Error ? err.message : "failed",
        });
      }
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
    degraded: degraded || undefined,
    resourceNote,
  };
}

export { getClaimById };
