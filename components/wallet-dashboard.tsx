"use client";

import { StatusBadge } from "@/components/claim-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWallet } from "@/components/wallet-provider";
import { CATALOG } from "@/lib/catalog";
import { shortAddress } from "@/lib/labels";
import type { EligibilityResult } from "@/lib/types";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function WalletDashboard() {
  const { address, mode, connectInjected } = useWallet();
  const [rows, setRows] = useState<EligibilityResult[] | null>(null);
  const [pools, setPools] = useState<Record<string, { remaining?: string; symbol?: string; error?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPools() {
    const res = await fetch("/api/onchain?pools=1");
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      pools?: { claimId: string; remaining?: string; symbol?: string; error?: string }[];
    };
    if (res.status === 429) {
      throw new Error(json.error || "Too many pool scans. Wait, then try once — do not retry in a loop.");
    }
    if (res.status === 503) {
      throw new Error(
        json.error || "Pool scan paused to protect this machine. Wait, then try once.",
      );
    }
    if (!res.ok) throw new Error(json.error || "Pool scan failed");
    const map: Record<string, { remaining?: string; symbol?: string; error?: string }> = {};
    for (const pool of json.pools ?? []) {
      map[pool.claimId] = pool;
    }
    setPools(map);
  }

  async function run() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      await loadPools();
      const res = await fetch(`/api/onchain?address=${encodeURIComponent(address)}`);
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        eligibility?: EligibilityResult[];
      };
      if (res.status === 429) {
        throw new Error(json.error || "Too many wallet checks. Wait, then try once — do not retry in a loop.");
      }
      if (res.status === 503) {
        throw new Error(
          json.error || "Wallet check paused to protect this machine. Wait, then try once.",
        );
      }
      if (!res.ok) throw new Error(json.error || "Check failed");
      setRows(json.eligibility as EligibilityResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  const visible = CATALOG.filter((c) => c.id !== "tornado-avoided");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Read-only wallet session</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Poolindex stores only the public address in session storage. It never requests a signature for browsing or
            eligibility. Private keys and seed phrases are rejected if pasted.
          </p>
          {address ? (
            <p>
              Active address: <span className="font-mono">{address}</span> ({mode === "injected" ? "injected wallet" : "paste / read-only"})
            </p>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => void connectInjected()}>Connect wallet</Button>
              <p className="self-center text-muted-foreground">or paste an address in the header.</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => void run()} disabled={!address || loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : "Scan catalog eligibility"}
            </Button>
            <Button variant="outline" onClick={() => void loadPools()} disabled={loading}>
              Refresh remaining pools
            </Button>
          </div>
          {error ? <p className="text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalog vs this address</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Remaining pool</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((claim) => {
                const elig = rows?.find((r) => r.claimId === claim.id);
                const pool = pools[claim.id];
                return (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link href={`/claims/${claim.id}`} className="hover:underline">
                        {claim.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{claim.asset}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell className="max-w-sm text-xs text-muted-foreground">
                      {elig ? (
                        <>
                          <div className="font-medium text-foreground capitalize">
                            {elig.status.replaceAll("_", " ")}
                          </div>
                          {elig.detail}
                        </>
                      ) : address ? (
                        "Run a scan"
                      ) : (
                        "No address"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {pool?.remaining && pool.symbol
                        ? `${Number(pool.remaining).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}`
                        : pool?.error
                          ? "n/a"
                          : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {address ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Checking {shortAddress(address)} against published public offers only. Remaining contract balance is not
              proof of claimability.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
