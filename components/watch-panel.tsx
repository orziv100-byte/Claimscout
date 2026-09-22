"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WatchChange, WatchOffer } from "@/lib/watch";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WatchResponse = {
  error?: string;
  snapshot?: { capturedAt: string } | null;
  changes?: WatchChange[];
  openPools?: WatchOffer[];
  unsupportedPools?: WatchOffer[];
  digest?: string;
  refreshed?: boolean;
};

export function WatchPanel() {
  const [data, setData] = useState<WatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(refresh ? "/api/watch?refresh=1" : "/api/watch");
      const json = (await res.json().catch(() => ({}))) as WatchResponse;
      if (res.status === 503) {
        throw new Error(json.error || "Catalog watch paused to protect this machine. Wait, then try once.");
      }
      if (!res.ok) throw new Error(json.error || "Watch failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Watch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const capturedAt = data?.snapshot?.capturedAt
    ? new Date(data.snapshot.capturedAt).toLocaleString()
    : null;

  return (
    <Card>
      <CardHeader>
          <CardTitle>Catalog pool watch</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Daily remaining-pool snapshot of documented public offers. Remaining pool is not wallet eligibility and this
          panel does not store your address. Refresh once — do not retry in a loop.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void load(true)} disabled={loading} size="sm">
            {loading ? <LoaderCircle className="animate-spin" /> : "Refresh catalog watch"}
          </Button>
          {capturedAt ? <span className="text-xs text-muted-foreground">Last snapshot {capturedAt}</span> : null}
        </div>
        {error ? <p className="text-destructive">{error}</p> : null}
        {data?.changes && data.changes.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {data.changes.map((change) => (
              <li key={`${change.kind}-${change.claimId}`}>
                {change.claimId !== "catalog" ? (
                  <Link href={`/claims/${change.claimId}`} className="hover:underline">
                    {change.summary}
                  </Link>
                ) : (
                  change.summary
                )}
              </li>
            ))}
          </ul>
        ) : capturedAt && !loading ? (
          <p className="text-muted-foreground">No catalog or pool changes since the last snapshot.</p>
        ) : null}
        {data?.openPools && data.openPools.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Remaining pools still above zero</p>
            <ul className="space-y-1">
              {data.openPools.map((offer) => (
                <li key={offer.claimId}>
                  <Link href={`/claims/${offer.claimId}`} className="hover:underline">
                    {offer.title}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {" "}
                    {Number(offer.remaining).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    {offer.symbol ?? offer.asset}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data?.unsupportedPools && data.unsupportedPools.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Unverifiable / Unsupported</p>
            <ul className="space-y-1">
              {data.unsupportedPools.map((offer) => (
                <li key={offer.claimId}>
                  <Link href={`/claims/${offer.claimId}`} className="hover:underline">
                    {offer.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    {(offer.poolError ?? "Unsupported").split("\n")[0]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
