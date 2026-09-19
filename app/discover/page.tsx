import { LiveSearch } from "@/components/live-search";

export const metadata = {
  title: "Live scan",
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sources?: string; kinds?: string; inspect?: string }>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const sources = typeof sp.sources === "string" ? sp.sources : undefined;
  const kinds = typeof sp.kinds === "string" ? sp.kinds : undefined;
  const inspect = typeof sp.inspect === "string" ? sp.inspect : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Live claim scan</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Catalog first, then GitHub, Wayback Machine, archive.org, Reddit, and Bitcointalk. Hits that look like seed
          phrases, private keys, drainers, claim bots, or airdrop hunters are dropped before they reach the UI.
        </p>
      </div>
      <LiveSearch
        key={`${query}|${sources ?? ""}|${kinds ?? ""}`}
        query={query}
        sources={sources}
        kinds={kinds}
        inspect={inspect}
      />
    </div>
  );
}
