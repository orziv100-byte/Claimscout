import { BRAND_NAME, COPYRIGHT, COPYRIGHT_OWNER_NAME } from "@/lib/app-info";
import Link from "next/link";

export function PublicMarketingFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {COPYRIGHT} No copying, sale, or commercial use without prior written permission from{" "}
          {COPYRIGHT_OWNER_NAME}. {BRAND_NAME} is a research tool. It never asks for a seed phrase or private key.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/eula" className="hover:text-foreground">
            EULA
          </Link>
          <Link href="/disclaimer" className="hover:text-foreground">
            Disclaimer
          </Link>
          <Link href="/accessibility" className="hover:text-foreground">
            Accessibility
          </Link>
        </div>
      </div>
    </footer>
  );
}
