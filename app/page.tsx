import { CatalogClaimCard } from "@/components/claim-card";
import { SearchForm } from "@/components/search-form";
import { Badge } from "@/components/ui/badge";
import { CATALOG } from "@/lib/catalog";
import { Archive, Eye, LockKeyhole, Radio } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const featured = CATALOG.filter(
    (c) =>
      c.id !== "tornado-avoided" &&
      (c.status === "open" || c.status === "unclaimed_remaining" || c.status === "archived"),
  ).slice(0, 6);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6 pt-4">
        <Badge variant="outline" className="w-fit">
          Public offers only · no key recovery
        </Badge>
        <div className="max-w-3xl">
          <h1 className="font-heading text-4xl leading-tight tracking-tight md:text-5xl">
            Find crypto rewards that were actually offered to the public.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Poolindex searches current sites and archives for airdrops, faucets, giveaways, redemption links, and
            community testnet rewards — then runs a safety check on the URL before you touch a wallet.
          </p>
        </div>
        <SearchForm compact />
        <p className="text-xs text-muted-foreground">
          <Link href="/register" className="text-primary hover:underline">
            Closed Beta
          </Link>{" "}
          is invite-only. Free: catalog + GitHub, one wallet.{" "}
          <Link href="/upgrade" className="text-primary hover:underline">
            Poolindex Pro (planned)
          </Link>
          : about 70% of sources and up to five wallets. Private keys, seed phrases, and other people&apos;s wallets are
          out of scope.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Radio,
            title: "Live + archive search",
            body: "GitHub, Reddit, Bitcointalk, Wayback CDX, and archive.org in one scan.",
          },
          {
            icon: Eye,
            title: "URL safety check",
            body: "Inspect a live fetch, phishing heuristics, and Wayback snapshots before you click claim. This is not a guarantee the URL is safe.",
          },
          {
            icon: LockKeyhole,
            title: "Read-only wallets",
            body: "Paste an address or connect. Signing happens only after you approve a legitimate claim.",
          },
          {
            icon: Archive,
            title: "Historical faucets",
            body: "Old promotional pages are kept as archives so you can read the original offer.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-border/80 bg-card p-4">
            <item.icon className="mb-3 size-4 text-primary" />
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-heading text-2xl">Watchlist</h2>
          <Link href="/catalog" className="text-sm text-primary hover:underline">
            Full catalog
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {featured.map((claim) => (
            <CatalogClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      </section>
    </div>
  );
}
