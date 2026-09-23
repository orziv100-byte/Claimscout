"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/app-info";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PUBLIC_NAV = [
  { href: "/", label: "Home" },
  { href: "/download", label: "Download" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/eula", label: "Legal" },
  { href: "/disclaimer", label: "Disclaimer" },
];

const PORTAL_NAV = [
  { href: "/download", label: "Download" },
  { href: "/account", label: "Account" },
  { href: "/upgrade", label: "Subscription" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/eula", label: "Legal" },
];

export function PublicMarketingHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const nav = user ? PORTAL_NAV : PUBLIC_NAV;

  return (
    <header className="border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={user ? "/download" : "/"} className="flex items-baseline gap-2">
          <span className="font-heading text-xl tracking-tight">{BRAND_NAME}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">Closed Beta</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label={user ? "Account" : "Public"}>
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2 py-1 text-sm ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-muted-foreground">
                {user.displayName}
                {user.plan === "paid" ? " · Paid" : " · Trial"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void logout()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login?next=/download" className="text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Link href="/register" className="text-muted-foreground hover:text-foreground">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
