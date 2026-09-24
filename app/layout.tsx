import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { AppChrome, AppFooter } from "@/components/app-chrome";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanProvider } from "@/components/plan-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { BRAND_NAME, COPYRIGHT } from "@/lib/app-info";
import { LegalReacceptBanner } from "@/components/legal-reaccept-banner";
import { SkipLink } from "@/components/skip-link";
import { cookies, headers } from "next/headers";
import { DESKTOP_COOKIE, isDesktopClient } from "@/lib/site-surface";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: `Closed Beta research tool for public crypto claim sources. Download the desktop app. ${COPYRIGHT}`,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const headerList = await headers();
  const cookieStore = await cookies();
  const desktop = isDesktopClient({
    userAgent: headerList.get("user-agent"),
    desktopCookie: cookieStore.get(DESKTOP_COOKIE)?.value,
  });
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SkipLink />
        <TooltipProvider>
          <AuthProvider>
            <PlanProvider>
              <WalletProvider>
                <MaintenanceBanner />
                <LegalReacceptBanner />
                <AppChrome desktop={desktop} />
                <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8" tabIndex={-1}>
                  {children}
                </main>
                <AppFooter desktop={desktop} />
              </WalletProvider>
            </PlanProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
