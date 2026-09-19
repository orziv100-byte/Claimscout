"use client";

import { CatalogClaimCard, DiscoveredClaimCard } from "@/components/claim-card";
import { InspectPanel } from "@/components/inspect-panel";
import { SearchForm } from "@/components/search-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResponse } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export function LiveSearch({
  query,
  sources,
  kinds,
  inspect,
}: {
  query: string;
  sources?: string;
  kinds?: string;
  inspect?: string;
}) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sources) params.set("sources", sources);
    if (kinds) params.set("kinds", kinds);
    const ac = new AbortController();
    fetch(`/api/search?${params.toString()}`, { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { error?: string } & SearchResponse;
        if (res.status === 503) {
          throw new Error(
            json.error ||
              "Live scan paused to protect this machine. Wait for CPU/RAM to recover, then scan once — do not retry in a loop.",
          );
        }
        if (!res.ok) throw new Error(json.error || "Search failed");
        setData(json as SearchResponse);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Search failed");
        setLoading(false);
      });
    return () => ac.abort();
  }, [query, sources, kinds]);

  return (
    <div className="flex flex-col gap-8">
      <SearchForm defaultQuery={query} defaultSources={sources} defaultKinds={kinds} />
      {inspect ? <InspectPanel initialUrl={inspect} /> : <InspectPanel />}
      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Live scan failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{data.catalog.length} catalog</Badge>
            <Badge variant="secondary">{data.discovered.length} live hits</Badge>
            <span>{data.tookMs} ms</span>
            {data.blocked ? <span>{data.blocked} blocked by safety filter</span> : null}
          </div>
          {data.sourceErrors.length ? (
            <Alert>
              <AlertTitle>Some sources were unavailable</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc pl-4">
                  {data.sourceErrors.map((err) => (
                    <li key={err.source}>
                      {err.source}: {err.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {data.plan && (data.plan.lockedSources.length || data.plan.reservedSources.length) ? (
            <Alert>
              <AlertTitle>
                {data.plan.id === "free" ? "Free scan uses catalog + GitHub" : "Scout+ scans about 70% of sources"}
              </AlertTitle>
              <AlertDescription>
                {data.plan.lockedSources.length
                  ? `Upgrade to Scout+ ($40) for ${data.plan.lockedSources.join(", ")}. `
                  : null}
                {data.plan.reservedSources.length
                  ? `${data.plan.reservedSources.join(", ")} stay reserved for a later plan. `
                  : null}
                <Link href="/upgrade" className="text-primary hover:underline">
                  See plans
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          {data.degraded ? (
            <Alert>
              <AlertTitle>Scan reduced to protect this machine</AlertTitle>
              <AlertDescription>
                {data.resourceNote ||
                  "Live sources were throttled because of CPU, RAM, or disk pressure. Completed catalog results are kept. Do not re-run the scan in a loop."}
              </AlertDescription>
            </Alert>
          ) : null}
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-2xl">Catalog matches</h2>
            {data.catalog.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {data.catalog.map((claim) => (
                  <CatalogClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No catalog matches for this query.</p>
            )}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-2xl">Live &amp; archive hits</h2>
            {data.discovered.length ? (
              <div className="grid gap-3">
                {data.discovered.map((item) => (
                  <DiscoveredClaimCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No additional live hits. Try a broader query such as “faucet” or “airdrop merkle”, or rely on the catalog
                while a source is rate-limiting this server.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
