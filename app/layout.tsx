import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanProvider } from "@/components/plan-provider";
import { WalletProvider } from "@/components/wallet-provider";
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
    default: "Claimscout",
    template: "%s · Claimscout",
  },
  description:
    "Discover and verify publicly claimable cryptocurrency rewards — airdrops, faucets, archived giveaways, and redemption links. Read-only until you approve a legitimate claim.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <PlanProvider>
            <WalletProvider>
              <SiteHeader />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
              <SiteFooter />
            </WalletProvider>
          </PlanProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
