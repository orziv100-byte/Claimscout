import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanProvider } from "@/components/plan-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { BRAND_NAME, COPYRIGHT } from "@/lib/app-info";
import { LegalReacceptBanner } from "@/components/legal-reaccept-banner";
import { SkipLink } from "@/components/skip-link";
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
  description: `Closed Beta research tool for public crypto claim sources. Read-only wallet checks. ${COPYRIGHT}`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
                <SiteHeader />
                <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8" tabIndex={-1}>
                  {children}
                </main>
                <SiteFooter />
              </WalletProvider>
            </PlanProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
