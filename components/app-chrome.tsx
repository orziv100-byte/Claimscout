"use client";

import { MarketsTicker } from "@/components/markets-ticker";
import { PublicMarketingHeader } from "@/components/public-marketing-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppChrome({ desktop = false }: { desktop?: boolean }) {
  if (desktop) {
    return (
      <>
        <SiteHeader />
        <MarketsTicker />
      </>
    );
  }
  return <PublicMarketingHeader />;
}

export function AppFooter({ desktop = false }: { desktop?: boolean }) {
  return <SiteFooter variant={desktop ? "app" : "website"} />;
}
