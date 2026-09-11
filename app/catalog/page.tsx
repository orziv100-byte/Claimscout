import { CatalogClaimCard } from "@/components/claim-card";
import { Badge } from "@/components/ui/badge";
import { filterCatalog } from "@/lib/catalog";
import { CLAIM_KINDS, CLAIM_STATUSES } from "@/lib/types";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/labels";
import Link from "next/link";

export const metadata = {
  title: "Catalog",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; status?: string; chain?: string }>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const chain = typeof sp.chain === "string" ? sp.chain : undefined;

  const claims = filterCatalog({
    query,
    kinds: kind ? [kind] : undefined,
    statuses: status ? [status] : undefined,
    chain,
  });

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { q: query, kind, status, chain, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `/catalog?${s}` : "/catalog";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Curated public claims</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Hand-reviewed offers that were intentionally published: official airdrops, historical faucets, testnet
          faucets, redemption programs, and public puzzles (documented only — never solved here).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={!kind ? "default" : "outline"} render={<Link href={href({ kind: undefined })} />}>
          All types
        </Badge>
        {CLAIM_KINDS.map((k) => (
          <Badge key={k} variant={kind === k ? "default" : "outline"} render={<Link href={href({ kind: k })} />}>
            {KIND_LABEL[k]}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={!status ? "default" : "outline"} render={<Link href={href({ status: undefined })} />}>
          Any status
        </Badge>
        {CLAIM_STATUSES.map((s) => (
          <Badge key={s} variant={status === s ? "default" : "outline"} render={<Link href={href({ status: s })} />}>
            {STATUS_LABEL[s]}
          </Badge>
        ))}
      </div>
      {claims.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {claims.map((claim) => (
            <CatalogClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing in the catalog matches those filters.</p>
      )}
    </div>
  );
}
