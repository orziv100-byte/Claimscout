"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/components/wallet-provider";
import { shortAddress } from "@/lib/labels";
import { ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Scout" },
  { href: "/discover", label: "Live scan" },
  { href: "/catalog", label: "Catalog" },
  { href: "/wallet", label: "Wallet check" },
  { href: "/safety", label: "Rules" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { address, mode, connectInjected, setReadonlyAddress, disconnect, error } = useWallet();
  const [draft, setDraft] = useState("");

  return (
    <header className="border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-heading text-xl tracking-tight">Claimscout</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">public claims only</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-2 py-1 text-sm ${
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {address ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs">
                <ShieldCheck className="size-3.5 text-primary" />
                {mode === "injected" ? "Connected" : "Read-only"} {shortAddress(address)}
              </span>
              <Button size="sm" variant="ghost" onClick={disconnect}>
                Clear
              </Button>
            </div>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setReadonlyAddress(draft);
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste 0x address"
                className="h-8 w-44 font-mono text-xs md:w-56"
                autoComplete="off"
                spellCheck={false}
              />
              <Button size="sm" variant="outline" type="submit">
                Check
              </Button>
              <Button size="sm" type="button" onClick={() => void connectInjected()}>
                <Wallet data-icon="inline-start" />
                Connect
              </Button>
            </form>
          )}
        </div>
      </div>
      {error ? <p className="mx-auto max-w-6xl px-4 pb-2 text-xs text-destructive">{error}</p> : null}
    </header>
  );
}
