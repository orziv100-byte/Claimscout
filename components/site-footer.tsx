import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Claimscout documents public offers. It never asks for a seed phrase or private key.</p>
        <div className="flex gap-4">
          <Link href="/safety" className="hover:text-foreground">
            Safety rules
          </Link>
          <Link href="/catalog" className="hover:text-foreground">
            Catalog
          </Link>
        </div>
      </div>
    </footer>
  );
}
