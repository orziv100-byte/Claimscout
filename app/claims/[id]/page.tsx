import { EligibilityPanel } from "@/components/eligibility-panel";
import { InspectPanel } from "@/components/inspect-panel";
import { ResultFeedback } from "@/components/result-feedback";
import { StatusBadge } from "@/components/claim-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getClaimById } from "@/lib/catalog";
import { CHAIN_LABEL, KIND_LABEL, LEGITIMACY_LABEL, SOURCE_LABEL, formatDate } from "@/lib/labels";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = getClaimById(id);
  return { title: claim?.title ?? "Claim" };
}

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = getClaimById(id);
  if (!claim) notFound();

  const inspectUrl = claim.officialUrl || claim.archiveUrl || claim.sources[0]?.url;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground">
          ← Catalog
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{KIND_LABEL[claim.kind]}</Badge>
          <StatusBadge status={claim.status} />
          <Badge variant="outline">{LEGITIMACY_LABEL[claim.legitimacy]}</Badge>
          <Badge variant="outline">{CHAIN_LABEL[claim.chain] ?? claim.chain}</Badge>
          <Badge variant="outline">{claim.asset}</Badge>
        </div>
        <h1 className="font-heading text-3xl tracking-tight md:text-4xl">{claim.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{claim.summary}</p>
        {claim.announcedAt ? (
          <p className="text-xs text-muted-foreground">Announced {formatDate(claim.announcedAt)}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border/80 bg-card p-5">
            <h2 className="font-heading text-xl">Who it was for</h2>
            <p className="mt-2 text-sm text-muted-foreground">{claim.eligibility}</p>
            <Separator className="my-4" />
            <h3 className="text-sm font-medium">How to verify</h3>
            <p className="mt-2 text-sm text-muted-foreground">{claim.howToVerify}</p>
            {claim.warnings.length ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
                {claim.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-xl border border-border/80 bg-card p-5">
            <h2 className="font-heading text-xl">Sources</h2>
            <ul className="mt-3 space-y-2">
              {claim.sources.map((source) => (
                <li key={source.url} className="flex flex-col gap-0.5 text-sm">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {source.label} <ArrowUpRight className="size-3.5" />
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[source.kind]}
                    {source.publishedAt ? ` · ${formatDate(source.publishedAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {claim.onChain?.explorerDistributorUrl || claim.onChain?.explorerTokenUrl ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Explorer:{" "}
                {claim.onChain.explorerDistributorUrl ? (
                  <a className="text-primary hover:underline" href={claim.onChain.explorerDistributorUrl} target="_blank" rel="noreferrer">
                    distributor
                  </a>
                ) : null}
                {claim.onChain.explorerDistributorUrl && claim.onChain.explorerTokenUrl ? " · " : null}
                {claim.onChain.explorerTokenUrl ? (
                  <a className="text-primary hover:underline" href={claim.onChain.explorerTokenUrl} target="_blank" rel="noreferrer">
                    token
                  </a>
                ) : null}
              </p>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <EligibilityPanel claim={claim} />
          {inspectUrl ? <InspectPanel initialUrl={inspectUrl} /> : <InspectPanel />}
          <ResultFeedback source="catalog" claimId={claim.id} url={inspectUrl} />
        </div>
      </div>
    </div>
  );
}
