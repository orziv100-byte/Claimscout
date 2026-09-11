import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHAIN_LABEL, KIND_LABEL, LEGITIMACY_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { CatalogClaim, DiscoveredClaim } from "@/lib/types";
import { Archive, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function KindBadge({ kind }: { kind: string }) {
  return <Badge variant="secondary">{KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind}</Badge>;
}

export function StatusBadge({ status }: { status: CatalogClaim["status"] }) {
  const tone =
    status === "open" || status === "unclaimed_remaining"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "expired"
        ? "bg-muted text-muted-foreground"
        : "bg-amber-500/15 text-amber-800 dark:text-amber-400";
  return <Badge variant="outline" className={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function CatalogClaimCard({ claim }: { claim: CatalogClaim }) {
  return (
    <Link href={`/claims/${claim.id}`} className="block h-full">
      <Card className="h-full transition-colors hover:bg-secondary/40">
        <CardHeader>
          <div className="flex flex-wrap gap-1.5">
            <KindBadge kind={claim.kind} />
            <StatusBadge status={claim.status} />
            <Badge variant="outline">{LEGITIMACY_LABEL[claim.legitimacy]}</Badge>
          </div>
          <CardTitle className="mt-2 text-lg">{claim.title}</CardTitle>
          <CardDescription>
            {CHAIN_LABEL[claim.chain] ?? claim.chain} · {claim.asset}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">{claim.summary}</CardContent>
      </Card>
    </Link>
  );
}

export function DiscoveredClaimCard({ item }: { item: DiscoveredClaim }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={item.kind} />
          <Badge variant="outline">{item.sourceLabel}</Badge>
          <Badge variant="outline">{LEGITIMACY_LABEL[item.legitimacy]}</Badge>
          {item.catalogId ? (
            <Badge>
              In catalog
            </Badge>
          ) : null}
        </div>
        <CardTitle className="mt-2 text-base">{item.title}</CardTitle>
        <CardDescription>{item.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {item.flags.length ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-300">
            {item.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Open source <ArrowUpRight className="size-3.5" />
          </a>
          {item.archiveUrl ? (
            <a
              href={item.archiveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Archive className="size-3.5" /> Archive
            </a>
          ) : null}
          {item.catalogId ? (
            <Link href={`/claims/${item.catalogId}`} className="text-muted-foreground hover:text-foreground">
              Catalog entry
            </Link>
          ) : (
            <Link
              href={`/discover?inspect=${encodeURIComponent(item.url)}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Verify URL
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
