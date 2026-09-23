import { CatalogClaimCard } from "@/components/claim-card";
import { HomeAddressHero } from "@/components/home-address-hero";
import { Badge } from "@/components/ui/badge";
import { CATALOG } from "@/lib/catalog";
import { Archive, Eye, LockKeyhole, Radio } from "lucide-react";
import Link from "next/link";

export default function AppHomePage() {
  const featured = CATALOG.filter(
    (c) =>
      c.id !== "tornado-avoided" &&
      (c.status === "open" || c.status === "unclaimed_remaining" || c.status === "archived"),
  ).slice(0, 6);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6 pt-4">
        <Badge variant="outline" className="w-fit">
          Public address only · names never paywalled
        </Badge>
        <div className="max-w-3xl">
          <h1 className="font-heading text-4xl leading-tight tracking-tight md:text-5xl">
            Paste a public 0x address. See real offer names and honest statuses.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            PoolIndex checks public Ethereum offers against the address you paste. Eligible, Not eligible, Already
            claimed, or Unable to verify — never invented from leftover contract balance, and never hidden behind
            payment. Connect a wallet only if you want to; a seed phrase is rejected.
          </p>
        </div>
        <HomeAddressHero />
        <p className="text-xs text-muted-foreground">
          Desktop application. Register, verify email, and sign in. PoolIndex does not guarantee funds or rewards.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Radio,
            title: "Address check first",
            body: "Paste 0x. See what this wallet holds and which programs match its activity — not the same 12 names for every address.",
          },
          {
            icon: Eye,
            title: "Official + archive + inspect",
            body: "Before every external claim link: official source, archive copy, and a phishing inspect. This is not a guarantee the URL is safe.",
          },
          {
            icon: LockKeyhole,
            title: "Read-only wallets",
            body: "Paste an address. Connecting a browser wallet is optional. PoolIndex does not claim tokens for you.",
          },
          {
            icon: Archive,
            title: "History, not farming",
            body: "Old faucets and Wayback pages stay as research. Quest/Galxe farming is out of scope.",
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
          <h2 className="font-heading text-2xl">Catalog (secondary)</h2>
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
