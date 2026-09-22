import { BRAND_NAME, COPYRIGHT, COPYRIGHT_OWNER_NAME } from "@/lib/app-info";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {COPYRIGHT} No copying, sale, or commercial use without prior written permission from{" "}
          {COPYRIGHT_OWNER_NAME}. {BRAND_NAME} is a research tool. Copyright in the source code is not a
          trademark registration of the {BRAND_NAME} name. It never asks for a seed phrase or
          private key.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/accessibility" className="hover:text-foreground">
            Accessibility
          </Link>
          <Link href="/safety" className="hover:text-foreground">
            Safety rules
          </Link>
          <Link href="/desktop" className="hover:text-foreground">
            Windows
          </Link>
          <Link href="/catalog" className="hover:text-foreground">
            Catalog
          </Link>
          <Link href="/coverage" className="hover:text-foreground">
            Coverage
          </Link>
        </div>
      </div>
    </footer>
  );
}
