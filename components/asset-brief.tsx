"use client";

import { OfficialSourceLinks } from "@/components/official-source-links";
import { useWallet } from "@/components/wallet-provider";
import { walletEligibilityLabel } from "@/lib/eligibility-status";
import { shortAddress } from "@/lib/labels";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Brief = {
  sourceId: string;
  title: string;
  category: string;
  officialUrl?: string;
  wallet: {
    address: string;
    amount?: string;
    symbol?: string;
    estimatedValueUsd?: number;
    eligibility?: string;
    verification: string;
    scannedAt: string;
    chainLabel: string;
    nativeTxCount?: number;
    transferHistory: string;
    detail: string;
  };
  market: {
    available: boolean;
    symbol: string;
    priceUsd?: number;
    marketCapUsd?: number;
    volume24hUsd?: number;
    circulatingSupply?: number;
    detail: string;
  };
  security: {
    available: boolean;
    honeypot?: boolean;
    mintable?: boolean;
    ownerRenounced?: boolean;
    canTakeBackOwnership?: boolean;
    blacklist?: boolean;
    detail: string;
    contract?: string;
  };
};

function usd(value?: number): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function flagLabel(value: boolean | undefined, yes: string, no: string): string | null {
  if (value === true) return yes;
  if (value === false) return no;
  return null;
}

function AssetBriefInner() {
  const params = useSearchParams();
  const { address } = useWallet();
  const source = params.get("source") || "";
  const queryAddress = params.get("address") || address || "";
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!queryAddress || !source) {
      setLoading(false);
      setError("Open this page from a Wallet check finding.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/asset?address=${encodeURIComponent(queryAddress)}&source=${encodeURIComponent(source)}`)
      .then(async (res) => {
        const json = (await res.json()) as Brief & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Could not load this asset brief.");
          setBrief(null);
          return;
        }
        setError(null);
        setBrief(json);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this asset brief.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryAddress, source]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/wallet" className="text-sm text-muted-foreground hover:text-foreground">
          ← Wallet check
        </Link>
        <h1 className="mt-2 font-heading text-3xl tracking-tight">{brief?.title ?? "Asset"}</h1>
        <p className="mt-2 text-muted-foreground">
          P0 brief for this public address only: wallet context, a CoinGecko price snapshot, and GoPlus contract flags.
          Not a CoinMarketCap page. PoolIndex does not invent Eligible.
        </p>
      </div>
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading brief…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {brief ? (
        <>
          <section className="rounded-xl border p-5">
            <h2 className="font-heading text-xl">This wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground">{brief.wallet.detail}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-mono">{shortAddress(brief.wallet.address)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chain</dt>
                <dd>{brief.wallet.chainLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Holding on this address</dt>
                <dd>
                  {brief.wallet.amount && brief.wallet.symbol
                    ? `${brief.wallet.amount} ${brief.wallet.symbol}`
                    : "No amount in the latest scan"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estimated value of this holding</dt>
                <dd>{usd(brief.wallet.estimatedValueUsd) ?? "Unavailable — not shown as $0"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status for this address</dt>
                <dd>
                  {brief.wallet.eligibility
                    ? walletEligibilityLabel(brief.wallet.eligibility as Parameters<typeof walletEligibilityLabel>[0])
                    : brief.wallet.verification}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last scan</dt>
                <dd>{brief.wallet.scannedAt}</dd>
              </div>
              {brief.wallet.nativeTxCount != null ? (
                <div>
                  <dt className="text-muted-foreground">Native tx count (this chain)</dt>
                  <dd>{brief.wallet.nativeTxCount}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Send/receive history</dt>
                <dd>Not available in Closed Beta</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="font-heading text-xl">Price context</h2>
            <p className="mt-2 text-sm text-muted-foreground">{brief.market.detail}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Price</dt>
                <dd>{usd(brief.market.priceUsd) ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Market cap</dt>
                <dd>{usd(brief.market.marketCapUsd) ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">24h volume</dt>
                <dd>{usd(brief.market.volume24hUsd) ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Circulating supply</dt>
                <dd>
                  {brief.market.circulatingSupply != null
                    ? brief.market.circulatingSupply.toLocaleString()
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="font-heading text-xl">Contract flags</h2>
            <p className="mt-2 text-sm text-muted-foreground">{brief.security.detail}</p>
            {brief.security.available ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {flagLabel(brief.security.honeypot, "GoPlus reported honeypot behavior", "GoPlus did not report a honeypot") ? (
                  <li>{flagLabel(brief.security.honeypot, "GoPlus reported honeypot behavior", "GoPlus did not report a honeypot")}</li>
                ) : null}
                {flagLabel(brief.security.mintable, "GoPlus reported mint capability", "GoPlus did not report mint capability") ? (
                  <li>{flagLabel(brief.security.mintable, "GoPlus reported mint capability", "GoPlus did not report mint capability")}</li>
                ) : null}
                {flagLabel(brief.security.ownerRenounced, "GoPlus owner address is the zero address", "") ? (
                  <li>GoPlus owner address is the zero address</li>
                ) : null}
                {flagLabel(brief.security.canTakeBackOwnership, "GoPlus reported ownership can be taken back", "GoPlus did not report take-back ownership") ? (
                  <li>
                    {flagLabel(
                      brief.security.canTakeBackOwnership,
                      "GoPlus reported ownership can be taken back",
                      "GoPlus did not report take-back ownership",
                    )}
                  </li>
                ) : null}
                {flagLabel(brief.security.blacklist, "GoPlus reported a blacklist function", "GoPlus did not report a blacklist function") ? (
                  <li>{flagLabel(brief.security.blacklist, "GoPlus reported a blacklist function", "GoPlus did not report a blacklist function")}</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No GoPlus flags for this source.</p>
            )}
            {brief.security.contract ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground">{brief.security.contract}</p>
            ) : null}
          </section>
          <OfficialSourceLinks officialUrl={brief.officialUrl} />
        </>
      ) : null}
    </div>
  );
}

export function AssetBriefPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AssetBriefInner />
    </Suspense>
  );
}
