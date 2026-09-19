"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CLAIM_KINDS } from "@/lib/types";
import { KIND_LABEL } from "@/lib/labels";
import { usePlan } from "@/components/plan-provider";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SOURCES = [
  { id: "catalog", label: "Catalog" },
  { id: "github", label: "GitHub" },
  { id: "wayback", label: "Wayback" },
  { id: "archive_org", label: "Archive.org" },
  { id: "reddit", label: "Reddit" },
  { id: "bitcointalk", label: "Bitcointalk" },
] as const;

const SOURCE_IDS = SOURCES.map((s) => s.id);

function selectedIds(raw: string | undefined, allowed: readonly string[], fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  const next = raw.split(",").map((part) => part.trim()).filter((id) => allowed.includes(id));
  return next.length ? next : fallback;
}

export function SearchForm({
  defaultQuery = "",
  defaultSources,
  defaultKinds,
  compact = false,
}: {
  defaultQuery?: string;
  defaultSources?: string;
  defaultKinds?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { sources: planSources, sourceAccessFor, plan } = usePlan();
  const [query, setQuery] = useState(defaultQuery);
  const [sources, setSources] = useState<string[]>(() =>
    selectedIds(defaultSources, SOURCE_IDS, [...SOURCE_IDS]),
  );
  const [kinds, setKinds] = useState<string[]>(() => selectedIds(defaultKinds, CLAIM_KINDS, []));

  useEffect(() => {
    setSources((current) => {
      const next = current.filter((id) => sourceAccessFor(id) === "allowed");
      return next.length ? next : [...planSources];
    });
  }, [plan, planSources, sourceAccessFor]);

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (sources.length && sources.length < SOURCES.length) params.set("sources", sources.join(","));
    if (kinds.length) params.set("kinds", kinds.join(","));
    router.push(`/discover?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="UNI airdrop, sepolia faucet, bitcointalk giveaway…"
            className="h-11 bg-card pl-9 text-base"
          />
        </div>
        <Button size="lg" type="submit" className="h-11">
          Scan public sources
        </Button>
      </div>
      {compact ? null : (
        <div className="flex flex-col gap-3 text-sm">
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="sr-only">Sources</legend>
            {SOURCES.map((source) => {
              const access = sourceAccessFor(source.id);
              const locked = access !== "allowed";
              return (
              <label key={source.id} className="inline-flex items-center gap-2 text-muted-foreground">
                <Checkbox
                  checked={!locked && sources.includes(source.id)}
                  disabled={locked}
                  onCheckedChange={() => toggle(sources, source.id, setSources)}
                />
                {source.label}
                {access === "upgrade" ? (
                  <span className="text-[10px] uppercase tracking-wide">Scout+</span>
                ) : null}
                {access === "reserved" ? (
                  <span className="text-[10px] uppercase tracking-wide">Later</span>
                ) : null}
              </label>
              );
            })}
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="text-xs font-medium text-muted-foreground">Offer type</legend>
            {CLAIM_KINDS.map((kind) => (
              <label key={kind} className="inline-flex items-center gap-2 text-muted-foreground">
                <Checkbox
                  checked={kinds.includes(kind)}
                  onCheckedChange={() => toggle(kinds, kind, setKinds)}
                />
                {KIND_LABEL[kind]}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </form>
  );
}
