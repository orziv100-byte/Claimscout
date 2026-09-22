import { listCoverageRequests, COVERAGE_BILLING, COVERAGE_FEATURE_NAME } from "@/lib/engine/coverage";
import { CHAIN_LABEL } from "@/lib/labels";
import Link from "next/link";

export const metadata = {
  title: "Request Coverage",
};

export default function CoveragePage() {
  const rows = listCoverageRequests();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">{COVERAGE_FEATURE_NAME}</h1>
        <p className="mt-2 text-muted-foreground">
          This is a public roadmap of catalog programs that still need a real wallet-level adapter. It is not a
          checkout. Closed Beta cannot sell this. A future payment would buy {COVERAGE_BILLING.buys}. It does not buy Eligible.
          The adapter can still return Not eligible, Already claimed, Window closed, or Unable to verify — the same honest
          statuses as Uniswap and ENS today.
        </p>
      </div>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-heading text-2xl text-foreground">Not a paid bugfix</h2>
        <p>{COVERAGE_BILLING.brokenSources} See Source manager on Wallet check when an existing adapter fails.</p>
        <p>
          Unable to verify on 1inch, Blur, LayerZero, Gitcoin, Safe, or dYdX means PoolIndex does not host that
          project’s merkle or allocation file. That is a coverage gap, not a broken RPC.
        </p>
        <p>
          Shared bounties and JSON-config adapters are later work. This page does not add live-scan sources and does
          not invent eligibility.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Queued ({rows.length})</h2>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.catalogId} className="rounded-xl border p-4">
              <p className="font-medium text-foreground">{row.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {CHAIN_LABEL[row.chain] ?? row.chain} · {row.reason.replaceAll("_", " ")} · queued
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{row.reasonLabel}</p>
              <p className="mt-2 text-xs">
                <Link href={`/claims/${row.catalogId}`} className="underline">
                  Catalog entry
                </Link>
                {" · "}
                <a href={row.officialUrl} className="underline" rel="noreferrer" target="_blank">
                  Official source
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
