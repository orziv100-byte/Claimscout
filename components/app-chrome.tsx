"use client";

import { MarketsTicker } from "@/components/markets-ticker";
import { AuthFunnelFooter } from "@/components/auth-funnel-chrome";
import { PublicMarketingHeader } from "@/components/public-marketing-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isAppPath } from "@/lib/site-surface";

export function isPublicDownloadPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/download" || pathname.startsWith("/download/");
}

/** Website/legal/auth chrome — not the desktop application shell. */
export function isAuthFunnelPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return !isAppPath(pathname);
}

export function AppChrome({ desktop = false }: { initialPath?: string; desktop?: boolean }) {
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

export function AppFooter({ desktop = false }: { initialPath?: string; desktop?: boolean }) {
  if (desktop) return <SiteFooter />;
  return <AuthFunnelFooter />;
}
